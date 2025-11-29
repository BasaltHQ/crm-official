"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { addDays, differenceInDays, format, isAfter, isBefore, isSameDay, max, min } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, ZoomIn, ZoomOut } from "lucide-react";

// Types from server data shape
interface TaskItem {
  id: string;
  title: string;
  createdAt?: string | Date | null;
  dueDateAt?: string | Date | null;
  taskStatus?: string | null;
  priority?: string;
  section?: string | null; // section id
  assigned_user?: { id: string; name: string | null; avatar?: string | null } | null;
}

interface SectionItem {
  id: string;
  title: string;
  tasks: TaskItem[];
}

interface GanttProps {
  data: SectionItem[]; // sections with tasks
}

type Zoom = "day" | "week" | "month";

const dayWidthForZoom: Record<Zoom, number> = {
  day: 80,
  week: 60,
  month: 24,
};

const clamp = (n: number, minN: number, maxN: number) => Math.max(minN, Math.min(maxN, n));

export default function Gantt({ data }: GanttProps) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [assignee, setAssignee] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [query, setQuery] = useState("");

  // Flatten tasks and compute date range
  const { rows, startDate, endDate, assignees } = useMemo(() => {
    const rows: { sectionId: string; sectionTitle: string; tasks: (TaskItem & { start: Date; end: Date })[] }[] = [];
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    const assigneesMap = new Map<string, string | null>();

    for (const sec of data || []) {
      const rowTasks: (TaskItem & { start: Date; end: Date })[] = [];
      for (const t of sec.tasks || []) {
        const start = t.createdAt ? new Date(t.createdAt) : new Date();
        let end = t.dueDateAt ? new Date(t.dueDateAt as any) : addDays(start, 1);
        if (isBefore(end, start)) end = addDays(start, 1);
        rowTasks.push({ ...t, start, end });
        minStart = minStart ? min([minStart, start]) : start;
        maxEnd = maxEnd ? max([maxEnd, end]) : end;
        if (t.assigned_user?.id) {
          assigneesMap.set(t.assigned_user.id, t.assigned_user.name ?? null);
        }
      }
      rows.push({ sectionId: sec.id, sectionTitle: sec.title, tasks: rowTasks });
    }

    // Safety fallback if no tasks
    const startDate = minStart || new Date();
    const endDate = maxEnd || addDays(startDate, 14);

    const assignees = [{ id: "all", name: "All" }, ...Array.from(assigneesMap).map(([id, name]) => ({ id, name: name ?? "(no name)" }))];

    return { rows, startDate, endDate, assignees };
  }, [data]);

  const totalDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
  const dayWidth = dayWidthForZoom[zoom];
  const gridWidth = totalDays * dayWidth;

  // Derived filter
  const filteredRows = useMemo(() => {
    const matches = (t: TaskItem & { start: Date; end: Date }) => {
      if (assignee !== "all" && t.assigned_user?.id !== assignee) return false;
      if (status !== "all") {
        if (status === "active" && t.taskStatus === "COMPLETE") return false;
        if (status === "complete" && t.taskStatus !== "COMPLETE") return false;
      }
      if (priority !== "all") {
        const p = (t.priority || "").toLowerCase();
        if (p !== priority) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
    return rows.map(r => ({
      ...r,
      tasks: r.tasks.filter(matches)
    }));
  }, [rows, assignee, status, priority, query]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll to today position initially
    const todayIndex = differenceInDays(new Date(), startDate);
    const x = clamp(todayIndex * dayWidth - 200, 0, gridWidth);
    containerRef.current?.scrollTo({ left: x, behavior: "smooth" });
  }, [startDate, dayWidth, gridWidth]);

  const headerDays = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(startDate, i)), [startDate, totalDays]);

  return (
    <div className="flex flex-col w-full">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Select value={zoom} onValueChange={v => setZoom(v as Zoom)}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Zoom" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setZoom(prev => (prev === "month" ? "month" : prev === "week" ? "month" : "week"))} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(prev => (prev === "day" ? "day" : prev === "week" ? "day" : "week"))} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              {assignees.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks" className="w-[220px]" />
          <Button variant="ghost" onClick={() => { setAssignee("all"); setStatus("all"); setPriority("all"); setQuery(""); }}>Clear</Button>
        </div>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> {format(startDate, "LLL d, yyyy")} – {format(endDate, "LLL d, yyyy")}</div>
      </div>

      {/* Grid */}
      <div className="relative w-full overflow-auto border rounded-md" ref={containerRef}>
        {/* Header timeline */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex" style={{ width: gridWidth }}>
            {headerDays.map((d, i) => (
              <div key={i} className={cn("h-10 border-b border-r flex items-center justify-center text-xs whitespace-nowrap overflow-hidden", isSameDay(d, new Date()) && "bg-muted/50 font-semibold")}
                   style={{ width: dayWidth }}>
                {zoom === "month" ? format(d, "d") : zoom === "week" ? (dayWidth >= 50 ? format(d, "EEE d") : format(d, "d")) : format(d, "EEE d")}
              </div>
            ))}
          </div>
        </div>

        {/* Rows per section */}
        <div>
          {filteredRows.map((row) => (
            <div key={row.sectionId} className="border-b">
              {/* Section header */}
              <div className="sticky left-0 z-10 flex items-center gap-2 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 py-1">
                <div className="text-sm font-medium">{row.sectionTitle}</div>
                <Badge variant="secondary">{row.tasks.length} tasks</Badge>
              </div>
              {/* Tasks layer */}
              <div className="relative" style={{ width: gridWidth, height: Math.max(40, row.tasks.length * 34 + 12) }}>
                {/* vertical day lines */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="flex" style={{ width: gridWidth }}>
                    {headerDays.map((d, i) => (
                      <div key={i} className={cn("h-full border-r", isSameDay(d, new Date()) && "bg-muted/30")}
                           style={{ width: dayWidth }} />
                    ))}
                  </div>
                </div>
                {/* task bars */}
                <div className="absolute left-0 top-0">
                  {row.tasks.map((t, idx) => {
                    const startIdx = clamp(differenceInDays(t.start, startDate), 0, totalDays - 1);
                    const endIdx = clamp(differenceInDays(t.end, startDate), 0, totalDays - 1);
                    const x = startIdx * dayWidth + 2;
                    const w = Math.max(dayWidth * (endIdx - startIdx + 1) - 4, 12);
                    const y = 6 + idx * 34;
                    const overdue = t.taskStatus !== "COMPLETE" && isAfter(new Date(), t.end);
                    const priorityTone = (t.priority || "").toLowerCase();
                    return (
                      <div key={t.id} className="absolute" style={{ transform: `translate(${x}px, ${y}px)` }}>
                        <div className={cn(
                          "group rounded-md border px-2 py-1 text-xs shadow-sm cursor-pointer select-none transition-colors",
                          overdue ? "bg-red-50 border-red-300" : priorityTone === "high" ? "bg-rose-50 border-rose-300" : priorityTone === "low" ? "bg-emerald-50 border-emerald-300" : "bg-primary/10 border-primary/30"
                        )} style={{ width: w }} title={`${t.title} (${format(t.start, 'LLL d')} – ${format(t.end, 'LLL d')})`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate font-medium">{t.title || "Untitled"}</div>
                            <div className="shrink-0 flex items-center gap-1">
                              {t.assigned_user?.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.assigned_user.avatar} alt="avatar" className="h-4 w-4 rounded-full border" />
                              ) : t.assigned_user?.name ? (
                                <div className="h-4 w-4 rounded-full bg-muted text-[9px] grid place-items-center border">
                                  {(t.assigned_user.name || "").slice(0, 1).toUpperCase()}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{format(t.start, zoom === "month" ? "LLL d" : "LLL d")}</span>
                            <span>→</span>
                            <span>{format(t.end, zoom === "month" ? "LLL d" : "LLL d")}</span>
                            {overdue && <Badge variant="destructive">Overdue</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Today line */}
        <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: differenceInDays(new Date(), startDate) * dayWidth }}>
          <div className="h-10" />
          <div className="w-[2px] bg-red-500/60 h-full" />
        </div>
      </div>
    </div>
  );
}
