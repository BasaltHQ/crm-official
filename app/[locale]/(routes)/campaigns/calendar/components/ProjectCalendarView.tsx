"use client";

import React, { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import fetcher from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    Circle,
    Plus,
    Calendar as CalendarIcon,
    List,
    LayoutGrid,
} from "lucide-react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    getDay,
} from "date-fns";
import Link from "next/link";
import axios from "axios";
import { toast } from "react-hot-toast";

type Props = { userId: string };

type CalendarView = "month" | "week" | "agenda";

interface TaskEvent {
    id: string;
    title: string;
    dueDateAt: Date;
    priority?: string;
    projectTitle?: string;
    projectId?: string;
    taskStatus?: string;
}

export default function ProjectCalendarView({ userId }: Props) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [view, setView] = useState<CalendarView>("month");
    const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [fullDialogOpen, setFullDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState("normal");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch all tasks
    const { data: tasksData, isLoading } = useSWR<{ tasks?: any[] }>(
        `/api/campaigns/tasks`,
        fetcher,
        { refreshInterval: 60000 }
    );

    // Fetch users and boards for full dialog
    const { data: usersData } = useSWR("/api/user", fetcher);
    const { data: boardsData } = useSWR("/api/campaigns", fetcher);

    const users = usersData?.users || [];
    const boards = boardsData?.data || [];

    // Transform tasks into events
    const events = useMemo(() => {
        const tasks = tasksData?.tasks || [];
        return tasks
            .filter((t: any) => t.dueDateAt)
            .map((t: any) => ({
                id: t.id,
                title: t.title || "Untitled",
                dueDateAt: new Date(t.dueDateAt),
                priority: t.priority,
                projectTitle: t.board?.title,
                projectId: t.board?.id,
                taskStatus: t.taskStatus,
            }));
    }, [tasksData]);

    // Get days based on view
    const viewDays = useMemo(() => {
        if (view === "week") {
            const start = startOfWeek(currentMonth, { weekStartsOn: 0 });
            const end = endOfWeek(currentMonth, { weekStartsOn: 0 });
            return eachDayOfInterval({ start, end });
        }
        // Month view
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start, end });
        const startDayOfWeek = getDay(start);
        const paddedDays = [];
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            paddedDays.push(new Date(start.getTime() - (i + 1) * 86400000));
        }
        return [...paddedDays, ...days];
    }, [currentMonth, view]);

    // Get events for a specific day
    const getEventsForDay = (day: Date) => {
        return events.filter((e) => isSameDay(e.dueDateAt, day));
    };

    // Agenda events (starting from current view date)
    const agendaEvents = useMemo(() => {
        const start = currentMonth;
        const end = new Date(start.getTime() + 30 * 86400000); // Show next 30 days from selected date
        return events
            .filter((e) => e.dueDateAt >= start && e.dueDateAt <= end)
            .sort((a, b) => a.dueDateAt.getTime() - b.dueDateAt.getTime());
    }, [events, currentMonth]);

    const priorityColors: Record<string, string> = {
        high: "bg-red-500",
        critical: "bg-red-600",
        normal: "bg-yellow-500",
        medium: "bg-yellow-500",
        low: "bg-green-500",
    };

    const handleDayClick = (day: Date) => {
        setQuickAddDate(day);
        setQuickAddOpen(true);
        setNewTaskTitle("");
        setNewTaskPriority("normal");
    };

    const handleQuickAdd = async () => {
        if (!newTaskTitle.trim() || !quickAddDate) return;
        setIsSubmitting(true);
        try {
            await axios.post("/api/campaigns/tasks/create-task", {
                title: newTaskTitle,
                priority: newTaskPriority,
                dueDateAt: quickAddDate,
                content: "",
                user: userId,
                board: boards[0]?.id || "",
            });
            toast.success("Task created!");
            mutate("/api/campaigns/tasks");
            setQuickAddOpen(false);
            setNewTaskTitle("");
        } catch (error: any) {
            toast.error(error?.response?.data || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    const navigatePrev = () => {
        if (view === "week") {
            setCurrentMonth(subWeeks(currentMonth, 1));
        } else {
            setCurrentMonth(subMonths(currentMonth, 1));
        }
    };

    const navigateNext = () => {
        if (view === "week") {
            setCurrentMonth(addWeeks(currentMonth, 1));
        } else {
            setCurrentMonth(addMonths(currentMonth, 1));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-3" />
                Loading calendar...
            </div>
        );
    }

    return (
        <div className="py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={navigatePrev}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-xl font-bold min-w-[200px] text-center">
                        {view === "week"
                            ? `Week of ${format(startOfWeek(currentMonth, { weekStartsOn: 0 }), "MMM d, yyyy")}`
                            : format(currentMonth, "MMMM yyyy")}
                    </h2>
                    <Button variant="outline" size="icon" onClick={navigateNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center bg-muted/50 border border-border/50 rounded-md p-1 gap-0.5">
                        <button
                            type="button"
                            onClick={() => setView("month")}
                            className={`p-1.5 rounded transition-all ${view === "month"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                }`}
                            title="Month View"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("week")}
                            className={`p-1.5 rounded transition-all ${view === "week"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                }`}
                            title="Week View"
                        >
                            <CalendarIcon className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("agenda")}
                            className={`p-1.5 rounded transition-all ${view === "agenda"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                }`}
                            title="Agenda View"
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>

                    <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
                        Today
                    </Button>

                    <Button onClick={() => { setQuickAddDate(new Date()); setQuickAddOpen(true); }}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Task
                    </Button>
                </div>
            </div>

            {/* Quick Add Popover */}
            <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>
                            Quick Add Task - {quickAddDate ? format(quickAddDate, "EEEE, MMM d") : ""}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <Input
                            placeholder="Task title..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                            autoFocus
                        />
                        <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                            <SelectTrigger>
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleQuickAdd} disabled={isSubmitting || !newTaskTitle.trim()}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Task"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Agenda View */}
            {view === "agenda" && (
                <div className="space-y-2">
                    {agendaEvents.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No upcoming tasks in the next 30 days
                        </div>
                    ) : (
                        agendaEvents.map((event) => (
                            <Link
                                key={event.id}
                                href={`/campaigns/tasks/viewtask/${event.id}`}
                                className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                                <div className="text-center min-w-[60px]">
                                    <div className="text-2xl font-bold">{format(event.dueDateAt, "d")}</div>
                                    <div className="text-xs text-muted-foreground uppercase">{format(event.dueDateAt, "MMM")}</div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Circle
                                            className={`h-2 w-2 shrink-0 ${priorityColors[event.priority || "normal"]}`}
                                            fill="currentColor"
                                        />
                                        <span className="font-medium">{event.title}</span>
                                    </div>
                                    {event.projectTitle && (
                                        <div className="text-xs text-muted-foreground mt-0.5">{event.projectTitle}</div>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {format(event.dueDateAt, "EEEE")}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            )}

            {/* Month/Week Calendar Grid */}
            {(view === "month" || view === "week") && (
                <div className="rounded-xl border border-border/50 overflow-hidden bg-background/50">
                    {/* Week days header */}
                    <div className="grid grid-cols-7 bg-muted/50 border-b border-border/50">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <div
                                key={day}
                                className="p-3 text-center text-sm font-medium text-muted-foreground"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7">
                        {viewDays.map((day, idx) => {
                            const dayEvents = getEventsForDay(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isCurrentDay = isToday(day);

                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleDayClick(day)}
                                    className={`min-h-[100px] border-b border-r border-border/30 p-2 cursor-pointer hover:bg-muted/30 transition-colors ${!isCurrentMonth && view === "month" ? "bg-muted/20 text-muted-foreground" : ""
                                        } ${isCurrentDay ? "bg-primary/5" : ""}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div
                                            className={`text-sm font-medium ${isCurrentDay
                                                ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                                                : ""
                                                }`}
                                        >
                                            {format(day, "d")}
                                        </div>
                                        <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="space-y-1">
                                        {dayEvents.slice(0, view === "week" ? 5 : 3).map((event) => (
                                            <Link
                                                key={event.id}
                                                href={`/campaigns/tasks/viewtask/${event.id}`}
                                                className="block"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex items-center gap-1 text-xs p-1 rounded bg-muted/50 hover:bg-muted transition-colors truncate">
                                                    <Circle
                                                        className={`h-2 w-2 shrink-0 ${priorityColors[event.priority || "normal"] ||
                                                            "bg-muted-foreground"
                                                            }`}
                                                        fill="currentColor"
                                                    />
                                                    <span className="truncate">{event.title}</span>
                                                </div>
                                            </Link>
                                        ))}
                                        {dayEvents.length > (view === "week" ? 5 : 3) && (
                                            <div className="text-xs text-muted-foreground px-1">
                                                +{dayEvents.length - (view === "week" ? 5 : 3)} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Circle className="h-3 w-3 text-red-500" fill="currentColor" />
                    <span>High/Critical</span>
                </div>
                <div className="flex items-center gap-2">
                    <Circle className="h-3 w-3 text-yellow-500" fill="currentColor" />
                    <span>Normal</span>
                </div>
                <div className="flex items-center gap-2">
                    <Circle className="h-3 w-3 text-green-500" fill="currentColor" />
                    <span>Low</span>
                </div>
                <div className="text-xs ml-auto">Click on any day to add a task</div>
            </div>
        </div>
    );
}

