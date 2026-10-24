"use client";

import { useState, useEffect } from "react";
import {
    Phone,
    StickyNote,
    CheckSquare,
    Users,
    ChevronUp,
    ChevronDown,
    X,
    Maximize2,
    Minimize2,
    ChevronRight,
    Calendar,
    GraduationCap,
    Sparkles,
    Copy,
    PhoneCall,
    Target,
    Zap,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLearn } from "@/components/providers/learn-provider";
import { TAB_LABELS, TAB_COLORS } from "@/components/ui/LearnLink";
import { getTeamCreditsInfo } from "@/actions/crm/credits";
import { switchTeam, getAvailableContexts } from "@/actions/teams/switch-team";
import DialerPanel from "@/app/(routes)/crm/dialer/DialerPanel";
import dynamic from "next/dynamic";
const ChatApp = dynamic(() => import("@/app/(routes)/varuni/components/Chat"), { ssr: false });
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export default function UtilityBar() {
    const [isMinimized, setIsMinimized] = useState(false);
    const [notes, setNotes] = useState("");
    const [tasks, setTasks] = useState<{ id: string, text: string, completed: boolean, priority: 'low' | 'normal' | 'medium' | 'high' | 'critical' }[]>([]);
    const [creditsInfo, setCreditsInfo] = useState<{
        teamSlug?: string;
        used: number;
        remaining: number;
        monthlyLimit: number;
        isUnlimited: boolean;
        displayString: string;
    } | null>(null);
    const { activeTab, overviewTitle, overviewWhat, overviewWhy, overviewHow } = useLearn();
    const router = useRouter();
    const [isLearnOpen, setIsLearnOpen] = useState(false);
    const [isDialerOpen, setIsDialerOpen] = useState(false);
    const [isVaruniOpen, setIsVaruniOpen] = useState(false);
    const [contextInfo, setContextInfo] = useState<{ options: any[], currentTeamId: string | null, isImpersonating: boolean } | null>(null);
    const [isContextSwitcherOpen, setIsContextSwitcherOpen] = useState(false);

    useEffect(() => {
        const fetchCredits = async () => {
            try {
                const info = await getTeamCreditsInfo();
                setCreditsInfo({
                    teamSlug: (info as any).teamSlug,
                    used: (info as any).used || 0,
                    remaining: (info as any).remaining || 0,
                    monthlyLimit: info.monthlyLimit || 0,
                    isUnlimited: info.isUnlimited || false,
                    displayString: (info as any).displayString || "???",
                });
            } catch (err) {
                setCreditsInfo(null);
            }
        };
        const fetchContexts = async () => {
            try {
                const ctx = await getAvailableContexts();
                if (ctx?.success) {
                    setContextInfo(ctx);
                }
            } catch (err) {
                // ignore
            }
        };
        fetchCredits();
        fetchContexts();
        const intervalId = setInterval(fetchCredits, 15000);

        const savedNotes = localStorage.getItem("crm-utility-notes");
        if (savedNotes) setNotes(savedNotes);

        const savedTasks = localStorage.getItem("crm-utility-tasks");
        if (savedTasks) {
            try {
                setTasks(JSON.parse(savedTasks));
            } catch (e) {
                setTasks([]);
            }
        }
        
        return () => clearInterval(intervalId);
    }, []);

    const saveNotes = (val: string) => {
        setNotes(val);
        localStorage.setItem("crm-utility-notes", val);
    };

    const addTask = () => {
        const newTasks: any[] = [...tasks, { id: Math.random().toString(), text: "", completed: false, priority: 'normal' }];
        setTasks(newTasks);
        localStorage.setItem("crm-utility-tasks", JSON.stringify(newTasks));
    };

    const updateTask = (id: string, text: string) => {
        const newTasks = tasks.map(t => t.id === id ? { ...t, text } : t);
        setTasks(newTasks);
        localStorage.setItem("crm-utility-tasks", JSON.stringify(newTasks));
    };

    const toggleTask = (id: string) => {
        const newTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        setTasks(newTasks);
        localStorage.setItem("crm-utility-tasks", JSON.stringify(newTasks));
    };

    const removeTask = (id: string) => {
        const newTasks = tasks.filter(t => t.id !== id);
        setTasks(newTasks);
        localStorage.setItem("crm-utility-tasks", JSON.stringify(newTasks));
    };

    return (
        <TooltipProvider>
            <div className="relative shrink-0 hidden md:block">
                {/* The Main Utility Bar */}
                <div className={cn(
                    "w-full bg-background/80 backdrop-blur-md border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out",
                    isMinimized ? "h-0 opacity-0 overflow-hidden pointer-events-none" : "h-12 opacity-100"
                )}>
                <div className="h-full grid grid-cols-[auto_1fr_auto] items-center px-2">
                        <div className="flex items-center gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsMinimized(true)}
                                        className="h-8 w-8 p-0 hover:bg-muted"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Minimize Utility Bar</TooltipContent>
                            </Tooltip>
                            <div className="h-4 w-px bg-border mx-1" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:inline">
                                Utility Bar
                            </span>
                            
                            {/* Context Switcher Popover */}
                            {contextInfo && (contextInfo.options.length > 1 || contextInfo.isImpersonating) && (
                                <>
                                    <div className="h-4 w-px bg-border mx-1 hidden lg:block" />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Popover open={isContextSwitcherOpen} onOpenChange={setIsContextSwitcherOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "relative gap-2 px-4 h-8 rounded-full overflow-hidden group transition-all duration-500",
                                                            "bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-purple-500/10",
                                                            "border border-indigo-500/20 hover:border-indigo-500/40",
                                                            "text-indigo-400 font-bold uppercase tracking-[0.2em] text-[10px]",
                                                            "hover:scale-[1.02] active:scale-95 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
                                                            isContextSwitcherOpen && "from-indigo-500/20 to-purple-500/20 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)] text-indigo-300"
                                                        )}
                                                    >
                                                        <div className="relative flex items-center justify-center w-4 h-4">
                                                            <Target className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-300" />
                                                        </div>
                                                        <span className="hidden lg:inline">
                                                            {(() => {
                                                                if (!contextInfo.isImpersonating) return "Switch View";
                                                                const activeOpt = contextInfo.options.find(o => o.id === contextInfo.currentTeamId);
                                                                if (activeOpt?.type === "COMPANY") return "Company Mode";
                                                                if (activeOpt?.type === "DEPARTMENT") return "Department Mode";
                                                                return "View: Switched";
                                                            })()}
                                                        </span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden" side="top" align="start" sideOffset={12}>
                                                    <div className="p-4 border-b border-border/50 bg-muted/10">
                                                        <h4 className="font-bold text-xs uppercase tracking-tight text-indigo-400">Context Switcher</h4>
                                                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                                                            Change your active workspace view between available departments and organizations.
                                                        </p>
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        {contextInfo.options.map((opt: any) => {
                                                            const isActive = !contextInfo.isImpersonating && opt.type === "HOME" || contextInfo.currentTeamId === opt.id;
                                                            return (
                                                                <button
                                                                    key={opt.id}
                                                                    onClick={async () => {
                                                                        await switchTeam(opt.type === "HOME" ? null : opt.id);
                                                                        setIsContextSwitcherOpen(false);
                                                                        router.refresh();
                                                                    }}
                                                                    className={cn(
                                                                        "w-full text-left px-3 py-2 text-xs font-semibold rounded-md transition-colors",
                                                                        isActive 
                                                                            ? "bg-indigo-500/20 text-indigo-400 cursor-default"
                                                                            : "hover:bg-muted text-foreground"
                                                                    )}
                                                                >
                                                                        <div className="flex items-center justify-between">
                                                                            <span>{opt.type === "HOME" ? (opt.isDepartment ? "Department Mode" : "Company Mode") : opt.name}</span>
                                                                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                                                        </div>
                                                                    <div className="text-[9px] text-muted-foreground uppercase opacity-70 mt-0.5 tracking-wider">
                                                                        {opt.type}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Switch organizational context.</TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                            {/* LeadGen Credits Widget */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-border/50 cursor-pointer hover:bg-muted/80 transition-colors group">
                                                <Sparkles className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground whitespace-nowrap leading-none">
                                                        L-GEN: <span className="text-foreground">{creditsInfo ? creditsInfo.displayString : "Loading..."}</span>
                                                    </span>
                                                    {creditsInfo && !creditsInfo.isUnlimited && creditsInfo.monthlyLimit > 0 && (
                                                        <div className="w-full h-[3px] rounded-full bg-muted/30 overflow-hidden min-w-[60px]">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-colors duration-700 ease-out",
                                                                    creditsInfo.remaining / creditsInfo.monthlyLimit > 0.5
                                                                        ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                                                                        : creditsInfo.remaining / creditsInfo.monthlyLimit > 0.2
                                                                            ? "bg-gradient-to-r from-amber-500 to-orange-400"
                                                                            : "bg-gradient-to-r from-red-500 to-pink-500"
                                                                )}
                                                                style={{ width: `${Math.max(2, (creditsInfo.remaining / creditsInfo.monthlyLimit) * 100)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-0 border-border shadow-2xl bg-popover/95 backdrop-blur-xl" side="top" align="center" sideOffset={12}>
                                            <div className="p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">LeadGen Credits</p>
                                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                                                {creditsInfo?.isUnlimited ? "Unlimited Plan" : "Monthly Allocation"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {creditsInfo && !creditsInfo.isUnlimited && (
                                                    <div className="space-y-1">
                                                        <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${(creditsInfo.used / creditsInfo.monthlyLimit) * 100}%` }} />
                                                        </div>
                                                        <div className="flex justify-between text-[9px] text-muted-foreground uppercase font-black">
                                                            <span>{creditsInfo.used} Used</span>
                                                            <span>{creditsInfo.remaining} Available</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">LeadGen Credit status and AI usage limits.</TooltipContent>
                            </Tooltip>

                            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                            {/* Calendar Link */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/crm/calendar">
                                        <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-500 transition-colors px-2 sm:px-3">
                                            <Calendar className="h-4 w-4" />
                                            <span className="hidden lg:inline">Calendar</span>
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="top">Access full temporal command center.</TooltipContent>
                            </Tooltip>

                            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                            {/* Quick Notes Popover */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold hover:bg-amber-500/10 hover:text-amber-500 transition-colors px-2 sm:px-3">
                                                <div className="relative">
                                                    <StickyNote className="h-4 w-4" />
                                                    {notes.length > 0 && (
                                                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                                    )}
                                                </div>
                                                <span className="hidden lg:inline">Quick Notes</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden" side="top" align="center" sideOffset={12}>
                                            <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-md bg-amber-500/10">
                                                        <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xs uppercase tracking-tight">Scratchpad</h4>
                                                        <p className="text-[10px] text-muted-foreground">Session workspace</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted text-muted-foreground" onClick={() => navigator.clipboard.writeText(notes)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500" onClick={() => saveNotes("")}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <textarea
                                                    className="w-full h-48 bg-muted/40 rounded-lg p-3 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/30 border border-border/50 placeholder:text-muted-foreground/30 font-medium leading-relaxed"
                                                    placeholder="Jot down quick thoughts..."
                                                    value={notes}
                                                    onChange={(e) => saveNotes(e.target.value)}
                                                    spellCheck={false}
                                                />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">Session-based ephemeral scratchpad.</TooltipContent>
                            </Tooltip>

                            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                            {/* Checklist Popover */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="sm" className="gap-2 text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors px-2 sm:px-3">
                                                <div className="relative">
                                                    <CheckSquare className="h-4 w-4" />
                                                    {tasks.filter(t => !t.completed).length > 0 && (
                                                        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="hidden lg:inline">Checklist</span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden" side="top" align="center" sideOffset={12}>
                                            <div className="p-4 border-b border-border/50 bg-muted/10">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-md bg-emerald-500/10">
                                                            <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-xs uppercase tracking-tight">Quick Checklist</h4>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {tasks.length > 0 ? `${tasks.filter(t => t.completed).length} of ${tasks.length} completed` : "No active tasks"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full" onClick={addTask}>
                                                        <span className="text-sm font-bold">+</span>
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="max-h-72 overflow-y-auto p-4 space-y-2">
                                                {tasks.map((task) => (
                                                    <div key={task.id} className="group space-y-2 p-2 rounded-lg hover:bg-muted/30">
                                                        <div className="flex items-start gap-2">
                                                            <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} className="mt-1 h-3.5 w-3.5 rounded border-border bg-transparent text-emerald-500" />
                                                            <input type="text" value={task.text} onChange={(e) => updateTask(task.id, e.target.value)} className={cn("flex-1 bg-transparent border-none p-0 text-xs focus:ring-0", task.completed && "line-through text-muted-foreground")} placeholder="Task..." />
                                                            <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 text-rose-500/50 hover:text-rose-500">
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                                                            {['low', 'normal', 'medium', 'high', 'critical'].map((p) => (
                                                                <button
                                                                    key={p}
                                                                    className={cn(
                                                                        "h-4 px-1.5 rounded text-[8px] font-black uppercase transition-all",
                                                                        task.priority === p ? "bg-emerald-500 text-emerald-50 shadow-sm" : "bg-muted text-muted-foreground/30 hover:text-muted-foreground"
                                                                    )}
                                                                    onClick={() => {
                                                                        const newTasks = tasks.map(t => t.id === task.id ? { ...t, priority: p as any } : t);
                                                                        setTasks(newTasks);
                                                                        localStorage.setItem("crm-utility-tasks", JSON.stringify(newTasks));
                                                                    }}
                                                                >
                                                                    {p[0]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">Personal objective tracker.</TooltipContent>
                            </Tooltip>

                        </div>

                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                            {/* Learn Button */}
                            {activeTab && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Popover open={isLearnOpen} onOpenChange={setIsLearnOpen}>
                                            <PopoverTrigger asChild>
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 cursor-pointer transition-colors shadow-sm">
                                                    <GraduationCap className="h-3.5 w-3.5" />
                                                    <span className="text-xs font-semibold hidden sm:inline">Learn About Page</span>
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4 border-border bg-popover/95 backdrop-blur-xl shadow-2xl" side="top" align="end" sideOffset={12}>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${TAB_COLORS[activeTab]} flex items-center justify-center`}>
                                                            <GraduationCap className="w-4 h-4 text-primary-foreground" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground uppercase tracking-tight">{overviewTitle || TAB_LABELS[activeTab]}</p>
                                                            <p className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest">Tactical Brief</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setIsLearnOpen(false)} className="text-muted-foreground/20 hover:text-muted-foreground/60">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="space-y-4 mb-4">
                                                    {overviewWhat && (
                                                        <div className="space-y-1">
                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Objective</h4>
                                                            <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">{overviewWhat}</p>
                                                        </div>
                                                    )}
                                                    {overviewWhy && (
                                                        <div className="space-y-1">
                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Strategic Value</h4>
                                                            <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">{overviewWhy}</p>
                                                        </div>
                                                    )}
                                                    {overviewHow && (
                                                        <div className="space-y-1">
                                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Execution Protocol</h4>
                                                            <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">{overviewHow}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 h-8 text-[10px] font-black uppercase border-border"
                                                        onClick={() => {
                                                            setIsLearnOpen(false);
                                                            router.push(`/crm/university?tab=${activeTab}`);
                                                        }}
                                                    >
                                                        Open University
                                                    </Button>
                                                    <Button size="sm" className={`flex-1 h-8 text-[10px] font-black uppercase border-none bg-gradient-to-r ${TAB_COLORS[activeTab]} shadow-lg`} onClick={() => setIsLearnOpen(false)}>
                                                        Acknowledged
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Operational intelligence briefing.</TooltipContent>
                                </Tooltip>
                            )}


                            <div className="h-4 w-px bg-border mx-1 hidden lg:block" />

                            {/* Dialer Popover */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Popover open={isDialerOpen} onOpenChange={setIsDialerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "relative gap-2 px-4 h-8 rounded-full overflow-hidden group transition-all duration-500",
                                                    "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10",
                                                    "border border-emerald-500/20 hover:border-emerald-500/40",
                                                    "text-emerald-400 font-bold uppercase tracking-[0.2em] text-[10px]",
                                                    "hover:scale-[1.02] active:scale-95 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
                                                    isDialerOpen && "from-emerald-500/20 to-teal-500/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)] text-emerald-300"
                                                )}
                                            >
                                                {/* Shimmer Gleam Effect */}
                                                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent skew-x-[-20deg]" />

                                                {/* Subtle Radial Glow */}
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                                <div className="relative flex items-center gap-2">
                                                    <div className="relative flex items-center justify-center w-4 h-4">
                                                        <Phone className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-300" />
                                                        {/* Notice the flashing dot is gone, replaced by a static premium indicator if needed, but per request, it's removed */}
                                                    </div>
                                                    <span className="hidden lg:inline">Dialer</span>
                                                </div>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[420px] p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden" side="top" align="center" sideOffset={12}>
                                            <div className="h-[520px] overflow-y-auto w-[420px]">
                                                <DialerPanel isCompact={true} />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">Communication Terminal.</TooltipContent>
                            </Tooltip>

                            {/* Varuni Popover */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Popover open={isVaruniOpen} onOpenChange={setIsVaruniOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "relative gap-2 px-4 h-8 rounded-full overflow-hidden group transition-all duration-500",
                                                    "bg-gradient-to-br from-fuchsia-500/10 via-fuchsia-500/5 to-pink-500/10",
                                                    "border border-fuchsia-500/20 hover:border-fuchsia-500/40",
                                                    "text-fuchsia-400 font-bold uppercase tracking-[0.2em] text-[10px]",
                                                    "hover:scale-[1.02] active:scale-95 hover:shadow-[0_0_20px_rgba(217,70,239,0.15)]",
                                                    isVaruniOpen && "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.25)] text-fuchsia-300"
                                                )}
                                            >
                                                {/* Shimmer Gleam Effect */}
                                                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-fuchsia-400/10 to-transparent skew-x-[-20deg]" />

                                                {/* Subtle Radial Glow */}
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                                <div className="relative flex items-center gap-2">
                                                    <div className="relative flex items-center justify-center w-4 h-4">
                                                        <Sparkles className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform duration-300" />
                                                    </div>
                                                    <span className="hidden lg:inline">Varuni</span>
                                                </div>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[420px] p-0 border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden" side="top" align="center" sideOffset={12}>
                                            <div className="h-[520px] overflow-hidden w-[420px] flex flex-col">
                                                <ChatApp isCompact={true} />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">Varuni AI Assistant.</TooltipContent>
                            </Tooltip>

                        </div>
                    </div>
                </div>

                {/* Floating Expand Button (Circle) */}
                <div className={cn(
                    "absolute bottom-4 left-4 transition-all duration-500 z-[60]",
                    isMinimized ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-50 pointer-events-none"
                )}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setIsMinimized(false)}
                                className="w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-2 border-background"
                            >
                                <ChevronUp className="h-5 w-5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Expand Utility Bar</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    );
}
