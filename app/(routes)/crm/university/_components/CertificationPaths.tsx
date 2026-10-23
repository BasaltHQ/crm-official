"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Medal,
    CheckCircle2,
    Circle,
    Lock,
    Zap,
    GraduationCap,
    Award,
    Star,
    ArrowRight,
    Search,
    Database,
    Phone,
    Bot,
    ShieldCheck,
    TrendingUp,
    Layout,
    Users,
    Mail,
    Target,
    Workflow,
    Webhook,
    PenTool,
    Trophy,
    Crown,
    Check,
    Calculator,
    Smartphone
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, ChevronRight, Sparkles, ExternalLink, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { cn } from "@/lib/utils";
import { managePartnerProfile } from "@/actions/university/toggle-partner";
import { logUserMetric } from "@/actions/university/log-user-metric";
import { evaluateMasteryProgress } from "@/actions/university/evaluate-progress";

const PHASES = [
    { title: "The Foundation", id: "foundation", range: "0-15%", color: "text-blue-400", borderColor: "border-blue-500/20", bgColor: "bg-blue-500/10" },
    { title: "Data Pioneer", id: "data-pioneer", range: "15-35%", color: "text-cyan-400", borderColor: "border-cyan-500/20", bgColor: "bg-cyan-500/10" },
    { title: "Outreach Architect", id: "outreach-architect", range: "35-60%", color: "text-emerald-400", borderColor: "border-emerald-500/20", bgColor: "bg-emerald-500/10" },
    { title: "Automation Specialist", id: "automation-specialist", range: "60-85%", color: "text-violet-400", borderColor: "border-violet-500/20", bgColor: "bg-violet-500/10" },
    { title: "Strategic Master", id: "strategic-master", range: "85-100%", color: "text-amber-400", borderColor: "border-amber-500/20", bgColor: "bg-amber-500/10" },
];

const MILESTONES = [
    {
        id: 1, phase: "foundation", title: "System Onboarding", subtitle: "Getting settled in", icon: Users, xp: 50,
        requirements: [
            { text: "Upload a personal avatar/profile picture", flagKey: "avatar", done: true, href: "/profile" },
            { text: "Configure your personal time zone", flagKey: "timezone", done: true, href: "/profile" },
            { text: "Navigate to the main CRM Dashboard", flagKey: "dashboard", done: true, href: "/crm/dashboard" }
        ]
    },
    {
        id: 2, phase: "foundation", title: "The Communicator", subtitle: "Digital presence", icon: Layout, xp: 50,
        requirements: [
            { text: "Configure your personal email signature", flagKey: "signature", done: false, href: "/profile?tab=signature" },
            { text: "Send a direct internal message to a peer", flagKey: "message", done: false, href: "/messages" },
            { text: "Review your personal notification settings", flagKey: "notifications", done: false, href: "/profile?tab=notifications" }
        ]
    },
    {
        id: 3, phase: "foundation", title: "Data Entry Novice", subtitle: "Core records", icon: Users, xp: 100,
        requirements: [
            { text: "Create a new Lead or Contact manually", flagKey: "lead_created", done: false, href: "/crm/leads" },
            { text: "Add a comprehensive note to a profile", flagKey: "note_created", done: false, href: "/crm/leads" },
            { text: "Update an existing contact's details", flagKey: "contact_updated", done: false, href: "/crm/contacts" }
        ]
    },
    {
        id: 4, phase: "foundation", title: "Task Manager", subtitle: "Daily operations", icon: Layout, xp: 100,
        requirements: [
            { text: "Create a new Task with a specific due date", flagKey: "created_task", done: false, href: "/projects/tasks" },
            { text: "Mark a scheduled activity as completed", flagKey: "completed_task", done: false, href: "/projects/tasks" },
            { text: "Link a follow-up task to an Opportunity", flagKey: "linked_task", done: false, href: "/crm/opportunities" }
        ]
    },
    {
        id: 5, phase: "foundation", title: "Insight Seeker", subtitle: "Navigating data", icon: ShieldCheck, xp: 150,
        requirements: [
            { text: "Use global search to locate a record", flagKey: "global_search", done: false, href: "/crm/dashboard" },
            { text: "Apply a custom filter to a Contact list view", flagKey: "custom_filter", done: false, href: "/crm/contacts" },
            { text: "Pin or bookmark a frequently visited page", flagKey: "bookmark", done: false, href: "/crm/dashboard" }
        ]
    },
    // Data Pioneer
    {
        id: 6, phase: "data-pioneer", title: "Opportunity Hunter", subtitle: "Pipeline basics", icon: Search, xp: 200,
        requirements: [
            { text: "Create your first Deal/Opportunity", flagKey: "opportunity_created", done: false, href: "/crm/opportunities" },
            { text: "Assign an estimated revenue value", flagKey: "opportunity_contact", done: false, href: "/crm/opportunities" },
            { text: "Move an Opportunity to a new pipeline stage", flagKey: "opportunity_moved", done: false, href: "/crm/opportunities" }
        ]
    },
    {
        id: 7, phase: "data-pioneer", title: "Pipeline Organizer", subtitle: "Visual control", icon: Database, xp: 250,
        requirements: [
            { text: "View and filter the Kanban opportunity board", flagKey: "kanban_filtered", done: false, href: "/crm/opportunities" },
            { text: "Add a specific tag or label to a deal", flagKey: "opportunity_tagged", done: false, href: "/crm/opportunities" },
            { text: "Log a 'Next Step' description for a prospect", flagKey: "opportunity_next_step", done: false, href: "/crm/opportunities" }
        ]
    },
    {
        id: 8, phase: "data-pioneer", title: "Engagement Specialist", subtitle: "Direct outreach", icon: Star, xp: 150,
        requirements: [
            { text: "Connect your email account for outbound", flagKey: "email_connected", done: false, href: "/profile?tab=integration" },
            { text: "Send a tracked email directly from the CRM", flagKey: "email_sent", done: false, href: "/crm/leads" },
            { text: "Create a basic email template for quick use", flagKey: "email_template", done: false, href: "/emails" }
        ]
    },
    {
        id: 9, phase: "data-pioneer", title: "Meeting Coordinator", subtitle: "Time management", icon: Zap, xp: 300,
        requirements: [
            { text: "Connect your external calendar to the CRM", flagKey: "calendar_connected", done: false, href: "/profile?tab=integration" },
            { text: "Generate and send a meeting booking link", flagKey: "meeting_link", done: false, href: "/crm/calendar" },
            { text: "Log the outcome notes of a completed meeting", flagKey: "meeting_note", done: false, href: "/crm/calendar" }
        ]
    },
    {
        id: 10, phase: "data-pioneer", title: "Collaboration Pro", subtitle: "Team synergy", icon: ShieldCheck, xp: 200,
        requirements: [
            { text: "Mention (@tag) a team member in a record", flagKey: "mention_user", done: false, href: "/crm/leads" },
            { text: "Reassign a lead or task to another user", flagKey: "reassign_record", done: false, href: "/crm/leads" },
            { text: "Share a specific CRM record link internally", flagKey: "share_record", done: false, href: "/crm/opportunities" }
        ]
    },
    // Outreach Architect
    {
        id: 11, phase: "outreach-architect", title: "Campaign Contributor", subtitle: "Scaled action", icon: Mail, xp: 200,
        requirements: [
            { text: "Add a targeted contact to an active campaign", flagKey: "campaign_contact_added", done: false, href: "/campaigns" },
            { text: "Review the performance metrics of a sequence", flagKey: "campaign_metrics_reviewed", done: false, href: "/campaigns" },
            { text: "Pause or modify a specific prospect's state", flagKey: "prospect_state_modified", done: false, href: "/crm/leads" }
        ]
    },
    {
        id: 12, phase: "outreach-architect", title: "Data Hygiene Champion", subtitle: "Clean records", icon: TrendingUp, xp: 500,
        requirements: [
            { text: "Identify and successfully merge a duplicate", flagKey: "duplicate_merged", done: false, href: "/crm/leads" },
            { text: "Fill out missing information on 10 records", flagKey: "records_enriched_10", done: false, href: "/crm/contacts" },
            { text: "Disqualify or archive stale, unresponsive leads", flagKey: "stale_leads_archived", done: false, href: "/crm/leads" }
        ]
    },
    {
        id: 13, phase: "outreach-architect", title: "Lead Wizard Apprentice", subtitle: "Sourcing intel", icon: PenTool, xp: 150,
        requirements: [
            { text: "Review output from an AI-generated lead pool", flagKey: "lead_pool_reviewed", done: false, href: "/crm/lead-pools" },
            { text: "Save an Ideal Customer Profile (ICP) filter", flagKey: "icp_filter_saved", done: false, href: "/crm/lead-pools" },
            { text: "Read an auto-enriched company profile view", flagKey: "company_profile_viewed", done: false, href: "/crm/accounts" }
        ]
    },
    {
        id: 14, phase: "outreach-architect", title: "Command Operator", subtitle: "Queue execution", icon: CheckCircle2, xp: 300,
        requirements: [
            { text: "Access Sales Command / Power Dialer mode", flagKey: "dialer_accessed", done: false, href: "/crm/dialer" },
            { text: "Process 5 consecutive outreach items in queue", flagKey: "queue_processed_5", done: false, href: "/crm/dialer" },
            { text: "Drop a pre-recorded voicemail using Dialer", flagKey: "voicemail_dropped", done: false, href: "/crm/dialer" }
        ]
    },
    {
        id: 15, phase: "outreach-architect", title: "Contract Initiator", subtitle: "Closing tools", icon: Target, xp: 400,
        requirements: [
            { text: "Generate a drafted proposal or quote", flagKey: "quote_generated", done: false, href: "/crm/quotes" },
            { text: "Send a digital document out for signature", flagKey: "contract_sent", done: false, href: "/crm/contracts" },
            { text: "Review the status of a pending agreement", flagKey: "agreement_reviewed", done: false, href: "/crm/contracts" }
        ]
    },
    // Automation Specialist
    {
        id: 16, phase: "automation-specialist", title: "FlowState Explorer", subtitle: "Understanding logic", icon: Workflow, xp: 600,
        requirements: [
            { text: "Navigate to the Automations & Rules builder", flagKey: "workflows_visited", done: false, href: "/crm/workflows" },
            { text: "Review the nodes of an active automated flow", flagKey: "workflow_nodes_reviewed", done: false, href: "/crm/workflows" },
            { text: "Trigger a workflow via a manual CRM action", flagKey: "workflow_triggered", done: false, href: "/crm/leads" }
        ]
    },
    {
        id: 17, phase: "automation-specialist", title: "Routine Optimizer", subtitle: "Saving time", icon: Zap, xp: 450,
        requirements: [
            { text: "Process 20+ leads simultaneously via bulk edit", flagKey: "bulk_edit_20", done: false, href: "/crm/leads" },
            { text: "Create a macro or quick-action shortcut", flagKey: "macro_created", done: false, href: "/profile?tab=signature" },
            { text: "Customize a widget dashboard for your metrics", flagKey: "widget_customized", done: false, href: "/crm/dashboard" }
        ]
    },
    {
        id: 18, phase: "automation-specialist", title: "Pipeline Forecaster", subtitle: "Predictive insight", icon: Workflow, xp: 500,
        requirements: [
            { text: "Review your projected revenue forecast report", flagKey: "forecast_reviewed", done: false, href: "/reports" },
            { text: "Ensure active deals have accurate probability", flagKey: "deal_probability_set", done: false, href: "/crm/opportunities" },
            { text: "Successfully win a deal worth over $1,000", flagKey: "won_deal_1000", done: false, href: "/crm/opportunities" }
        ]
    },
    {
        id: 19, phase: "automation-specialist", title: "AI Assistant User", subtitle: "AI acceleration", icon: Phone, xp: 400,
        requirements: [
            { text: "Use AI to draft a contextual email response", flagKey: "ai_email_drafted", done: false, href: "/messages" },
            { text: "Request an AI summary of a lengthy thread", flagKey: "ai_thread_summary", done: false, href: "/messages" },
            { text: "Use the Prompts Lab to generate outreach copy", flagKey: "used_prompt_lab", done: false, href: "/crm/university?tab=prompts" }
        ]
    },
    {
        id: 20, phase: "automation-specialist", title: "Success Advocate", subtitle: "Post-sale care", icon: Webhook, xp: 550,
        requirements: [
            { text: "Transition a won deal into an active Customer", flagKey: "won_deal_to_customer", done: false, href: "/crm/opportunities" },
            { text: "Create or respond to an internal Support Case", flagKey: "support_case_handled", done: false, href: "/crm/cases" },
            { text: "Log a detailed check-in call with a client", flagKey: "client_checkin_logged", done: false, href: "/crm/contacts" }
        ]
    },
    // Strategic Master
    {
        id: 21, phase: "strategic-master", title: "Elite Closer", subtitle: "Top performance", icon: ShieldCheck, xp: 750,
        requirements: [
            { text: "Close won 5 or more deals in a single quarter", flagKey: "closed_5_deals", done: false, href: "/crm/opportunities" },
            { text: "Maintain a win-rate above the standard average", flagKey: "win_rate_above_avg", done: false, href: "/reports" },
            { text: "Successfully reactivate a previously lost deal", flagKey: "reactivated_lost_deal", done: false, href: "/crm/opportunities" }
        ]
    },
    {
        id: 22, phase: "strategic-master", title: "Platform Mentor", subtitle: "Guiding others", icon: Users, xp: 600,
        requirements: [
            { text: "Complete an advanced CRM training module", flagKey: "completed_training_module", done: false, href: "/crm/university?tab=compliance" },
            { text: "Document a best practice in a team channel", flagKey: "documented_best_practice", done: false, href: "/messages" },
            { text: "Have a personal template adopted by a peer", flagKey: "template_adopted", done: false, href: "/emails" }
        ]
    },
    {
        id: 23, phase: "strategic-master", title: "Data Detective", subtitle: "Deep analysis", icon: Trophy, xp: 1000,
        requirements: [
            { text: "Build a custom analytics report query", flagKey: "custom_report_built", done: false, href: "/reports" },
            { text: "Export a cross-object segmented data list", flagKey: "segmented_list_exported", done: false, href: "/databox" },
            { text: "Identify a drop-off point in the sales funnel", flagKey: "funnel_dropoff_identified", done: false, href: "/reports" }
        ]
    },
    {
        id: 24, phase: "strategic-master", title: "Revenue Driver", subtitle: "Consistent value", icon: TrendingUp, xp: 1200,
        requirements: [
            { text: "Hit active sales activity targets for two months", flagKey: "hit_activity_targets", done: false, href: "/reports" },
            { text: "Uncover an upsell opportunity from an account", flagKey: "upsell_uncovered", done: false, href: "/crm/accounts" },
            { text: "Achieve an average deal closure time under 14 days", flagKey: "closure_under_14_days", done: false, href: "/reports" }
        ]
    },
    {
        id: 25, phase: "strategic-master", title: "CRM Grandmaster", subtitle: "Ultimate mastery", icon: GraduationCap, xp: 2500,
        requirements: [
            { text: "Log 500+ total logged communications", flagKey: "logged_500_comms", done: false, href: "/reports" },
            { text: "Demonstrate high customer satisfaction metrics", flagKey: "high_csat_metrics", done: false, href: "/reports" },
            { text: "Maintain perfect CRM data hygiene for 30 days", flagKey: "hygiene_30_days", done: false, href: "/crm/dashboard" }
        ]
    },
];



const STAGE_WEIGHTS: Record<string, number> = {
    "Step 7: Qualify": 0,
    "Step 8: Nurture": 10,
    "Step 8: Deep-Dive": 20,
    "Step 8: Quote": 40,
    "Step 9: Invoice": 60,
    "Step 10: Close Won": 100,
};
const STAGES = Object.keys(STAGE_WEIGHTS);

function clamp(min: number, val: number, max: number) {
    return Math.max(min, Math.min(max, val));
}

export default function CertificationPaths({ userLevel = 1, user, dynamicFlags = {} }: { userLevel?: number, user?: any, dynamicFlags?: Record<string, boolean> }) {
    const router = useRouter();
    const [currentLevel, setCurrentLevel] = React.useState<number>(userLevel);
    const [flags, setFlags] = React.useState<Record<string, boolean>>(dynamicFlags);
    const [verifyingKey, setVerifyingKey] = React.useState<string | null>(null);
    const [syncing, setSyncing] = React.useState<boolean>(false);

    React.useEffect(() => {
        setCurrentLevel(userLevel);
    }, [userLevel]);

    React.useEffect(() => {
        setFlags(dynamicFlags);
    }, [dynamicFlags]);

    const [stage, setStage] = React.useState<string>("Step 10: Close Won");
    const [touches, setTouches] = React.useState<string>("3");
    const [daysToBooking, setDaysToBooking] = React.useState<string>("7");
    
    // Partner Form State
    const [isPartner, setIsPartner] = React.useState<boolean>(user?.partner_profile?.is_active || false);
    const [partnerForm, setPartnerForm] = React.useState({
        agency_name: user?.partner_profile?.agency_name || "",
        website: user?.partner_profile?.website || "",
        calendar_url: user?.partner_profile?.calendar_url || "",
        bio: user?.partner_profile?.bio || "",
    });
    const [partnerStatus, setPartnerStatus] = React.useState<"idle" | "saving" | "success" | "error">("idle");

    const handleSyncProgress = async () => {
        setSyncing(true);
        try {
            const res = await evaluateMasteryProgress(user?.id);
            if (res && !("error" in res)) {
                setCurrentLevel(res.level || currentLevel);
                setFlags(res.flags || flags);
                if (res.leveledUp) {
                    toast.success(`Rank Up! You reached Clearance Level ${res.level}!`);
                } else {
                    toast.success("Mastery progress synced with live CRM records.");
                }
                router.refresh();
            }
        } catch (err) {
            toast.error("Failed to sync progress.");
        } finally {
            setSyncing(false);
        }
    };

    const handleVerifyTask = async (e: React.MouseEvent, flagKey: string, text: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (verifyingKey) return;
        setVerifyingKey(flagKey);
        try {
            await logUserMetric(flagKey);
            const res = await evaluateMasteryProgress(user?.id);
            if (res && !("error" in res)) {
                setCurrentLevel(res.level || currentLevel);
                setFlags(res.flags || { ...flags, [flagKey]: true });
                if (res.leveledUp) {
                    toast.success(`Milestone Complete! Advanced to Level ${res.level}!`);
                } else {
                    toast.success(`Verified: ${text}`);
                }
                router.refresh();
            } else {
                setFlags((prev) => ({ ...prev, [flagKey]: true }));
                toast.success(`Verified: ${text}`);
            }
        } catch (err) {
            toast.error("Could not verify requirement.");
        } finally {
            setVerifyingKey(null);
        }
    };

    const simulatorResult = React.useMemo(() => {
        const base = STAGE_WEIGHTS[stage] || 0;
        const t = Number(touches) || 0;
        const d = Number(daysToBooking);
        let effBonus = 0;
        let speedBonus = 0;
        if (stage === "Step 10: Close Won") {
            effBonus = clamp(0, (3 - t) / 10, 0.3);
            if (!Number.isNaN(d)) speedBonus = clamp(0, (14 - d) / 20, 0.7);
        }
        const total = Math.round(base * (1 + effBonus) * (1 + speedBonus));
        return { base, effBonusPct: Math.round(effBonus * 100), speedBonusPct: Math.round(speedBonus * 100), total };
    }, [stage, touches, daysToBooking]);

    const totalRequirements = MILESTONES.reduce((acc, m) => acc + m.requirements.length, 0);
    const completedRequirements = MILESTONES.reduce((acc, m) => {
        if (m.id < currentLevel) return acc + m.requirements.length;
        if (m.id === currentLevel) {
            return acc + m.requirements.filter((r) => !!flags[r.flagKey]).length;
        }
        return acc;
    }, 0);
    const progressPct = Math.round((completedRequirements / totalRequirements) * 100);

    const totalXp = MILESTONES.reduce((acc, m) => {
        if (m.id < currentLevel) return acc + m.xp;
        if (m.id === currentLevel) {
            const doneRatio = m.requirements.filter((r) => !!flags[r.flagKey]).length / m.requirements.length;
            return acc + Math.round(m.xp * doneRatio);
        }
        return acc;
    }, 0);

    const maxTotalXp = MILESTONES.reduce((acc, m) => acc + m.xp, 0);

    return (
        <div className="space-y-6 pb-4">
            {/* Overall Mastery Progress & XP Summary Bar */}
            <Card className="bg-black/50 border-white/10 overflow-hidden">
                <CardContent className="p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-lg shrink-0">
                            L{currentLevel}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-base font-black text-white uppercase tracking-tight">
                                    {MILESTONES.find((m) => m.id === currentLevel)?.title || `Level ${currentLevel}`}
                                </h4>
                                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                    {totalXp.toLocaleString()} / {maxTotalXp.toLocaleString()} XP
                                </Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {completedRequirements} of {totalRequirements} operational requirements verified across 5 Mastery Phases ({progressPct}% complete).
                            </p>
                        </div>
                    </div>

                    <div className="w-full lg:w-96 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <span>Curriculum Completion</span>
                            <span className="text-primary">{progressPct}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSyncProgress}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-200 transition-colors shrink-0 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 text-primary", syncing && "animate-spin")} />
                        {syncing ? "Syncing..." : "Sync Progress"}
                    </button>
                </CardContent>
            </Card>

            {/* Matrix of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
                {PHASES.map((phase) => (
                    <div key={phase.id} className="space-y-6">
                        <div className="space-y-1 px-2 border-l-2 border-white/10 pl-4">
                            <h3 className={cn("text-lg font-black uppercase tracking-[0.1em]", phase.color)}>
                                {phase.title}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                {phase.range} Achievement Tier
                            </p>
                        </div>

                        <div className="space-y-6">
                            {MILESTONES.filter(m => m.phase === phase.id).map((milestone) => {
                                const locked = isLocked(milestone, currentLevel, user);

                                // If the milestone is below currentLevel, it's done.
                                // If the milestone is the currentLevel, calculate dynamically from flags.
                                const requirements = milestone.requirements.map(req => {
                                    if (milestone.id < currentLevel) return { ...req, done: true };
                                    if (milestone.id === currentLevel) {
                                        const isReqDone = !!flags[req.flagKey];
                                        return { ...req, done: isReqDone };
                                    }
                                    return { ...req, done: false };
                                });

                                const allReqsDone = requirements.every(r => r.done);
                                const allDone = milestone.id < currentLevel || (milestone.id === currentLevel && allReqsDone);
                                const doneCount = requirements.filter(r => r.done).length;
                                const totalCount = requirements.length;

                                return (
                                    <motion.div
                                        key={milestone.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        whileHover={!locked ? { y: -5 } : {}}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    >
                                        <Card className={cn(
                                            "relative overflow-hidden transition-colors duration-300 border bg-black/40 group",
                                            allDone
                                                ? "border-emerald-500/40 bg-emerald-500/[0.03] shadow-[0_0_25px_rgba(16,185,129,0.05)]"
                                                : locked
                                                    ? "border-white/5 opacity-30 grayscale"
                                                    : "border-white/10 hover:border-white/30 hover:bg-white/[0.04] shadow-xl"
                                        )}>
                                            <CardHeader className="p-4 pb-2">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-500",
                                                        allDone
                                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 rotate-[360deg]"
                                                            : locked
                                                                ? "bg-white/5 border-white/5 text-gray-700"
                                                                : "bg-white/5 border-white/10 text-gray-400 group-hover:border-primary/50 group-hover:text-primary"
                                                    )}>
                                                        {allDone ? (
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        ) : locked ? (
                                                            <Lock className="w-4 h-4" />
                                                        ) : (
                                                            <milestone.icon className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black text-gray-600 block uppercase tracking-widest leading-none">Level</span>
                                                        <span className="text-sm font-black text-white leading-none block mt-1">{milestone.id}</span>
                                                        {!locked && (
                                                            <div className="mt-1 flex items-center gap-1 justify-end text-[10px] font-black text-amber-500">
                                                                <Zap className="w-2.5 h-2.5" />
                                                                {milestone.xp}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <CardTitle className={cn(
                                                        "text-sm font-black tracking-tight flex items-center gap-2",
                                                        locked ? "text-gray-600" : "text-gray-100"
                                                    )}>
                                                        {milestone.title}
                                                    </CardTitle>
                                                    <CardDescription className="text-[10px] font-medium leading-tight mt-1">
                                                        {milestone.subtitle}
                                                    </CardDescription>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-4 pt-4 space-y-4 relative z-10">
                                                {/* Checklist */}
                                                <div className="space-y-2">
                                                    {requirements.map((req, ridx) => {
                                                        const isClickable = !!req.href;
                                                        const canVerify = milestone.id === currentLevel && !req.done;
                                                        const isVerifying = verifyingKey === req.flagKey;
                                                        const innerContent = (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    disabled={!canVerify || isVerifying}
                                                                    onClick={(e) => canVerify && handleVerifyTask(e, req.flagKey, req.text)}
                                                                    title={canVerify ? "Click to verify & mark complete" : undefined}
                                                                    className={cn(
                                                                        "w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                                                                        req.done
                                                                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                                                            : canVerify
                                                                                ? "border-primary/50 bg-primary/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 cursor-pointer"
                                                                                : isClickable
                                                                                    ? "border-white/20 bg-white/5 group-hover/item:border-white/40 group-hover/item:bg-white/10"
                                                                                    : "border-white/10 bg-white/5"
                                                                    )}
                                                                >
                                                                    {req.done && <Check className="w-2.5 h-2.5" />}
                                                                </button>
                                                                <span className={cn(
                                                                    "text-[10px] leading-snug font-bold transition-all duration-300 flex-1 flex flex-row items-center",
                                                                    req.done
                                                                        ? "text-emerald-500/60 line-through cursor-pointer hover:text-emerald-400 hover:line-through"
                                                                        : isClickable
                                                                            ? "text-primary cursor-pointer underline decoration-primary/30 hover:decoration-primary hover:text-emerald-400"
                                                                            : "text-gray-400"
                                                                )}>
                                                                    {req.text}
                                                                    {isClickable && (
                                                                        <ExternalLink className="w-3 h-3 ml-1.5 opacity-60 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
                                                                    )}
                                                                </span>
                                                            </>
                                                        );

                                                        if (isClickable) {
                                                            return (
                                                                <Link
                                                                    key={ridx}
                                                                    href={req.href}
                                                                    className="flex items-center gap-3 p-1.5 -ml-1.5 rounded-md transition-colors hover:bg-white/5 cursor-pointer group/item"
                                                                >
                                                                    {innerContent}
                                                                </Link>
                                                            );
                                                        }

                                                        return (
                                                            <div
                                                                key={ridx}
                                                                className="flex items-center gap-3 p-1.5 -ml-1.5 rounded-md transition-colors group/item"
                                                            >
                                                                {innerContent}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Local Progress Bar */}
                                                <div className="pt-2">
                                                    <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-gray-600 mb-1.5 pl-0.5">
                                                        <span>Progress</span>
                                                        <span className={allDone ? "text-emerald-500" : "text-primary"}>
                                                            {doneCount}/{totalCount} Tasks
                                                        </span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(doneCount / totalCount) * 100}%` }}
                                                            className={cn(
                                                                "h-full transition-colors duration-500",
                                                                allDone ? "bg-emerald-500" : "bg-blue-500"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </CardContent>

                                            {/* Rank-Up Shadow Decor */}
                                            <div className={cn(
                                                "absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent transition-opacity duration-700 pointer-events-none",
                                                allDone ? "opacity-100" : "opacity-0"
                                            )} />
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Mastery & Revenue Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-10 border-t border-white/5">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-4 px-4">
                                Revenue & Points Simulator
                            </h3>
                            <p className="text-gray-500 text-sm font-medium">Calculate the ROI and Mastery Points of your sales activity.</p>
                        </div>
                    </div>

                    <Card className="bg-black/60 border-white/10 overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Target Stage</label>
                                    <Select value={stage} onValueChange={(v) => setStage(v)}>
                                        <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STAGES.map((s) => (
                                                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Touches to Close</label>
                                    <Input
                                        type="number"
                                        value={touches}
                                        onChange={(e) => setTouches(e.target.value)}
                                        min={0}
                                        className="bg-white/5 border-white/10 rounded-xl h-12 [color-scheme:dark]"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 pl-1">Days to Booking</label>
                                    <Input
                                        type="number"
                                        value={daysToBooking}
                                        onChange={(e) => setDaysToBooking(e.target.value)}
                                        min={0}
                                        className="bg-white/5 border-white/10 rounded-xl h-12 [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 bg-black/40 border border-white/10 rounded-3xl relative overflow-hidden group">
                                <div className="text-center md:text-left">
                                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 leading-none">Base Value</div>
                                    <motion.div key={simulatorResult.base} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-3xl font-black text-white">
                                        {simulatorResult.base}
                                    </motion.div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 leading-none text-emerald-500">Eff. Bonus</div>
                                    <motion.div key={simulatorResult.effBonusPct} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-3xl font-black text-emerald-500">
                                        +{simulatorResult.effBonusPct}%
                                    </motion.div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 leading-none text-blue-500">Speed Multi</div>
                                    <motion.div key={simulatorResult.speedBonusPct} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="text-3xl font-black text-blue-500">
                                        +{simulatorResult.speedBonusPct}%
                                    </motion.div>
                                </div>
                                <div className="text-center md:text-left border-l border-white/5 md:pl-6 bg-gradient-to-r from-primary/5 to-transparent">
                                    <div className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mb-2 leading-none">Mastery Points</div>
                                    <motion.div key={simulatorResult.total} initial={{ scale: 1.2, color: "#fff" }} animate={{ scale: 1, color: "var(--primary)" }} className="text-4xl font-black text-primary">
                                        {simulatorResult.total}
                                    </motion.div>
                                </div>
                                {/* Background Highlight */}
                                <div className="absolute top-0 right-0 w-32 h-full bg-primary/5 -skew-x-12 transform translate-x-10 pointer-events-none transition-transform group-hover:translate-x-0" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <h4 className="text-xl font-black uppercase tracking-tight italic py-1 px-1">Gamification Rewards</h4>
                    <div className="space-y-4">
                        {[
                            { name: "Momentum Builder", badge: "10 Leads > Identify", icon: TrendingUp },
                            { name: "Human Whisperer", badge: "5 Leads > Human", icon: Users },
                            { name: "Closer x5", badge: "5 Deals Closed", icon: Trophy, special: true },
                            { name: "Speedster", badge: "Close w/in 7 days", icon: Zap },
                        ].map((ach, idx) => (
                            <motion.div
                                key={ach.name}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between group hover:bg-white/[0.05] hover:border-white/20 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2.5 rounded-xl",
                                        ach.special ? "bg-primary/20 text-primary" : "bg-white/5 text-gray-500 group-hover:text-gray-300"
                                    )}>
                                        <ach.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm tracking-tight">{ach.name}</p>
                                        <p className="text-[10px] font-black text-gray-500 group-hover:text-gray-400">{ach.badge}</p>
                                    </div>
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Current Rank & Certificate */}
            <div className="pt-8">
                <Card className={cn(
                    "border overflow-hidden relative shadow-2xl transition-all duration-700 p-12",
                    currentLevel >= 25
                        ? "bg-gradient-to-br from-amber-600/10 via-black to-blue-600/5 border-amber-500/20"
                        : "bg-gradient-to-br from-indigo-600/10 via-black to-slate-900 border-indigo-500/20"
                )}>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                        <div className="relative">
                            <div className={cn(
                                "w-28 h-28 rounded-3xl border flex items-center justify-center animate-pulse",
                                currentLevel >= 25
                                    ? "bg-amber-500/10 border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.2)]"
                                    : "bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.2)]"
                            )}>
                                {currentLevel >= 25 ? (
                                    <Crown className="w-14 h-14 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                                ) : (
                                    <Medal className="w-14 h-14 text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                                )}
                            </div>
                            <div className={cn(
                                "absolute -top-3 -right-3 w-10 h-10 rounded-full border-4 border-black flex items-center justify-center text-white font-black text-xs",
                                currentLevel >= 25 ? "bg-amber-500" : "bg-indigo-500"
                            )}>
                                L{currentLevel}
                            </div>
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <h3 className="text-3xl md:text-5xl font-black italic tracking-tight uppercase leading-none py-2 px-2">
                                {currentLevel >= 25 ? (
                                    <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Ultimate Prestige: Master</span>
                                ) : (
                                    <span className="bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
                                        Current Rank: {MILESTONES.find(m => m.id === currentLevel)?.title || "Level " + currentLevel}
                                    </span>
                                )}
                            </h3>
                            <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
                                {currentLevel >= 25
                                    ? "This certification is the culmination of technical excellence. Reaching Level 25 proves you have mastered every aspect of modern RevOps automation."
                                    : `You have successfully unlocked Clearance Level ${currentLevel}. Wear this badge proudly on your profile as you progress toward Level 25. Complete next stage requirements to rank up.`}
                            </p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                                {currentLevel >= 25 ? (
                                    ["Lvl 25 Badge", "Global Admin Status", "Prestige UI Skin", "Beta Tester Access"].map(tag => (
                                        <Badge key={tag} className="bg-amber-500/5 text-amber-500 border-amber-500/10 px-4 py-1.5 font-bold text-[11px] uppercase tracking-widest">{tag}</Badge>
                                    ))
                                ) : (
                                    [
                                        `Level ${currentLevel} Badge Unlocked`,
                                        currentLevel >= 5 ? "Digital Certificate Ready" : `Certificate Unlocks at Level 5`,
                                        `Phase: ${MILESTONES.find(m => m.id === currentLevel)?.phase || "Active"}`
                                    ].map(tag => (
                                        <Badge key={tag} className="bg-indigo-500/5 text-indigo-400 border-indigo-500/10 px-4 py-1.5 font-bold text-[11px] uppercase tracking-widest">{tag}</Badge>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 z-20">
                            {currentLevel >= 5 && (
                                <Link 
                                    href={`/crm/university/certificate`}
                                    className={cn(
                                        "px-10 py-5 text-black text-center font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-[color,background-color,border-color,transform]",
                                        currentLevel >= 25
                                            ? "bg-amber-500 hover:bg-amber-400 shadow-[0_10px_40px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95"
                                            : "bg-indigo-500 hover:bg-indigo-400 shadow-[0_10px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95"
                                    )}
                                >
                                    View Certificate
                                </Link>
                            )}
                            <button
                                onClick={() => {
                                    const rankTitle = MILESTONES.find(m => m.id === currentLevel)?.title || `Level ${currentLevel}`;
                                    const shareText = `I achieved Clearance Level ${currentLevel} (${rankTitle} — ${totalXp.toLocaleString()} XP) at BasaltCRM University!`;
                                    navigator.clipboard.writeText(shareText);
                                    toast.success("Mastery badge summary copied to clipboard!");
                                }}
                                className="flex items-center justify-center gap-2 px-10 py-5 bg-white/5 text-white font-black uppercase text-xs tracking-[0.2em] border border-white/10 rounded-2xl transition-all hover:bg-white/10 hover:border-white/30"
                            >
                                <Share2 className="w-4 h-4" />
                                Share Badge
                            </button>
                        </div>
                    </div>

                    {/* Background Decor */}
                    <div className={cn(
                        "absolute -bottom-20 -right-20 w-80 h-80 blur-[120px] pointer-events-none",
                        currentLevel >= 25 ? "bg-amber-500/5" : "bg-indigo-500/10"
                    )} />
                </Card>
            </div>

            {/* Strategic Master Partner Network Opt-In */}
            {currentLevel >= 21 && (
                <div className="pt-8">
                    <Card className="bg-black/60 border-amber-500/20 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
                        <CardHeader className="pl-8 pb-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                    <Trophy className="w-5 h-5 text-amber-500" />
                                    <CardTitle className="text-xl font-black text-white">Strategic Master Emissary Program</CardTitle>
                                </div>
                                <Link
                                    href="/partners"
                                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
                                >
                                    View Public Directory <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                            <CardDescription className="text-gray-400 max-w-2xl">
                                You have achieved Elite Status. You are now eligible to list your services as a Certified Partner on our public directory. Help other businesses architect and automate their CRM ecosystems.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pl-8 pb-8 pr-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-white/5 border border-white/10">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Agency / Brand Name</label>
                                        <Input 
                                            value={partnerForm.agency_name} 
                                            onChange={(e) => setPartnerForm(p => ({ ...p, agency_name: e.target.value }))}
                                            placeholder="Your Agency Name" 
                                            className="bg-black/50 border-white/10 h-10" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Website URL</label>
                                        <Input 
                                            value={partnerForm.website} 
                                            onChange={(e) => setPartnerForm(p => ({ ...p, website: e.target.value }))}
                                            placeholder="https://your-agency.com" 
                                            className="bg-black/50 border-white/10 h-10" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Booking Link (Calendly)</label>
                                        <Input 
                                            value={partnerForm.calendar_url} 
                                            onChange={(e) => setPartnerForm(p => ({ ...p, calendar_url: e.target.value }))}
                                            placeholder="https://calendly.com/your-name" 
                                            className="bg-black/50 border-white/10 h-10" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 flex flex-col">
                                    <div className="space-y-1.5 flex-grow">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Public Bio / Specialties</label>
                                        <textarea 
                                            className="w-full h-full min-h-[120px] p-3 rounded-md bg-black/50 border border-white/10 text-sm text-white resize-none outline-none focus:border-amber-500/50 transition-colors"
                                            value={partnerForm.bio}
                                            onChange={(e) => setPartnerForm(p => ({ ...p, bio: e.target.value }))}
                                            placeholder="I specialize in high-volume outbound architectures and predictive revenue modeling..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={async () => {
                                            const newStatus = !isPartner;
                                            setIsPartner(newStatus);
                                            const res = await managePartnerProfile("TOGGLE_STATUS", { is_active: newStatus });
                                            if (res.error) {
                                                setIsPartner(!newStatus);
                                                toast.error(res.error);
                                            } else {
                                                toast.success(newStatus ? "Profile listed on the Partner Directory!" : "Profile set to private.");
                                            }
                                        }}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-colors relative",
                                            isPartner ? "bg-amber-500" : "bg-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                                            isPartner && "translate-x-6"
                                        )} />
                                    </button>
                                    <span className={cn("text-xs font-black uppercase tracking-widest transition-colors", isPartner ? "text-amber-500" : "text-gray-500")}>
                                        {isPartner ? "Publicly Listed" : "Private (Not Listed)"}
                                    </span>
                                </div>
                                <button 
                                    onClick={async () => {
                                        setPartnerStatus("saving");
                                        const res = await managePartnerProfile("UPDATE", partnerForm);
                                        if (res.error) {
                                            setPartnerStatus("error");
                                            toast.error(res.error);
                                        } else {
                                            setPartnerStatus("success");
                                            toast.success("Partner profile updated!");
                                        }
                                        setTimeout(() => setPartnerStatus("idle"), 3000);
                                    }}
                                    className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-colors"
                                >
                                    {partnerStatus === "saving" ? "Saving..." : partnerStatus === "success" ? "Saved!" : "Update Profile"}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

const isLocked = (item: typeof MILESTONES[0], currentLevel: number = 1, user: any = null) => {
    // Current level and below are always unlocked
    if (item.id <= currentLevel) return false;

    // Level N is unlocked if Level N-1 is completely "done"
    // Since currentLevel is strictly tracked via userLevel in DB, if userLevel = 1, but they finished Level 1 tasks:
    if (currentLevel === 1 && item.id === 2) {
        // Quick dynamic check for Level 1 being done
        const lvl1Done = !!user?.avatar && true; // Assuming time zone and dashboard are inherently true
        if (lvl1Done) return false;
    }

    return item.id > currentLevel;
};

function Text({ children, className }: { children: React.ReactNode, className?: string }) {
    return <p className={className}>{children}</p>;
}
