"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import fetcher from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
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
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Loader2,
    Circle,
    Plus,
    Calendar as CalendarIcon,
    List,
    LayoutGrid,
    Clock,
    CheckCircle2,
    ArrowRight,
    History,
    LayoutDashboard,
    Users,
    Zap,
    Target,
    Search,
    X,
    ExternalLink,
    Video,
    MapPin,
    Mail,
    FileText,
    CalendarPlus
} from "lucide-react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    addDays,
} from "date-fns";
import Link from "next/link";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { priorities, statuses } from "../../tasks/data/data";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import useDebounce from "@/hooks/useDebounce";

type Props = { userId: string };

type CalendarView = "month" | "week" | "agenda";

import { useDraggable, useDroppable } from "@dnd-kit/core";

interface TaskEvent {
    id: string;
    title: string;
    dueDateAt: Date;
    priority?: string;
    projectTitle?: string;
    projectId?: string;
    taskStatus?: string;
    assignedUserId?: string;
    createdBy?: string;
    leadId?: string;
    opportunityId?: string;
    accountId?: string;
    contactId?: string;
    // Google Calendar event properties
    isGoogleEvent?: boolean;
    googleColor?: { background: string; foreground: string };
    googleLink?: string;
    googleMeetLink?: string;
    location?: string;
}

const StatusDot = ({ priority, size = "md" }: { priority?: string, size?: "sm" | "md" | "lg" }) => {
    const colors: Record<string, string> = {
        low: "bg-emerald-500",
        normal: "bg-sky-500",
        medium: "bg-amber-500",
        high: "bg-orange-500",
        critical: "bg-rose-500",
    };

    const sizes: Record<string, string> = {
        sm: "h-1.5 w-1.5",
        md: "h-2 w-2",
        lg: "h-3 w-3",
    };

    const shadows: Record<string, string> = {
        low: "shadow-[0_0_4px_rgba(16,185,129,0.3)]",
        normal: "shadow-[0_0_4px_rgba(14,165,233,0.3)]",
        medium: "shadow-[0_0_4px_rgba(245,158,11,0.3)]",
        high: "shadow-[0_0_4px_rgba(249,115,22,0.3)]",
        critical: "shadow-[0_0_4px_rgba(244,63,94,0.3)]",
    };

    return (
        <div className={cn(
            "rounded-full shrink-0",
            colors[priority || "normal"] || colors.normal,
            sizes[size],
            shadows[priority || "normal"] || shadows.normal
        )} />
    );
};

function getPriorityBadgeVariant(priority: string) {
    const p = priority?.toLowerCase();
    if (p === "critical") return "destructive";
    if (p === "high") return "outline"; // We'll style high/medium/normal specifically to match dots
    if (p === "medium") return "default";
    if (p === "low") return "secondary";
    return "default";
}


const DraggableTask = ({ event, isMonthView }: { event: TaskEvent, isMonthView: boolean }) => {
    const isGoogle = !!event.isGoogleEvent;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: event.id,
        data: event,
        disabled: isGoogle,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
                <div
                    ref={setNodeRef}
                    style={style}
                    {...(isGoogle ? {} : listeners)}
                    {...(isGoogle ? {} : attributes)}
                    className={cn(
                        "mb-1 group/task",
                        isGoogle ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                    )}
                >
                    {isGoogle ? (
                        <a
                            href={event.googleLink || "#"}
                            target={event.googleLink ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className="block"
                            onClick={(e) => {
                                if (!event.googleLink) e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <div className="flex items-center gap-1.5 text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors truncate border border-primary/20">
                                <div
                                    className="h-1.5 w-1.5 rounded-full shrink-0 shadow-sm"
                                    style={{ backgroundColor: event.googleColor?.background || '#4285f4' }}
                                />
                                <span className="truncate font-medium">{event.title}</span>
                            </div>
                        </a>
                    ) : (
                        <Link
                            href={`/projects/tasks/viewtask/${event.id}`}
                            className="block"
                            onClick={(e) => {
                                if (isDragging) e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <div className="flex items-center gap-1.5 text-xs p-1 rounded bg-muted/60 hover:bg-muted transition-colors truncate border border-transparent hover:border-primary/20">
                                <StatusDot priority={event.priority} size="sm" />
                                <span className="truncate">{event.title}</span>
                            </div>
                        </Link>
                    )}
                </div>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-80 p-0 border-primary/20 bg-background/95 backdrop-blur-2xl shadow-2xl z-[100]">
                {isGoogle ? (
                    <>
                        <div
                            className="h-1 w-full"
                            style={{ backgroundColor: event.googleColor?.background || '#4285f4' }}
                        />
                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold leading-tight">{event.title}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50">
                                        Google Calendar Event
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 h-4 border-primary/30 text-primary">
                                    Calendar
                                </Badge>
                            </div>

                            <div className="space-y-2 pt-1 border-t border-border/50 text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                    <span>{format(event.dueDateAt, "PPp")}</span>
                                </div>
                                {event.projectTitle && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <CalendarIcon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                        <span className="truncate">{event.projectTitle}</span>
                                    </div>
                                )}
                                {event.location && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Target className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                        <span className="truncate">{event.location}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                {event.googleMeetLink && (
                                    <Button
                                        asChild
                                        variant="default"
                                        size="sm"
                                        className="h-7 px-3 text-[10px] font-black uppercase tracking-widest flex-1 rounded-lg"
                                    >
                                        <a href={event.googleMeetLink} target="_blank" rel="noopener noreferrer">
                                            Join Meet
                                        </a>
                                    </Button>
                                )}
                                {event.googleLink && (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-3 text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary/20 text-primary border border-primary/20 flex-1 rounded-lg"
                                    >
                                        <a href={event.googleLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                            <span>Open Event</span>
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`h-1 w-full bg-primary/20 ${event.priority === 'high' || event.priority === 'critical' ? 'bg-rose-500/50' : ''}`} />
                        <div className="p-4 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold leading-none">{event.title}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50">
                                        Task Blueprint
                                    </p>
                                </div>
                                <Badge
                                    variant={getPriorityBadgeVariant(event.priority || "normal") as any}
                                    className={cn(
                                        "text-[9px] uppercase font-black px-1.5 h-4",
                                        event.priority?.toLowerCase() === 'high' && "bg-orange-500/15 text-orange-500 border-orange-500/20",
                                        event.priority?.toLowerCase() === 'medium' && "bg-amber-500/15 text-amber-500 border-amber-500/20"
                                    )}
                                >
                                    {event.priority}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/60">Squad Role</span>
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-3 w-3 text-primary/60" />
                                        <span className="text-[10px] font-bold">Assigned</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/60">Milestone</span>
                                    <div className="flex items-center gap-1.5">
                                        <Target className="h-3 w-3 text-primary/60" />
                                        <span className="text-[10px] font-bold truncate max-w-[100px]">{event.projectTitle || "Private"}</span>
                                    </div>
                                </div>
                            </div>

                            {event.taskStatus && (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "h-1.5 w-1.5 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]",
                                            event.taskStatus === 'COMPLETE' ? "bg-emerald-500 shadow-emerald-500/30" :
                                                event.taskStatus === 'ACTIVE' ? "bg-sky-500 shadow-sky-500/30" : "bg-amber-500 shadow-amber-500/30"
                                        )} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{event.taskStatus}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-40">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-[10px] font-black">{format(event.dueDateAt, "HH:mm")}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary/20 text-primary border border-primary/20 flex-1 rounded-lg"
                                >
                                    <Link href={`/projects/tasks/viewtask/${event.id}`}>
                                        Dossier
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 flex-1 rounded-lg"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toast.promise(
                                            axios.put(`/api/projects/tasks/update-task/${event.id}`, {
                                                taskStatus: "COMPLETED"
                                            }),
                                            {
                                                loading: 'Updating status...',
                                                success: () => {
                                                    mutate("/api/projects/tasks");
                                                    return 'Operational success.';
                                                },
                                                error: 'Failed to update.',
                                            }
                                        );
                                    }}
                                >
                                    Execute
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </HoverCardContent>
        </HoverCard>
    );
};

const DroppableDay = ({ day, children, className, densityScale, isCurrentDay, isCurrentMonth, onClick, view }: any) => {
    const { setNodeRef, isOver } = useDroppable({
        id: format(day, 'yyyy-MM-dd'),
    });

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className={cn(
                className,
                isOver && "ring-2 ring-primary bg-primary/10 z-20",
                !isCurrentMonth && view === "month" ? "opacity-30 bg-muted/10" : `bg-${densityScale}`,
                isCurrentDay ? "ring-1 ring-primary/20 bg-primary/5" : ""
            )}
        >
            {children}
        </div>
    );
};

export default function ProjectCalendarView({ userId }: Props) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [view, setView] = useState<CalendarView>("month");
    const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [dayDetailOpen, setDayDetailOpen] = useState(false);
    const [dayDetailTab, setDayDetailTab] = useState<"view" | "event" | "task" | "ooo" | "appointment">("view");
    const [fullDialogOpen, setFullDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState("normal");
    const [newTaskStatus, setNewTaskStatus] = useState("ACTIVE");
    const [todayTasksOpen, setTodayTasksOpen] = useState(false);
    const [newTaskProjectId, setNewTaskProjectId] = useState("");
    const [newTaskDescription, setNewTaskDescription] = useState("");
    const [linkedRecordId, setLinkedRecordId] = useState("");
    const [linkedRecordType, setLinkedRecordType] = useState(""); // 'account' | 'opportunity' | 'contact' etc
    const [linkedRecordName, setLinkedRecordName] = useState("");

    // Google Event Form States
    const [eventTitle, setEventTitle] = useState("");
    const [eventStartTime, setEventStartTime] = useState("09:00");
    const [eventEndTime, setEventEndTime] = useState("10:00");
    const [eventIsAllDay, setEventIsAllDay] = useState(false);
    const [eventDescription, setEventDescription] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [eventAttendees, setEventAttendees] = useState("");
    const [eventAddMeet, setEventAddMeet] = useState(true);

    // Task Google Sync State
    const [syncTaskToGoogle, setSyncTaskToGoogle] = useState(true);
    const [taskStartTime, setTaskStartTime] = useState("10:00");
    const [taskDurationMinutes, setTaskDurationMinutes] = useState(30);

    // Out of Office Form State
    const [oooTitle, setOooTitle] = useState("Out of office");
    const [oooEndDate, setOooEndDate] = useState<Date | null>(null);
    const [oooDeclineMessage, setOooDeclineMessage] = useState("I am currently out of office and will respond upon my return.");

    // AI & Briefing States
    const [projectSearchOpen, setProjectSearchOpen] = useState(false);
    const [linkSearchOpen, setLinkSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const debouncedSearch = useDebounce(searchValue, 300);
    const [searchResults, setSearchResults] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isBriefingOpen, setIsBriefingOpen] = useState(false);
    const [briefingData, setBriefingData] = useState<{ summary: string, highValueAlerts: string[] } | null>(null);
    const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);

    // New AI Record Prep States
    const [isRecordPrepOpen, setIsRecordPrepOpen] = useState(false);
    const [recordPrepData, setRecordPrepData] = useState<{ summary: string, advice: string[], alert: string } | null>(null);
    const [isGeneratingRecordPrep, setIsGeneratingRecordPrep] = useState(false);
    const [activePrepTask, setActivePrepTask] = useState<TaskEvent | null>(null);

    // Energy Pulse State
    const [isPulseEnabled, setIsPulseEnabled] = useState(false);
    const { data: pulseData, mutate: mutatePulse } = useSWR(isPulseEnabled ? "/api/calendar/pulse" : null, fetcher, { refreshInterval: 300000 });

    // Google Calendar Range & Auto-Sync Hook
    const gcalRange = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const rangeStart = new Date(start);
        rangeStart.setDate(rangeStart.getDate() - 7);
        const rangeEnd = new Date(end);
        rangeEnd.setDate(rangeEnd.getDate() + 7);
        return {
            start: rangeStart.toISOString(),
            end: rangeEnd.toISOString(),
        };
    }, [currentMonth]);

    const {
        data: gcalData,
        isValidating: gcalValidating,
        mutate: mutateGcal,
    } = useSWR(
        `/api/calendar/events?start=${encodeURIComponent(gcalRange.start)}&end=${encodeURIComponent(gcalRange.end)}`,
        async (url: string) => {
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 404) {
                    return { ok: false, connected: false, events: [] };
                }
                return { ok: false, events: [] };
            }
            return res.json();
        },
        {
            refreshInterval: 60000,
            revalidateOnFocus: true,
            shouldRetryOnError: false,
        }
    );

    const isGoogleConnected = gcalData?.connected !== false && Array.isArray(gcalData?.events);

    const googleEvents: TaskEvent[] = useMemo(() => {
        if (!gcalData?.events || !Array.isArray(gcalData.events)) return [];
        return gcalData.events.map((ev: any) => ({
            id: `gcal_${ev.id}`,
            title: ev.summary || "(No Title)",
            dueDateAt: new Date(ev.startISO),
            priority: "normal",
            taskStatus: "GOOGLE_EVENT",
            isGoogleEvent: true,
            googleColor: ev.color || undefined,
            googleLink: ev.htmlLink || undefined,
            googleMeetLink: ev.hangoutLink || undefined,
            location: ev.location || undefined,
            projectTitle: ev.calendarSummary || undefined,
        }));
    }, [gcalData]);

    // Drag-and-Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const [activeId, setActiveId] = useState<string | null>(null);

    // Global Search API logic
    useEffect(() => {
        const fetchGlobalResults = async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) {
                setSearchResults(null);
                return;
            }
            if (!projectSearchOpen && !linkSearchOpen) return;

            setIsSearching(true);
            try {
                const response = await axios.post("/api/fulltext-search", { data: debouncedSearch });
                setSearchResults(response.data.data);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        };

        fetchGlobalResults();
    }, [debouncedSearch, projectSearchOpen, linkSearchOpen]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch all tasks
    const { data: tasksData, isLoading } = useSWR<{ tasks?: any[] }>(
        `/api/projects/tasks`,
        fetcher,
        { refreshInterval: 60000 }
    );

    // Fetch users and boards for full dialog
    const { data: userResponse } = useSWR("/api/team/members", fetcher);
    const { data: boardsData } = useSWR("/api/projects", fetcher);

    const users = userResponse?.members || [];
    const boards = boardsData?.data || [];

    // Transform tasks into events + merge Google Calendar events
    const events = useMemo(() => {
        const tasks = tasksData?.tasks || [];
        const crmEvents: TaskEvent[] = tasks
            .filter((t: any) => t.dueDateAt && t.taskStatus?.toUpperCase() !== "COMPLETE")
            .map((t: any) => ({
                id: t.id,
                title: t.title || "Untitled",
                dueDateAt: new Date(t.dueDateAt),
                priority: t.priority?.toLowerCase() || "normal",
                projectTitle: t.board?.title,
                projectId: t.board?.id,
                taskStatus: t.taskStatus,
                assignedUserId: t.assigned_user?.id || t.user,
                createdBy: t.createdBy,
                leadId: t.leadId,
                opportunityId: t.opportunityId,
                accountId: t.accountId,
                contactId: t.contactId,
            }));
        return [...crmEvents, ...googleEvents];
    }, [tasksData, googleEvents]);

    const todayTasks = useMemo(() => {
        const today = new Date();
        const todayStr = format(today, "yyyy-MM-dd");

        return events.filter(e => {
            const taskDateStr = format(e.dueDateAt, "yyyy-MM-dd");
            const isTodayMatch = taskDateStr === todayStr;
            if (!isTodayMatch) return false;

            const isAssigned = e.assignedUserId?.toString() === userId?.toString();
            const isCreator = e.createdBy?.toString() === userId?.toString();

            return isAssigned || isCreator;
        });
    }, [events, userId]);

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

    // Agenda events (for the entire selected month)
    const agendaEvents = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return events
            .filter((e) => e.dueDateAt >= start && e.dueDateAt <= end)
            .sort((a, b) => a.dueDateAt.getTime() - b.dueDateAt.getTime());
    }, [events, currentMonth]);

    const groupedAgendaEvents = useMemo(() => {
        const groups: Record<string, { date: Date, tasks: TaskEvent[] }> = {};
        agendaEvents.forEach(event => {
            const dateStr = format(event.dueDateAt, 'yyyy-MM-dd');
            if (!groups[dateStr]) {
                groups[dateStr] = {
                    date: event.dueDateAt,
                    tasks: []
                };
            }
            groups[dateStr].tasks.push(event);
        });
        return Object.values(groups);
    }, [agendaEvents]);

    const priorityColors = useMemo(() => {
        const colors: Record<string, string> = {};
        priorities.forEach(p => {
            colors[p.value] = p.dotColor || "bg-muted-foreground";
        });
        return colors;
    }, []);

    const priorityLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        priorities.forEach(p => {
            labels[p.value] = p.label;
        });
        return labels;
    }, []);



    const openCreateModal = (type: "event" | "task" | "ooo" | "appointment", targetDate?: Date) => {
        const d = targetDate || quickAddDate || new Date();
        setQuickAddDate(d);
        setOooEndDate(d);
        setDayDetailTab(type);
        setDayDetailOpen(true);
    };

    const handleDayClick = (day: Date) => {
        const dayEvents = getEventsForDay(day);
        setQuickAddDate(day);
        setOooEndDate(day);
        setSearchValue("");
        setNewTaskProjectId("");

        if (dayEvents.length > 0) {
            setDayDetailTab("view");
        } else {
            setDayDetailTab("event");
        }

        setDayDetailOpen(true);
        setNewTaskTitle("");
        setNewTaskDescription("");
        setNewTaskPriority("normal");
        setNewTaskStatus("ACTIVE");
        setEventTitle("");
        setEventDescription("");
    };

    const handleCreateGoogleEvent = async () => {
        if (!eventTitle.trim() || !quickAddDate) return;
        setIsSubmitting(true);
        try {
            let startISO: string;
            let endISO: string;

            if (eventIsAllDay) {
                const s = new Date(quickAddDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(quickAddDate);
                e.setHours(23, 59, 59, 999);
                startISO = s.toISOString();
                endISO = e.toISOString();
            } else {
                const [sh, sm] = eventStartTime.split(":").map(Number);
                const [eh, em] = eventEndTime.split(":").map(Number);
                const s = new Date(quickAddDate);
                s.setHours(sh || 9, sm || 0, 0, 0);
                const e = new Date(quickAddDate);
                e.setHours(eh || 10, em || 0, 0, 0);
                if (e <= s) {
                    e.setTime(s.getTime() + 60 * 60 * 1000);
                }
                startISO = s.toISOString();
                endISO = e.toISOString();
            }

            const attendeeList = eventAttendees
                .split(",")
                .map((x) => x.trim())
                .filter((x) => x && x.includes("@"));

            const res = await axios.post("/api/calendar/schedule", {
                title: eventTitle,
                description: eventDescription,
                start: startISO,
                end: endISO,
                location: eventLocation || (eventAddMeet ? "Google Meet" : undefined),
                attendees: attendeeList,
            });

            if (res.data?.ok) {
                toast.success("Event created on Google Calendar!");
                mutateGcal();
                setDayDetailOpen(false);
                setEventTitle("");
                setEventDescription("");
                setEventLocation("");
                setEventAttendees("");
            } else {
                toast.error(res.data?.error || "Failed to schedule event on Google Calendar");
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || "Failed to create event");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateOOO = async () => {
        if (!oooTitle.trim() || !quickAddDate) return;
        setIsSubmitting(true);
        try {
            const start = new Date(quickAddDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(oooEndDate || quickAddDate);
            end.setHours(23, 59, 59, 999);

            const res = await axios.post("/api/calendar/schedule", {
                title: `[Out of Office] ${oooTitle}`,
                description: oooDeclineMessage,
                start: start.toISOString(),
                end: end.toISOString(),
            });

            if (res.data?.ok) {
                toast.success("Out of office event scheduled on Google Calendar!");
                mutateGcal();
                setDayDetailOpen(false);
            } else {
                toast.error(res.data?.error || "Failed to schedule Out of office");
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || "Failed to schedule Out of office");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickAdd = async () => {
        if (!newTaskTitle.trim() || !quickAddDate) return;
        setIsSubmitting(true);
        try {
            await axios.post("/api/projects/tasks/create-task", {
                title: newTaskTitle,
                priority: newTaskPriority,
                taskStatus: newTaskStatus,
                dueDateAt: quickAddDate,
                content: newTaskDescription,
                user: userId,
                board: newTaskProjectId,
                accountId: linkedRecordType === 'account' ? linkedRecordId : undefined,
                opportunityId: linkedRecordType === 'opportunity' ? linkedRecordId : undefined,
                contactId: linkedRecordType === 'contact' ? linkedRecordId : undefined,
                leadId: linkedRecordType === 'lead' ? linkedRecordId : undefined,
            });

            // Also push to Google Calendar if toggle is active and Google is connected
            if (syncTaskToGoogle && isGoogleConnected) {
                try {
                    const [th, tm] = taskStartTime.split(":").map(Number);
                    const s = new Date(quickAddDate);
                    s.setHours(th || 10, tm || 0, 0, 0);
                    const e = new Date(s.getTime() + (taskDurationMinutes || 30) * 60 * 1000);

                    await axios.post("/api/calendar/schedule", {
                        title: `[Task] ${newTaskTitle}`,
                        description: newTaskDescription
                            ? `${newTaskDescription}\n\nCRM Priority: ${newTaskPriority}`
                            : `CRM Task (Priority: ${newTaskPriority})`,
                        start: s.toISOString(),
                        end: e.toISOString(),
                    });
                    mutateGcal();
                } catch (gcalErr) {
                    console.error("Failed to sync task to Google Calendar:", gcalErr);
                }
            }

            toast.success(
                syncTaskToGoogle && isGoogleConnected
                    ? "Task created & synced to Google Calendar!"
                    : "Task created!"
            );
            mutate("/api/projects/tasks");
            setDayDetailOpen(false);
            setDayDetailTab("view");
            setNewTaskTitle("");
            setLinkedRecordId("");
            setLinkedRecordType("");
            setLinkedRecordName("");
            setNewTaskStatus("ACTIVE");
            setNewTaskPriority("normal");
            setNewTaskDescription("");
        } catch (error: any) {
            toast.error(error?.response?.data || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickStatusUpdate = async (taskId: string, newStatus: string) => {
        try {
            const task = events.find(e => e.id === taskId);
            if (!task) return;

            await axios.put(`/api/projects/tasks/update-task/${taskId}`, {
                title: task.title,
                taskStatus: newStatus,
                user: userId,
                priority: task.priority
            });
            toast.success(`Task status updated to ${newStatus}`);
            mutate("/api/projects/tasks");
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleGenerateBriefing = async () => {
        setIsGeneratingBriefing(true);
        setIsBriefingOpen(true);
        try {
            const response = await axios.get("/api/calendar/briefing");
            setBriefingData(response.data);
        } catch (err) {
            console.error("Failed to generate briefing", err);
            toast.error("AI Briefing failed. Check your connection.");
        } finally {
            setIsGeneratingBriefing(false);
        }
    };

    const handleRecordPrep = async (event: TaskEvent) => {
        setActivePrepTask(event);
        setIsGeneratingRecordPrep(true);
        setIsRecordPrepOpen(true);
        try {
            const response = await axios.post("/api/calendar/record-briefing", {
                leadId: event.leadId,
                opportunityId: event.opportunityId
            });
            setRecordPrepData(response.data);
        } catch (err) {
            console.error("Failed to generate record prep", err);
            toast.error("Mission Prep failed.");
        } finally {
            setIsGeneratingRecordPrep(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const taskId = active.id as string;
        if (taskId.startsWith("gcal_")) return;

        const newDateStr = over.id as string;

        // Parse date as local midnight (not UTC) to avoid off-by-one shifts
        const [year, month, day] = newDateStr.split('-').map(Number);
        const newDate = new Date(year, month - 1, day, 0, 0, 0);

        const task = events.find(e => e.id === taskId);
        if (!task || task.isGoogleEvent) return;

        // Use string comparison for day boundaries to be safe with timezones
        const currentTaskDate = format(new Date(task.dueDateAt), 'yyyy-MM-dd');
        if (currentTaskDate === newDateStr) return;

        try {
            // Optimistic Update
            mutate("/api/projects/tasks", (current: any) => {
                const tasks = current?.tasks || [];
                return {
                    ...current,
                    tasks: tasks.map((t: any) =>
                        t.id === taskId ? { ...t, dueDateAt: newDate.toISOString() } : t
                    )
                };
            }, false);

            await axios.put(`/api/projects/tasks/update-task/${taskId}`, {
                title: task.title,
                dueDateAt: newDate, // Send local midnight
                user: userId,
                taskStatus: task.taskStatus,
                priority: task.priority
            });

            toast.success("Schedule optimized. Mission updated.");
            mutate("/api/projects/tasks");
            mutatePulse();
        } catch (error) {
            toast.error("Failed to reschedule task");
            mutate("/api/projects/tasks");
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border/50">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={navigatePrev}
                                        className="h-8 w-8 rounded-lg hover:bg-background shadow-sm"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Go back 1 {view === 'month' ? 'month' : 'week'}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className="px-3 py-1 font-black uppercase tracking-widest text-xs italic text-center min-w-[140px]">
                            {view === "week"
                                ? `Week of ${format(startOfWeek(currentMonth, { weekStartsOn: 0 }), "MMM d")}`
                                : format(currentMonth, "MMMM yyyy")}
                        </div>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={navigateNext}
                                        className="h-8 w-8 rounded-lg hover:bg-background shadow-sm"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Advance 1 {view === 'month' ? 'month' : 'week'}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 gap-1 ml-2">
                        {[
                            { id: "month" as const, label: "Month", icon: LayoutGrid, hint: "View monthly temporal grid" },
                            { id: "week" as const, label: "Week", icon: List, hint: "Detailed weekly mission breakdown" },
                            { id: "agenda" as const, label: "Agenda", icon: Clock, hint: "Strategic list of upcoming objectives" },
                        ].map((v) => (
                            <TooltipProvider key={v.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setView(v.id)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider",
                                                view === v.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <v.icon className="h-3 w-3" />
                                            <span className="hidden sm:inline">{v.label}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{v.hint}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Google Calendar Status / Quick Refresh */}
                    {isGoogleConnected ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            mutateGcal();
                                            toast.success("Google Calendar refreshed");
                                        }}
                                        disabled={gcalValidating}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-background/50 hover:bg-primary/5 transition-all text-xs group"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                            Google Cal
                                        </span>
                                        {gcalValidating && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    Google Calendar auto-synced ({googleEvents.length} events loaded). Click to refresh now.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : gcalData?.connected === false ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link
                                        href="/profile?tab=integration"
                                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-border/70 hover:border-primary/40 bg-muted/20 text-xs text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[10px] font-bold">Connect Google Cal</span>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                    Connect your Google account in Profile → Integrations to sync calendar events.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}

                    {/* Energy Pulse Widget */}
                    <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-background/50 border border-primary/10 rounded-2xl backdrop-blur-md shadow-inner group">
                        {!isPulseEnabled ? (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => { setIsPulseEnabled(true); }}
                                            className="flex items-center gap-2 group/pulse p-1 px-2 rounded-xl hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 shadow-sm"
                                        >
                                            <div className="p-1.5 rounded-lg bg-primary/5 group-hover/pulse:bg-primary/20 transition-colors">
                                                <Zap className="h-3.5 w-3.5 text-primary opacity-40 group-hover/pulse:opacity-100 transition-opacity" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-hover/pulse:text-primary transition-colors">Energy Pulse</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="w-56 p-3 border-primary/20 bg-background/95 backdrop-blur-xl rounded-xl">
                                        <p className="text-[10px] font-bold leading-relaxed">Activate Antigravity AI to sync real-time mission energy and temporal load forecasting.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : (
                            <>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Energy Pulse</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-[10px] font-black italic uppercase tracking-tight",
                                            pulseData?.loadPercent > 70 ? "text-red-500" : pulseData?.loadPercent > 40 ? "text-amber-500" : "text-emerald-500"
                                        )}>
                                            {pulseData?.status || "ANALYSING..."}
                                        </span>
                                        <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-1000",
                                                    pulseData?.loadPercent > 70 ? "bg-red-500" : pulseData?.loadPercent > 40 ? "bg-amber-500" : "bg-emerald-500"
                                                )}
                                                style={{ width: `${pulseData?.loadPercent || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => setIsPulseEnabled(false)}
                                                className="p-1.5 rounded-xl bg-primary/5 hover:bg-rose-500/10 hover:text-rose-500 transition-all cursor-pointer"
                                            >
                                                <Zap className={cn(
                                                    "h-3.5 w-3.5",
                                                    pulseData?.loadPercent > 70 ? "text-red-500 animate-pulse" : "text-primary"
                                                )} />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="w-64 p-4 border-primary/20 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl">
                                            {pulseData ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold leading-relaxed italic">"{pulseData.forecast}"</p>
                                                    <div className="h-px bg-primary/10 w-full" />
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                                        <Target className="h-3 w-3" />
                                                        Officer Suggestion:
                                                    </p>
                                                    <p className="text-[10px] font-medium text-muted-foreground">{pulseData.suggestion}</p>
                                                    <div className="pt-2">
                                                        <p className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/40">Click icon to disable AI sync</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold animate-pulse italic">Scanning load...</p>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </>
                        )}
                    </div>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={handleGenerateBriefing}
                                    className="group bg-primary hover:scale-[1.02] active:scale-95 transition-all text-primary-foreground font-black uppercase tracking-widest text-xs h-10 px-6 rounded-2xl shadow-lg shadow-primary/20 gap-2 overflow-hidden relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <Zap className="h-4 w-4 fill-primary-foreground/20 " />
                                    <span>AI Briefing</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="p-3 max-w-[200px] border-primary/20 bg-background/95 backdrop-blur-xl">
                                <p className="text-[10px] font-bold leading-tight">Generate a strategic overview of your upcoming mission schedule using Antigravity AI.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Google Calendar-Style + Create Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="rounded-2xl h-10 px-5 font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <Plus className="h-4 w-4 stroke-[2.5]" />
                                <span>Create</span>
                                <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl bg-background/95 backdrop-blur-2xl border-border/50 shadow-2xl z-[150]">
                            <DropdownMenuItem
                                onClick={() => openCreateModal("event")}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors text-xs font-bold"
                            >
                                <div className="h-6 w-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-500">
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-none">Event</span>
                                    <span className="text-[9px] text-muted-foreground font-normal mt-0.5">Google Calendar meeting</span>
                                </div>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => openCreateModal("task")}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors text-xs font-bold"
                            >
                                <div className="h-6 w-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-none">Task</span>
                                    <span className="text-[9px] text-muted-foreground font-normal mt-0.5">CRM task + optional Google sync</span>
                                </div>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => openCreateModal("ooo")}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors text-xs font-bold"
                            >
                                <div className="h-6 w-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
                                    <Clock className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-none">Out of office</span>
                                    <span className="text-[9px] text-muted-foreground font-normal mt-0.5">Mark unavailable on calendar</span>
                                </div>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1 opacity-20" />

                            <DropdownMenuItem
                                onClick={() => openCreateModal("appointment")}
                                className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors text-xs font-bold"
                            >
                                <div className="h-6 w-6 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-500">
                                    <Users className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="leading-none">Appointment schedule</span>
                                    <span className="text-[9px] text-muted-foreground font-normal mt-0.5">Booking slots & availability</span>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >

                {/* Day Detail Unified Dialog */}
                <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
                    <DialogContent className="sm:max-w-[550px] border-primary/20 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                        <div className="flex flex-col max-h-[85vh]">
                            {/* Custom Header with Toggle */}
                            <div className="p-6 pb-2 border-b border-border/10 bg-muted/10">
                                <div className="flex items-center justify-between mb-4">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black italic tracking-tighter uppercase text-primary/80 leading-none">
                                            {quickAddDate ? format(quickAddDate, "EEEE, MMM do") : "Day Schedule"}
                                        </DialogTitle>
                                        <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-50">
                                            {dayDetailTab === "view"
                                                ? "Operational Overview"
                                                : dayDetailTab === "event"
                                                ? "New Google Calendar Event"
                                                : dayDetailTab === "task"
                                                ? "New CRM Task"
                                                : dayDetailTab === "ooo"
                                                ? "Out of Office Block"
                                                : "Appointment Schedule"}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/40 gap-1 overflow-x-auto">
                                        {getEventsForDay(quickAddDate || new Date()).length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setDayDetailTab("view")}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider shrink-0",
                                                    dayDetailTab === "view"
                                                        ? "bg-primary text-primary-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                Activity ({getEventsForDay(quickAddDate || new Date()).length})
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setDayDetailTab("event")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider shrink-0",
                                                dayDetailTab === "event"
                                                    ? "bg-blue-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                            Event
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDayDetailTab("task")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider shrink-0",
                                                dayDetailTab === "task"
                                                    ? "bg-emerald-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                            Task
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDayDetailTab("ooo")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider shrink-0",
                                                dayDetailTab === "ooo"
                                                    ? "bg-amber-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                            Out of office
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDayDetailTab("appointment")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider shrink-0",
                                                dayDetailTab === "appointment"
                                                    ? "bg-purple-600 text-white shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                                            Appointment
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                                {dayDetailTab === "view" ? (
                                    <div className="space-y-4">
                                        {getEventsForDay(quickAddDate || new Date()).length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                                                <div className="h-12 w-12 rounded-full bg-muted border border-dashed border-border flex items-center justify-center">
                                                    <CalendarIcon className="h-6 w-6" />
                                                </div>
                                                <p className="text-sm font-medium italic">No active missions for this date.</p>
                                                <Button variant="outline" size="sm" className="rounded-full text-[10px] font-black uppercase" onClick={() => setDayDetailTab("event")}>
                                                    Create Event
                                                </Button>
                                            </div>
                                        ) : (
                                            getEventsForDay(quickAddDate || new Date()).map((event) => (
                                                <div key={event.id} className={cn("group relative p-4 rounded-2xl border hover:bg-muted/20 transition-all", event.isGoogleEvent ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border/30 hover:border-primary/20")}>
                                                    <div className="flex items-start justify-between gap-4 mb-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {event.isGoogleEvent ? (
                                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: event.googleColor?.background || '#4285f4' }} />
                                                                ) : (
                                                                    <StatusDot priority={event.priority} size="sm" />
                                                                )}
                                                                {event.isGoogleEvent ? (
                                                                    event.googleLink ? (
                                                                        <a href={event.googleLink} target="_blank" rel="noreferrer" className="text-sm font-bold truncate hover:text-primary transition-colors">
                                                                            {event.title}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-sm font-bold truncate">{event.title}</span>
                                                                    )
                                                                ) : (
                                                                    <Link href={`/projects/tasks/viewtask/${event.id}`} className="text-sm font-bold truncate hover:text-primary transition-colors">
                                                                        {event.title}
                                                                    </Link>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {event.isGoogleEvent ? (
                                                                    <>
                                                                        <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/30 text-primary">
                                                                            Calendar
                                                                        </Badge>
                                                                        {event.projectTitle && (
                                                                            <span className="text-[10px] text-muted-foreground truncate">
                                                                                {event.projectTitle}
                                                                            </span>
                                                                        )}
                                                                        {event.location && (
                                                                            <span className="text-[10px] text-muted-foreground truncate">
                                                                                📍 {event.location}
                                                                            </span>
                                                                        )}
                                                                        {event.googleMeetLink && (
                                                                            <a href={event.googleMeetLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">
                                                                                Join Meet
                                                                            </a>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Badge variant={getPriorityBadgeVariant(event.priority || "") as any} className="text-[8px] h-4 px-1 border-0">
                                                                            {event.priority}
                                                                        </Badge>
                                                                        {event.projectTitle && (
                                                                            <span className="text-[10px] text-muted-foreground truncate">
                                                                                in {event.projectTitle}
                                                                            </span>
                                                                        )}
                                                                        {(event.leadId || event.opportunityId) && (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-5 px-1.5 text-[8px] font-black uppercase tracking-widest border-amber-500/30 hover:bg-amber-500/10 text-amber-600 rounded-md gap-1"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleRecordPrep(event);
                                                                                }}
                                                                            >
                                                                                <Zap className="h-2.5 w-2.5 fill-amber-500/20" />
                                                                                Prep for Mission
                                                                            </Button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-1.5 bg-background/50 p-1 rounded-lg border border-border/20">
                                                            {(['ACTIVE', 'PENDING', 'COMPLETE'] as const).map((status) => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleQuickStatusUpdate(event.id, status)}
                                                                    title={`Mark as ${status}`}
                                                                    className={cn(
                                                                        "h-6 w-6 rounded flex items-center justify-center transition-all",
                                                                        event.taskStatus === status
                                                                            ? (status === 'COMPLETE' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : status === 'ACTIVE' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-amber-500 text-white shadow-lg shadow-amber-500/20")
                                                                            : "text-muted-foreground/40 hover:text-foreground hover:bg-muted"
                                                                    )}
                                                                >
                                                                    {status === 'COMPLETE' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                    {status === 'ACTIVE' && <Circle className="h-3.5 w-3.5" />}
                                                                    {status === 'PENDING' && <Clock className="h-3.5 w-3.5" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : dayDetailTab === "event" ? (
                                    <div className="space-y-5 pt-1">
                                        {/* Google Calendar Event Title */}
                                        <div className="relative group">
                                            <label className="absolute -top-2 left-3 bg-background px-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 transition-colors z-10">
                                                Event Title
                                            </label>
                                            <Input
                                                placeholder="e.g. Q3 Pipeline Review & Strategy"
                                                value={eventTitle}
                                                onChange={(e) => setEventTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleCreateGoogleEvent()}
                                                autoFocus
                                                className="h-14 text-lg font-bold bg-muted/20 border-border/50 focus:border-blue-500/50 focus:ring-blue-500/20 transition-all rounded-xl pl-4"
                                            />
                                        </div>

                                        {/* Date & Time Settings */}
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon className="h-4 w-4 text-blue-500" />
                                                    <span className="text-xs font-bold">
                                                        {quickAddDate ? format(quickAddDate, "EEEE, MMMM do, yyyy") : "Date"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">All day</span>
                                                    <Switch
                                                        checked={eventIsAllDay}
                                                        onCheckedChange={setEventIsAllDay}
                                                    />
                                                </div>
                                            </div>

                                            {!eventIsAllDay && (
                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">Start Time</label>
                                                        <Input
                                                            type="time"
                                                            value={eventStartTime}
                                                            onChange={(e) => setEventStartTime(e.target.value)}
                                                            className="h-10 bg-background/50 border-border/30 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">End Time</label>
                                                        <Input
                                                            type="time"
                                                            value={eventEndTime}
                                                            onChange={(e) => setEventEndTime(e.target.value)}
                                                            className="h-10 bg-background/50 border-border/30 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Google Meet Conferencing */}
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                    <Video className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-foreground">Google Meet</div>
                                                    <div className="text-[10px] text-muted-foreground">Add video conferencing link automatically</div>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={eventAddMeet}
                                                onCheckedChange={setEventAddMeet}
                                            />
                                        </div>

                                        {/* Location & Guests */}
                                        <div className="space-y-3">
                                            <div className="relative flex items-center">
                                                <MapPin className="absolute left-3 h-4 w-4 text-muted-foreground/60" />
                                                <Input
                                                    placeholder="Add location or room"
                                                    value={eventLocation}
                                                    onChange={(e) => setEventLocation(e.target.value)}
                                                    className="h-10 pl-9 bg-muted/20 border-border/40 text-xs rounded-xl"
                                                />
                                            </div>
                                            <div className="relative flex items-center">
                                                <Mail className="absolute left-3 h-4 w-4 text-muted-foreground/60" />
                                                <Input
                                                    placeholder="Add guests (emails separated by comma)"
                                                    value={eventAttendees}
                                                    onChange={(e) => setEventAttendees(e.target.value)}
                                                    className="h-10 pl-9 bg-muted/20 border-border/40 text-xs rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="relative group">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70 mb-1 block">Description</label>
                                            <Textarea
                                                placeholder="Add meeting notes, agenda, or context..."
                                                value={eventDescription}
                                                onChange={(e) => setEventDescription(e.target.value)}
                                                rows={3}
                                                className="bg-muted/20 border-border/40 text-xs rounded-xl resize-none"
                                            />
                                        </div>
                                    </div>
                                ) : dayDetailTab === "ooo" ? (
                                    <div className="space-y-5 pt-1">
                                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                                <CalendarPlus className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">Out of Office Block</h4>
                                                <p className="text-[11px] text-muted-foreground">Creates an Out of Office block on your Google Calendar to protect your focused time.</p>
                                            </div>
                                        </div>

                                        {/* Reason / Title */}
                                        <div className="relative group">
                                            <label className="absolute -top-2 left-3 bg-background px-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 transition-colors z-10">
                                                Out of Office Reason
                                            </label>
                                            <Input
                                                placeholder="Out of office"
                                                value={oooTitle}
                                                onChange={(e) => setOooTitle(e.target.value)}
                                                autoFocus
                                                className="h-14 text-lg font-bold bg-muted/20 border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20 transition-all rounded-xl pl-4"
                                            />
                                        </div>

                                        {/* Date confirmation */}
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="h-4 w-4 text-amber-500" />
                                                <span className="text-xs font-bold">
                                                    {quickAddDate ? format(quickAddDate, "EEEE, MMMM do, yyyy") : "Selected Day"}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-amber-500 px-2 py-0.5 rounded bg-amber-500/10">Full Day</span>
                                        </div>

                                        {/* Decline Message */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">
                                                Decline message for new invitations
                                            </label>
                                            <Textarea
                                                placeholder="Decline message (optional)..."
                                                value={oooDeclineMessage}
                                                onChange={(e) => setOooDeclineMessage(e.target.value)}
                                                rows={3}
                                                className="bg-muted/20 border-border/40 text-xs rounded-xl resize-none"
                                            />
                                        </div>
                                    </div>
                                ) : dayDetailTab === "appointment" ? (
                                    <div className="space-y-5 pt-1">
                                        <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-4 text-center">
                                            <div className="h-14 w-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto">
                                                <Clock className="h-7 w-7" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-base font-bold text-foreground">Appointment Schedules & Booking</h3>
                                                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                                    Share bookable calendar links with clients and leads so they can schedule time directly on your CRM & Google Calendar.
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                                                <Link
                                                    href="/crm/leads?tab=availability"
                                                    onClick={() => setDayDetailOpen(false)}
                                                    className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20"
                                                >
                                                    <span>Manage Availability</span>
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                                <a
                                                    href="https://calendar.google.com"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-border/50 hover:bg-muted/30 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                                                >
                                                    <span>Google Calendar</span>
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pt-2">
                                        {/* Main Input */}
                                        <div className="relative group">
                                            <label className="absolute -top-2 left-3 bg-background px-1.5 text-[10px] font-black uppercase tracking-widest text-primary/50 group-focus-within:text-primary transition-colors z-10">
                                                What's the mission?
                                            </label>
                                            <Input
                                                placeholder="e.g. Follow up with Tesla about the updated quote"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                                                autoFocus
                                                className="h-14 text-lg font-bold bg-muted/20 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl pl-4"
                                            />
                                        </div>

                                        {/* Google Calendar Sync Switch */}
                                        <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                        <CalendarPlus className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-foreground">Sync to Google Calendar</div>
                                                        <div className="text-[10px] text-muted-foreground">Also add as a scheduled event on your Google Calendar</div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={syncTaskToGoogle}
                                                    onCheckedChange={setSyncTaskToGoogle}
                                                />
                                            </div>

                                            {syncTaskToGoogle && (
                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-500/10">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">Event Time</label>
                                                        <Input
                                                            type="time"
                                                            value={taskStartTime}
                                                            onChange={(e) => setTaskStartTime(e.target.value)}
                                                            className="h-9 bg-background/50 border-border/30 rounded-lg text-xs font-semibold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-70">Duration</label>
                                                        <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-lg border border-border/40">
                                                            {[15, 30, 60].map((d) => (
                                                                <button
                                                                    key={d}
                                                                    type="button"
                                                                    onClick={() => setTaskDurationMinutes(d)}
                                                                    className={cn(
                                                                        "flex-1 py-1 text-[10px] font-bold rounded",
                                                                        taskDurationMinutes === d
                                                                            ? "bg-blue-600 text-white"
                                                                            : "text-muted-foreground hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {d}m
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row of Controls */}
                                        <div className="grid grid-cols-1 md:grid-cols-[1.5fr,0.5fr] gap-4">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-50">Priority</label>
                                                <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl border border-border/50 shadow-inner">
                                                    {priorities.map((p) => (
                                                        <button
                                                            key={p.value}
                                                            type="button"
                                                            onClick={() => setNewTaskPriority(p.value)}
                                                            className={cn(
                                                                "flex-1 py-2 px-1 rounded-lg text-[9px] font-black uppercase transition-all duration-200 border border-transparent",
                                                                newTaskPriority === p.value
                                                                    ? `${p.color.replace("text-", "bg-").replace("-500", "-500/15").replace("-600", "-600/15")} ${p.color} border-${p.color.replace("text-", "")}/20 shadow-md scale-[1.02] z-10`
                                                                    : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30"
                                                            )}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-50">Due Date</label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="w-full flex items-center justify-between h-11 px-2.5 rounded-xl bg-muted/20 border border-border/50 text-[11px] font-bold hover:bg-muted/30 transition-all group">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarIcon className="h-4 w-4 text-primary opacity-70 group-hover:opacity-100" />
                                                                <span className="text-foreground/80">{quickAddDate ? format(quickAddDate, "MMM do") : "Pick date"}</span>
                                                            </div>
                                                            <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 border-white/10 shadow-2xl" align="end" sideOffset={8}>
                                                        <Calendar
                                                            mode="single"
                                                            selected={quickAddDate || undefined}
                                                            onSelect={(date) => {
                                                                setQuickAddDate(date || new Date());
                                                            }}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>

                                        {/* Status Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 opacity-50">Initial Status</label>
                                            <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-xl border border-border/50 shadow-inner">
                                                {statuses.map((s) => (
                                                    <button
                                                        key={s.value}
                                                        type="button"
                                                        onClick={() => setNewTaskStatus(s.value)}
                                                        className={cn(
                                                            "flex-1 py-2 px-1 rounded-lg text-[9px] font-black uppercase transition-all duration-200 border border-transparent flex items-center justify-center gap-1.5",
                                                            newTaskStatus === s.value
                                                                ? `${s.color.replace("text-", "bg-").replace("-500", "-500/15")} ${s.color} border-${s.color.replace("text-", "")}/20 shadow-md scale-[1.02] z-10`
                                                                : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/30"
                                                        )}
                                                    >
                                                        <s.icon className="h-3 w-3" />
                                                        {s.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Linkage & Project Area */}
                                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-4 relative overflow-hidden group/link">
                                            <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                                                <Building2 className="h-12 w-12" />
                                            </div>
                                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 ml-1">Project & CRM Linkage</h5>

                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Project Board */}
                                                <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                                                    <PopoverTrigger asChild>
                                                        <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-background/50 border border-border/30 text-xs text-muted-foreground hover:border-primary/30 transition-all text-left">
                                                            <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="truncate flex-1">
                                                                {newTaskProjectId
                                                                    ? boards.find((b: any) => b.id === newTaskProjectId)?.title || "Standard Board"
                                                                    : "No Project (Private)"}
                                                            </span>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[320px] p-0 border-white/10 shadow-2xl" align="start">
                                                        <Command shouldFilter={false} className="bg-transparent">
                                                            <CommandInput
                                                                placeholder="Search projects..."
                                                                onValueChange={setSearchValue}
                                                                className="border-none focus:ring-0"
                                                            />
                                                            <CommandList className="max-h-[250px]">
                                                                <CommandEmpty>{isSearching ? "Searching..." : "No projects found."}</CommandEmpty>
                                                                <CommandGroup heading="Active Boards">
                                                                    <CommandItem
                                                                        onSelect={() => {
                                                                            setNewTaskProjectId("");
                                                                            setProjectSearchOpen(false);
                                                                        }}
                                                                        className="flex items-center gap-2 group"
                                                                    >
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-primary transition-colors" />
                                                                        <span className="text-muted-foreground italic">None (Private Reminder)</span>
                                                                    </CommandItem>
                                                                    {boards.slice(0, 5).map((board: any) => (
                                                                        <CommandItem
                                                                            key={board.id}
                                                                            value={board.id}
                                                                            onSelect={() => {
                                                                                setNewTaskProjectId(board.id);
                                                                                setProjectSearchOpen(false);
                                                                            }}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                            {board.title}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                                {searchResults?.projects?.length > 0 && (
                                                                    <CommandGroup heading="Search Results">
                                                                        {searchResults.projects.map((p: any) => (
                                                                            <CommandItem
                                                                                key={p.id}
                                                                                value={p.id}
                                                                                onSelect={() => {
                                                                                    setNewTaskProjectId(p.id);
                                                                                    setProjectSearchOpen(false);
                                                                                }}
                                                                            >
                                                                                {p.title}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>

                                                {/* CRM Entity */}
                                                <Popover open={linkSearchOpen} onOpenChange={setLinkSearchOpen}>
                                                    <PopoverTrigger asChild>
                                                        <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-background/50 border border-border/30 text-xs text-muted-foreground hover:border-primary/30 transition-all text-left">
                                                            {linkedRecordId ? (
                                                                <>
                                                                    {linkedRecordType === 'account' && <Building2 className="h-3 w-3 text-blue-400" />}
                                                                    {linkedRecordType === 'opportunity' && <Target className="h-3 w-3 text-purple-400" />}
                                                                    {linkedRecordType === 'contact' && <Users className="h-3 w-3 text-emerald-400" />}
                                                                    <span className="truncate flex-1 font-bold text-foreground">{linkedRecordName}</span>
                                                                    <X
                                                                        className="h-3 w-3 hover:text-red-400"
                                                                        onClick={(e: React.MouseEvent) => {
                                                                            e.stopPropagation();
                                                                            setLinkedRecordId("");
                                                                            setLinkedRecordName("");
                                                                            setLinkedRecordType("");
                                                                        }}
                                                                    />
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Search className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="truncate flex-1">Link CRM...</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[320px] p-0 border-white/10 shadow-2xl" align="end">
                                                        <Command shouldFilter={false} className="bg-transparent">
                                                            <CommandInput
                                                                placeholder="Search Accounts, Contacts, Leads..."
                                                                onValueChange={setSearchValue}
                                                            />
                                                            <CommandList className="max-h-[300px]">
                                                                <CommandEmpty>{isSearching ? "Searching vault..." : "Nothing found."}</CommandEmpty>
                                                                {searchResults?.accounts?.length > 0 && (
                                                                    <CommandGroup heading="Accounts">
                                                                        {searchResults.accounts.map((a: any) => (
                                                                            <CommandItem key={a.id} onSelect={() => {
                                                                                setLinkedRecordId(a.id);
                                                                                setLinkedRecordType('account');
                                                                                setLinkedRecordName(a.name);
                                                                                setLinkSearchOpen(false);
                                                                            }}>
                                                                                <Building2 className="mr-2 h-4 w-4 text-blue-400" />
                                                                                {a.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                                {searchResults?.contacts?.length > 0 && (
                                                                    <CommandGroup heading="Contacts">
                                                                        {searchResults.contacts.map((c: any) => (
                                                                            <CommandItem key={c.id} onSelect={() => {
                                                                                setLinkedRecordId(c.id);
                                                                                setLinkedRecordType('contact');
                                                                                setLinkedRecordName(`${c.firstName} ${c.lastName}`);
                                                                                setLinkSearchOpen(false);
                                                                            }}>
                                                                                <Users className="mr-2 h-4 w-4 text-emerald-400" />
                                                                                {c.firstName} {c.lastName}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                                {searchResults?.opportunities?.length > 0 && (
                                                                    <CommandGroup heading="Opportunities">
                                                                        {searchResults.opportunities.map((o: any) => (
                                                                            <CommandItem key={o.id} onSelect={() => {
                                                                                setLinkedRecordId(o.id);
                                                                                setLinkedRecordType('opportunity');
                                                                                setLinkedRecordName(o.title);
                                                                                setLinkSearchOpen(false);
                                                                            }}>
                                                                                <Target className="mr-2 h-4 w-4 text-purple-400" />
                                                                                {o.title}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer - Dynamic based on tab */}
                            <div className="p-6 border-t border-border/10">
                                {dayDetailTab === "view" ? (
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Events & tasks reflect current operational schedule.
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="text-xs font-black uppercase tracking-widest border-primary/20 hover:bg-primary/5 text-primary rounded-xl"
                                            onClick={() => setDayDetailOpen(false)}
                                        >
                                            Close Overview
                                        </Button>
                                    </div>
                                ) : dayDetailTab === "event" ? (
                                    <div className="flex items-center justify-between">
                                        <Button
                                            variant="ghost"
                                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                            onClick={() => setDayDetailOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            disabled={isSubmitting || !eventTitle.trim()}
                                            onClick={handleCreateGoogleEvent}
                                            className="relative group h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all shadow-xl shadow-blue-600/20 overflow-hidden"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <CalendarPlus className="h-4 w-4" />
                                                    <span>Save to Google Calendar</span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                ) : dayDetailTab === "ooo" ? (
                                    <div className="flex items-center justify-between">
                                        <Button
                                            variant="ghost"
                                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                            onClick={() => setDayDetailOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            disabled={isSubmitting || !oooTitle.trim()}
                                            onClick={handleCreateOOO}
                                            className="relative group h-12 px-8 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all shadow-xl shadow-amber-600/20 overflow-hidden"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <CalendarPlus className="h-4 w-4" />
                                                    <span>Save Out of Office</span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                ) : dayDetailTab === "appointment" ? (
                                    <div className="flex items-center justify-end">
                                        <Button
                                            variant="outline"
                                            className="text-xs font-black uppercase tracking-widest rounded-xl"
                                            onClick={() => setDayDetailOpen(false)}
                                        >
                                            Close
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <Button
                                            variant="ghost"
                                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                                            onClick={() => setDayDetailOpen(false)}
                                        >
                                            Cancel entry
                                        </Button>
                                        <Button
                                            disabled={isSubmitting || !newTaskTitle.trim()}
                                            onClick={handleQuickAdd}
                                            className="relative group h-12 px-8 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all shadow-xl shadow-primary/20 overflow-hidden"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span>Deploy mission</span>
                                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Agenda View */}
                {view === "agenda" && (
                    <div className="space-y-6">
                        {groupedAgendaEvents.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/20">
                                No tasks scheduled for {format(currentMonth, "MMMM yyyy")}
                            </div>
                        ) : (
                            groupedAgendaEvents.map((group) => {
                                const isDateToday = isToday(group.date);
                                return (
                                    <div key={format(group.date, 'yyyy-MM-dd')} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isDateToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                }`}>
                                                {format(group.date, "EEEE, MMM d")}
                                                {isDateToday && " • Today"}
                                            </div>
                                            <div className="h-px bg-border flex-1" />
                                        </div>
                                        <div className="grid gap-2">
                                            {group.tasks.map((event) => (
                                                event.isGoogleEvent ? (
                                                    <a
                                                        key={event.id}
                                                        href={event.googleLink || "#"}
                                                        target={event.googleLink ? "_blank" : undefined}
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => {
                                                            if (!event.googleLink) e.preventDefault();
                                                        }}
                                                        className={`flex items-center gap-4 p-3 rounded-xl border transition-[color,background-color,border-color,box-shadow] hover:shadow-md ${isDateToday ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/50"
                                                            }`}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="h-2 w-2 rounded-full shrink-0"
                                                                    style={{ backgroundColor: event.googleColor?.background || '#4285f4' }}
                                                                />
                                                                <span className="font-semibold">{event.title}</span>
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                                                                    Google Event
                                                                </Badge>
                                                                {event.googleMeetLink && (
                                                                    <span
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            window.open(event.googleMeetLink, "_blank", "noopener,noreferrer");
                                                                        }}
                                                                        className="text-xs text-blue-500 hover:underline cursor-pointer font-medium ml-2"
                                                                    >
                                                                        Join Meet
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {(event.projectTitle || event.location) && (
                                                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                                                                    {event.projectTitle && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="opacity-70">Calendar:</span>
                                                                            <span className="font-medium">{event.projectTitle}</span>
                                                                        </div>
                                                                    )}
                                                                    {event.location && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="opacity-70">Location:</span>
                                                                            <span className="font-medium">{event.location}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                                                    </a>
                                                ) : (
                                                    <Link
                                                        key={event.id}
                                                        href={`/projects/tasks/viewtask/${event.id}`}
                                                        className={`flex items-center gap-4 p-3 rounded-xl border transition-[color,background-color,border-color,box-shadow] hover:shadow-md ${isDateToday ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/50"
                                                            }`}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <StatusDot priority={event.priority} />
                                                                <span className="font-semibold">{event.title}</span>
                                                                <Badge variant={getPriorityBadgeVariant(event.priority || "normal") as any} className="text-[10px] h-4 px-1.5 ml-auto sm:ml-0">
                                                                    {event.priority}
                                                                </Badge>
                                                            </div>
                                                            {event.projectTitle && (
                                                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                                    <span className="opacity-70">Project:</span>
                                                                    <span className="font-medium">{event.projectTitle}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                                                    </Link>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
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
                                const density = dayEvents.length;
                                const densityScale = density === 0 ? "transparent" :
                                    density <= 2 ? "primary/5" :
                                        density <= 4 ? "primary/15" : "primary/30";

                                return (
                                    <DroppableDay
                                        key={idx}
                                        day={day}
                                        onClick={() => handleDayClick(day)}
                                        className="min-h-[120px] border-b border-r border-border/30 p-2 cursor-pointer hover:bg-muted/30 transition-all group relative"
                                        densityScale={densityScale}
                                        isCurrentDay={isCurrentDay}
                                        isCurrentMonth={isCurrentMonth}
                                        view={view}
                                    >
                                        <div className="flex items-center justify-between mb-1 relative z-10">
                                            <div
                                                className={cn(
                                                    "text-[10px] font-bold tracking-tight uppercase px-1.5 py-0.5 rounded",
                                                    isCurrentDay ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                                                )}
                                            >
                                                {format(day, "d")}
                                            </div>
                                            {density > 0 && <span className="text-[10px] font-black text-primary/40">{density}</span>}
                                        </div>
                                        <div className="space-y-1">
                                            {dayEvents.slice(0, view === "week" ? 5 : 3).map((event) => (
                                                <DraggableTask key={event.id} event={event} isMonthView={view === "month"} />
                                            ))}
                                            {dayEvents.length > (view === "week" ? 5 : 3) && (
                                                <div className="text-xs text-muted-foreground px-1">
                                                    +{dayEvents.length - (view === "week" ? 5 : 3)} more
                                                </div>
                                            )}
                                        </div>
                                    </DroppableDay>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Drag Overlay */}
                <DragOverlay dropAnimation={null}>
                    {activeId ? (
                        <div className="w-48 p-2 rounded bg-primary text-primary-foreground text-xs font-bold shadow-2xl opacity-90 scale-105 rotate-3 transition-transform pointer-events-none">
                            <div className="flex items-center gap-2">
                                <Zap className="h-3 w-3 fill-primary-foreground/20" />
                                <span className="truncate">{events.find(e => e.id === activeId)?.title}</span>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>

            </DndContext>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {Object.entries(priorityLabels)
                    .sort((a, b) => {
                        const order = ['critical', 'high', 'medium', 'normal', 'low'];
                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                    })
                    .map(([key, label]) => (
                        <div key={key} className="flex items-center gap-2 bg-muted/5 px-2.5 py-1.5 rounded-xl border border-border/20 backdrop-blur-sm">
                            <StatusDot priority={key} size="sm" />
                            <span>{label}</span>
                        </div>
                    ))}
                <div className="ml-auto italic opacity-50 lowercase tracking-tighter hidden sm:block">Click on any day to add a task</div>
            </div>

            {/* AI Daily Briefing Modal */}
            <Dialog open={isBriefingOpen} onOpenChange={setIsBriefingOpen}>
                <DialogContent className="sm:max-w-[550px] border-primary/20 bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight italic">
                            <Zap className="h-6 w-6 text-amber-500 fill-amber-500/20" />
                            AI Daily Pulse
                        </DialogTitle>
                        <DialogDescription>
                            Your personalized executive briefing for {format(new Date(), "MMMM do, yyyy")}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        {isGeneratingBriefing ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                                <p className="text-sm font-medium text-muted-foreground animate-pulse italic">
                                    Analyzing agenda & optimizing your day...
                                </p>
                            </div>
                        ) : briefingData ? (
                            <div className="space-y-6">
                                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Clock className="h-24 w-24" />
                                    </div>
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Strategic Summary</h5>
                                    <p className="text-sm leading-relaxed font-medium relative z-10">
                                        {briefingData?.summary}
                                    </p>
                                </div>

                                {briefingData?.highValueAlerts && briefingData.highValueAlerts.length > 0 && (
                                    <div className="space-y-3">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500 ml-1">Priority Insights</h5>
                                        <div className="grid gap-2">
                                            {briefingData?.highValueAlerts.map((alert, i) => (
                                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                                    <p className="text-xs font-semibold">{alert}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Engine Optimised</span>
                                    </div>
                                    <Button size="sm" onClick={() => setIsBriefingOpen(false)}>
                                        Got it, let's go
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                Failed to load daily briefing.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Record Prep (Mission Prep) Modal */}
            <Dialog open={isRecordPrepOpen} onOpenChange={setIsRecordPrepOpen}>
                <DialogContent className="sm:max-w-[500px] border-amber-500/20 bg-background/95 backdrop-blur-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tighter">
                            <div className="p-2 rounded-xl bg-amber-500/10">
                                <Target className="h-5 w-5 text-amber-500" />
                            </div>
                            Mission Prep
                        </DialogTitle>
                        <DialogDescription className="font-medium text-amber-500/70 italic">
                            Intelligence briefing for: {activePrepTask?.title}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-6">
                        {isGeneratingRecordPrep ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-500/20 blur-xl animate-pulse rounded-full" />
                                    <Loader2 className="h-12 w-12 animate-spin text-amber-500 relative z-10" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest text-amber-600 animate-pulse">
                                    Scrambling Intelligence...
                                </p>
                            </div>
                        ) : recordPrepData ? (
                            <div className="space-y-6">
                                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 relative overflow-hidden">
                                    <div className="absolute -top-4 -right-4 opacity-[0.03]">
                                        <Zap className="h-32 w-32" />
                                    </div>
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Intel Summary</h5>
                                    <p className="text-sm leading-relaxed font-bold italic">
                                        "{recordPrepData?.summary}"
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Tactical Advice</h5>
                                    {recordPrepData?.advice.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-colors">
                                            <div className="h-6 w-6 rounded-lg bg-background flex items-center justify-center text-[10px] font-black border border-border group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                0{i + 1}
                                            </div>
                                            <p className="text-xs font-semibold">{item}</p>
                                        </div>
                                    ))}
                                </div>

                                {recordPrepData?.alert && (
                                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex gap-3">
                                        <Zap className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Critical Mission Alert</h5>
                                            <p className="text-xs font-bold">{recordPrepData?.alert}</p>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-widest rounded-xl h-12 shadow-lg shadow-amber-500/20"
                                    onClick={() => setIsRecordPrepOpen(false)}
                                >
                                    Initiate Mission
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                Tactical feedback offline.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

