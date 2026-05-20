"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    Mail,
    MessageSquare,
    Phone,
    Users,
    BarChart3,
    Target,
    Calendar,
    Settings,
    Zap,
    Loader2,
    Building2,
    Send,
    Eye,
    CheckCircle2,
    Edit3,
    Package,
    FlaskConical,
    Linkedin,
    Trash2,
    Clock,
    AlertTriangle,
    Play,
    Pause,
    XCircle,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import ABTestingPanel from "@/app/(routes)/crm/leads/components/ABTestingPanel";
import LinkedInSequencePanel from "@/app/(routes)/crm/leads/components/LinkedInSequencePanel";
import { CampaignContactTracker } from "@/app/(routes)/crm/leads/components/CampaignContactTracker";

function CronJobCard({ job, toggleCronJob }: any) {
    return (
        <div
            className={`border rounded-lg p-4 transition-all ${
                job.status === "ACTIVE"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : job.status === "PAUSED"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-white/5 bg-card/50"
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{job.label || job.job_type}</span>
                        <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase ${
                                job.status === "ACTIVE"
                                    ? "border-emerald-500/30 text-emerald-400"
                                    : job.status === "PAUSED"
                                        ? "border-amber-500/30 text-amber-400"
                                        : "border-white/10 text-muted-foreground"
                            }`}
                        >
                            {job.status}
                        </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Type: <span className="text-white">{job.job_type}</span></span>
                        <span>Interval: <span className="text-white">{Math.round((job.interval_ms || 3600000) / 60000)}m</span></span>
                        <span>Runs: <span className="text-white">{job.run_count}</span></span>
                        {job.error_count > 0 && (
                            <span className="text-red-400">Errors: {job.error_count}</span>
                        )}
                        {job.last_run_at && (
                            <span>Last: <span className="text-white">{new Date(job.last_run_at).toLocaleString()}</span></span>
                        )}
                    </div>
                    {job.last_error && (
                        <p className="text-xs text-red-400 mt-1">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            {job.last_error}
                        </p>
                    )}
                </div>
                <div className="flex gap-1">
                    {job.status === "ACTIVE" && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            onClick={() => toggleCronJob(job.id, "pause")}
                        >
                            <Pause className="w-3 h-3 mr-1" /> Pause
                        </Button>
                    )}
                    {job.status === "PAUSED" && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => toggleCronJob(job.id, "resume")}
                        >
                            <Play className="w-3 h-3 mr-1" /> Resume
                        </Button>
                    )}
                    {job.status !== "COMPLETED" && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => toggleCronJob(job.id, "cancel")}
                        >
                            <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

type CampaignDetail = {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    channels: string[];
    total_leads: number;
    emails_sent: number;
    emails_opened: number;
    emails_replied?: number;
    sms_sent: number;
    sms_delivered: number;
    calls_initiated: number;
    meetings_booked: number;
    meeting_link?: string | null;
    prompt_override?: string | null;
    signature_html?: string | null;
    campaign_branding?: any;
    resource_links?: any;
    auto_reply_enabled?: boolean;
    auto_reply_max_count?: number;
    auto_reply_prompt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    assigned_user?: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
    } | null;
    assigned_pool?: {
        id: string;
        name: string;
    } | null;
    assigned_project?: {
        id: string;
        title: string;
    } | null;
    outreach_items?: {
        id: string;
        status: string;
        channel: string;
    }[];
    warmup?: {
        phase: string;
        dailyLimit: number;
        sentToday: number;
        remaining: number;
        daysActive: number;
        allowed: boolean;
        message?: string;
        senderEmail: string;
    } | null;
};


const getStatusColor = (status: string) => {
    switch (status) {
        case "ACTIVE":
            return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        case "DRAFT":
            return "bg-slate-500/10 text-slate-400 border-slate-500/20";
        case "PAUSED":
            return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case "COMPLETED":
            return "bg-blue-500/10 text-blue-500 border-blue-500/20";
        case "ARCHIVED":
            return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
        default:
            return "bg-muted/50 text-muted-foreground border-transparent";
    }
};

function WarmupCountdown() {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const nextMidnight = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() + 1,
                0, 0, 0, 0
            ));
            const diffMs = nextMidnight.getTime() - now.getTime();
            if (diffMs <= 0) {
                setTimeLeft("00:00:00");
                return;
            }
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            const pad = (n: number) => n.toString().padStart(2, "0");
            setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="font-mono font-bold text-amber-400 tracking-wider tabular-nums">
            {timeLeft}
        </span>
    );
}

export default function CampaignDetailPage() {
    const params = useParams();
    const router = useRouter();
    const campaignId = params.campaignId as string;
    const [activeTab, setActiveTab] = useState("overview");
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [autoReplyLoading, setAutoReplyLoading] = useState(false);
    const [backfillLoading, setBackfillLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [repairLoading, setRepairLoading] = useState(false);
    const [repairProgress, setRepairProgress] = useState({ current: 0, total: 0 });
    const [repairStream, setRepairStream] = useState<string>("");

    const { data: campaign, error, isLoading, mutate } = useSWR<CampaignDetail>(
        campaignId ? `/api/campaigns/${campaignId}` : null,
        fetcher,
        { revalidateOnFocus: true, refreshInterval: 10000 }
    );

    // Fetch CRON jobs when on that tab
    const { data: cronData, mutate: mutateCron } = useSWR(
        activeTab === "cron" ? `/api/cron/jobs?campaignId=${campaignId}` : null,
        fetcher,
        { refreshInterval: 15000 }
    );
    const cronJobs = (cronData as any)?.jobs?.filter?.((j: any) => j.campaign_id === campaignId) || [];
    const emailJobs = cronJobs.filter((j: any) => j.job_type === "AUTO_FOLLOWUP");
    const voiceJobs = cronJobs.filter((j: any) => j.job_type === "VOICE_BATCH");

    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
            if (res.ok) {
                const data = await res.json();
                toast.success(`Campaign deleted. ${data.cleaned?.leadsReset || 0} leads reset, ${data.cleaned?.cronJobsCancelled || 0} CRON jobs cancelled.`);
                router.push("/campaigns");
            } else {
                const err = await res.json();
                toast.error(err.message || "Delete failed");
            }
        } catch (e: any) {
            toast.error(e?.message || "Delete failed");
        }
        setDeleting(false);
        setConfirmDelete(false);
    }

    async function handleRepair() {
        if (!campaign?.assigned_pool?.id) {
            toast.error("No assigned list to repair from.");
            return;
        }
        setRepairLoading(true);
        setRepairProgress({ current: 0, total: 0 });
        setRepairStream("Initializing sequence repair... fetching list logic.");
        const toastId = toast.loading("Fetching list logic...");
        try {
            // Fetch list leads
            const res = await fetch(`/api/crm/leads/pools/${campaign.assigned_pool.id}/leads?mine=false`);
            if (!res.ok) throw new Error("Failed to load list");
            const poolData = await res.json();
            const poolLeads = Array.isArray(poolData?.leads) ? poolData.leads : [];
            const activeCandidates = Array.isArray(poolData?.candidates) ? poolData.candidates : [];
            const allLeads = [...poolLeads, ...activeCandidates];

            // Resolve emails strictly matching the FirstContactWizard structure
            const validLeads = allLeads.map((pl: any) => {
                // If it's a raw Candidate, it has email directly
                if (pl.email) return pl;

                // Otherwise, it's a Pool Lead with contact/account relations
                const contact = pl.contact;
                const acct = pl.account;
                
                if (contact) {
                    return {
                        id: contact.id, // This matches i.lead in tracking
                        firstName: contact.firstName,
                        lastName: contact.lastName,
                        company: acct?.name,
                        jobTitle: contact.jobTitle,
                        email: contact.email,
                    };
                } else if (acct) {
                    const fallback = acct.email || (acct.additional_emails && acct.additional_emails.length > 0 ? acct.additional_emails[0] : null);
                    return {
                        id: acct.id, // This matches i.account_id in tracking
                        company: acct.name,
                        email: fallback,
                        additional_emails: acct.additional_emails || [],
                    };
                }
                return null;
            }).filter((l: any) => l && !!l.email);

            // Filter out leads already in campaign
            // Outreach items could be linked via `lead` (for crm_Leads) or `account_id` (for crm_Accounts)
            const existingIds = new Set(
                (campaign.outreach_items || [])
                    .flatMap((i: any) => [i.lead, i.account_id])
                    .filter(Boolean)
            );
            const missingLeads = validLeads.filter((l: any) => !existingIds.has(l.id));

            if (missingLeads.length === 0) {
                toast.success("No missing leads found. Campaign is up to date.", { id: toastId });
                setRepairStream("No missing targets detected. Terminating repair.");
                setRepairLoading(false);
                return;
            }

            setRepairProgress({ current: 0, total: missingLeads.length });
            setRepairStream(`Engaged. Queueing ${missingLeads.length} missed targets for LLM generation.`);
            let sentCount = 0;
            const CHUNK_SIZE = 1;
            
            for (let i = 0; i < missingLeads.length; i += CHUNK_SIZE) {
                const chunk = missingLeads.slice(i, i + CHUNK_SIZE);
                toast.loading(`Processing batch ${Math.ceil((i+1)/CHUNK_SIZE)} of ${Math.ceil(missingLeads.length/CHUNK_SIZE)}...`, { id: toastId });
                
                const branding = (campaign.campaign_branding || {}) as any;

                const sendPayload = {
                    leadIds: chunk.map((l: any) => l.id),
                    leadData: chunk.map((l: any) => ({
                        id: l.id,
                        firstName: l.firstName,
                        lastName: l.lastName,
                        company: l.company,
                        jobTitle: l.jobTitle,
                        email: l.email,
                        additional_emails: l.additional_emails || l.accountAdditionalEmails || [],
                    })),
                    campaignId: campaign.id,
                    poolId: campaign.assigned_pool.id,
                    promptOverride: campaign.prompt_override || undefined,
                    templateId: branding.templateId || "minimal",
                    senderMode: branding.senderMode || "company",
                    signatureSource: branding.signatureSource || "brand",
                    themeColorOverride: branding.themeColorOverride || undefined,
                    secondaryColorOverride: branding.secondaryColorOverride || undefined,
                    resources: branding.resources || undefined,
                    templateOptions: {
                        backgroundTexture: branding.bgTexture || undefined,
                        borderAccent: branding.borderAccent || undefined,
                        cardStyle: branding.cardStyle || undefined,
                        dividerStyle: branding.dividerStyle || undefined,
                        showResources: branding.showResources ?? true,
                        bannerImageUrl: branding.bannerImageUrl || undefined,
                        bannerHeight: branding.bannerHeight || undefined,
                        bannerPositionY: branding.bannerPositionY || undefined,
                    }
                };

                const sendRes = await fetch("/api/outreach/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(sendPayload),
                });

                if (sendRes.ok) {
                    const resJson = await sendRes.json();
                    sentCount += resJson.sent || chunk.length;
                    
                    const progressState = { current: sentCount, total: missingLeads.length };
                    setRepairProgress(prev => ({ ...prev, current: sentCount }));
                    
                    let streamMessage = `Batch generated successfully.`;
                    if (resJson.results && resJson.results.length > 0) {
                        const lastResult = resJson.results[resJson.results.length - 1];
                        if (lastResult.status === "sent") {
                            streamMessage = `Generation [OK]. Delivered payload to: ${lastResult.to} (${sentCount}/${missingLeads.length})`;
                        } else {
                            streamMessage = `Bypass: ${lastResult.to} - ${lastResult.reason}`;
                        }
                    }
                    
                    setRepairStream(streamMessage);
                    // Broadcast globally to all admins via JSON metadata
                    fetch(`/api/campaigns/${campaign.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            campaignBranding: { ...branding, repair_active: true, repair_progress: progressState, repair_stream: streamMessage } 
                        }),
                    }).catch(() => {});
                } else {
                    const streamMessage = `[ERROR] Batch LLM generation failed for ${chunk.length} targets.`;
                    setRepairStream(streamMessage);
                    fetch(`/api/campaigns/${campaign.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            campaignBranding: { ...branding, repair_active: true, repair_stream: streamMessage } 
                        }),
                    }).catch(() => {});
                    toast.error(`Batch ${Math.ceil((i+1)/CHUNK_SIZE)} failed to send. Check server logs.`);
                }
            }

            if (sentCount > 0) {
                const streamMessage = `Repair sequence concluded. Successfully dispatched to ${sentCount} aliases.`;
                setRepairStream(streamMessage);
                toast.success(`Dispatched ${sentCount} missed leads successfully!`, { id: toastId });
                
                // Turn off repair tracking globally, flip active
                await fetch(`/api/campaigns/${campaign.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        status: "ACTIVE",
                        campaignBranding: { ...branding, repair_active: false, repair_stream: streamMessage, repair_progress: null } 
                    }),
                });
                mutate();
            } else {
                setRepairStream(`[ERROR] Total Sequence Failure. 0 targets hit.`);
                toast.error("Failed to dispatch repair emails", { id: toastId });
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to repair campaign", { id: toastId });
            setRepairStream(`[FATAL] Pipeline crashed: ${e?.message}`);
        }
        setRepairLoading(false);
    }

    async function toggleCronJob(jobId: string, action: "pause" | "resume" | "cancel") {
        try {
            const res = await fetch("/api/cron/jobs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId, action }),
            });
            if (res.ok) {
                toast.success(`Job ${action}d`);
                mutateCron();
            } else {
                toast.error(`Failed to ${action} job`);
            }
        } catch {
            toast.error(`Failed to ${action} job`);
        }
    }

    async function toggleAutoReply(enable: boolean) {
        setAutoReplyLoading(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/auto-reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: enable }),
            });
            if (res.ok) {
                const data = await res.json();
                mutate();
                if (enable && data.backfill_triggered > 0) {
                    toast.success(`Auto-reply enabled. Processing ${data.backfill_triggered} existing replies...`);
                } else if (enable) {
                    toast.success("Auto-reply enabled. Future replies will be handled by AI.");
                } else {
                    toast.success("Auto-reply disabled.");
                }
            } else {
                toast.error("Failed to update auto-reply settings");
            }
        } catch {
            toast.error("Failed to update auto-reply settings");
        }
        setAutoReplyLoading(false);
    }

    async function toggleCampaignStatus() {
        if (!campaign) return;
        const newStatus = campaign.status === "PAUSED" ? "ACTIVE" : "PAUSED";
        setStatusLoading(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                mutate();
                toast.success(newStatus === "PAUSED" ? "Campaign stopped. Outreach will halt within the next batch." : "Campaign resumed.");
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to update campaign status");
            }
        } catch {
            toast.error("Failed to update campaign status");
        }
        setStatusLoading(false);
    }

    async function backfillReplies() {
        setBackfillLoading(true);
        try {
            const res = await fetch(`/api/campaigns/${campaignId}/auto-reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ backfill_only: true }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.backfill_triggered > 0) {
                    toast.success(`Scanning ${data.backfill_triggered} unreplied threads...`);
                } else {
                    toast.success("No unreplied threads found. All caught up!");
                }
            } else {
                toast.error("Failed to scan replies");
            }
        } catch {
            toast.error("Failed to scan replies");
        }
        setBackfillLoading(false);
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <p className="text-red-500">Failed to load campaign</p>
                <Button variant="outline" onClick={() => router.push("/campaigns")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaigns
                </Button>
            </div>
        );
    }

    const productFocus = campaign.campaign_branding?.product_focus;
    const brandColor = campaign.campaign_branding?.primary_brand_color || "#6366f1";
    const openRate = campaign.emails_sent > 0
        ? Math.round((campaign.emails_opened / campaign.emails_sent) * 100)
        : 0;

    // Count outreach item statuses
    const itemCounts = (campaign.outreach_items || []).reduce(
        (acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    // Total auto-replies sent across all outreach items
    const autoRepliesSent = (campaign.outreach_items || []).reduce(
        (sum, item) => sum + ((item as any).auto_reply_count || 0),
        0
    );

    const branding = campaign.campaign_branding as any;
    // Never show repair/send progress for completed or paused campaigns —
    // the wizard's cleanup PATCH (repair_active: false) can fail silently.
    const campaignDone = campaign.status === "COMPLETED" || campaign.status === "PAUSED";
    const isRepairing = !campaignDone && (repairLoading || (branding?.repair_active === true));
    let activeProgress = repairProgress;
    let activeStream = repairStream;

    if (!repairLoading && branding?.repair_active) {
        activeProgress = branding.repair_progress || { current: 0, total: campaign.total_leads || 0 };
        activeStream = branding.repair_stream || "Syncing sequence...";
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase">{campaign.name}</h1>
                            <Badge
                                variant="outline"
                                className={`text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(campaign.status)}`}
                            >
                                {campaign.status}
                            </Badge>
                            {productFocus && (
                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border-none gap-1">
                                    <Package className="w-3 h-3" />
                                    {productFocus}
                                </Badge>
                            )}
                        </div>
                        {campaign.description && (
                            <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {campaign.assigned_user && (
                                <span>Created by <span className="font-bold text-foreground">{campaign.assigned_user.name}</span></span>
                            )}
                            {campaign.createdAt && (
                                <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
                            )}
                            <span className="flex items-center gap-1">
                                {(campaign.channels || []).map((ch) => (
                                    <Badge key={ch} variant="outline" className="text-[9px] font-bold border-white/10 gap-0.5 h-5 px-1.5">
                                        {ch === "EMAIL" && <Mail className="w-2.5 h-2.5" />}
                                        {ch === "SMS" && <MessageSquare className="w-2.5 h-2.5" />}
                                        {ch === "PHONE" && <Phone className="w-2.5 h-2.5" />}
                                        {ch}
                                    </Badge>
                                ))}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Stop/Resume Button — visible whenever campaign is ACTIVE */}
                        {campaign.status === "ACTIVE" && (
                            <Button
                                size="sm"
                                className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 font-bold"
                                onClick={toggleCampaignStatus}
                                disabled={statusLoading}
                            >
                                {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                                Stop Campaign
                            </Button>
                        )}
                        {campaign.status === "PAUSED" && (
                            <>
                                <Button
                                    size="sm"
                                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-bold"
                                    onClick={toggleCampaignStatus}
                                    disabled={statusLoading}
                                >
                                    {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    Resume Campaign
                                </Button>
                                <Button
                                    size="sm"
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold"
                                    onClick={async () => {
                                        setStatusLoading(true);
                                        try {
                                            const res = await fetch(`/api/campaigns/${campaignId}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "COMPLETED" }),
                                            });
                                            if (res.ok) {
                                                mutate();
                                                toast.success("Campaign marked as completed.");
                                            } else {
                                                const err = await res.json();
                                                toast.error(err.message || "Failed to complete campaign");
                                            }
                                        } catch { toast.error("Failed to complete campaign"); }
                                        setStatusLoading(false);
                                    }}
                                    disabled={statusLoading}
                                >
                                    {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Mark Complete
                                </Button>
                            </>
                        )}
                        {campaign.status === "COMPLETED" && (
                            <Button
                                size="sm"
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-bold"
                                onClick={async () => {
                                    setStatusLoading(true);
                                    try {
                                        const res = await fetch(`/api/campaigns/${campaignId}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ status: "ACTIVE" }),
                                        });
                                        if (res.ok) {
                                            mutate();
                                            toast.success("Campaign reactivated.");
                                        } else {
                                            const err = await res.json();
                                            toast.error(err.message || "Failed to reactivate campaign");
                                        }
                                    } catch { toast.error("Failed to reactivate campaign"); }
                                    setStatusLoading(false);
                                }}
                                disabled={statusLoading}
                            >
                                {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Reactivate
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-white/10"
                            onClick={() => router.push("/crm/accounts?tab=wizard")}
                        >
                            <Zap className="w-4 h-4" />
                            Scrape Accounts
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 font-medium"
                            onClick={handleRepair}
                            disabled={isRepairing || !campaign.assigned_pool}
                            title={!campaign.assigned_pool ? "No associated list to repair from" : "Send outreach to leads in the list that were previously skipped"}
                        >
                            {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Repair Skipped Leads
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2 bg-primary"
                            onClick={() => {
                                if (campaign.assigned_pool) {
                                    router.push(`/crm/accounts/lists/${campaign.assigned_pool.id}`);
                                } else {
                                    router.push("/lists");
                                }
                            }}
                        >
                            <Send className="w-4 h-4" />
                            Outreach
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[
                        { label: "Total Accounts", value: campaign.total_leads, icon: Building2, color: "text-emerald-400" },
                        { label: "Emails Sent", value: campaign.emails_sent, icon: Send, color: "text-blue-400" },
                        { label: "Emails Opened", value: campaign.emails_opened, icon: Eye, color: "text-amber-400" },
                        { label: "Open Rate", value: `${openRate}%`, icon: BarChart3, color: "text-purple-400" },
                        { label: "Meetings Booked", value: campaign.meetings_booked, icon: Calendar, color: "text-rose-400" },
                        { label: "SMS Sent", value: campaign.sms_sent, icon: MessageSquare, color: "text-teal-400" },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-xl border border-white/5 bg-card/50 backdrop-blur-sm p-4 space-y-1"
                        >
                            <div className="flex items-center gap-2">
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{stat.label}</span>
                            </div>
                            <div className="text-2xl font-black">{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Email Send Progress Bar */}
                {(campaign.status !== "DRAFT" && (campaign.total_leads > 0 || campaign.emails_sent > 0)) || isRepairing ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-2">
                                {isRepairing ? "Repair Progress" : "Send Progress"}
                                {campaign.status === "PAUSED" && !isRepairing && (
                                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-amber-500/30 text-amber-400">
                                        <Pause className="w-2.5 h-2.5 mr-0.5" />
                                        STOPPED
                                    </Badge>
                                )}
                                {isRepairing && (
                                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-amber-500/30 text-amber-400 bg-amber-500/10">
                                        <RefreshCw className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                                        REPAIRING
                                    </Badge>
                                )}
                            </span>
                            <span className="font-mono font-bold text-primary">
                                {isRepairing 
                                    ? <>{activeProgress.current} / {activeProgress.total}</>
                                    : campaign.status === "COMPLETED"
                                        ? <>{campaign.total_leads} / {campaign.total_leads}</>
                                        : <>{campaign.emails_sent} / {campaign.total_leads}</>
                                }
                                <span className="text-muted-foreground ml-1">
                                    {isRepairing 
                                        ? `(${activeProgress.total > 0 ? Math.round((activeProgress.current / activeProgress.total) * 100) : 0}%)`
                                        : campaign.status === "COMPLETED"
                                            ? "(100%)"
                                            : `(${campaign.total_leads > 0 ? Math.round((campaign.emails_sent / campaign.total_leads) * 100) : 0}%)`
                                    }
                                </span>
                            </span>
                        </div>
                        <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                    isRepairing 
                                        ? "bg-gradient-to-r from-amber-500 to-orange-500 animate-pulse"
                                        : campaign.status === "PAUSED"
                                            ? "bg-amber-500"
                                        : campaign.status === "COMPLETED"
                                            ? "bg-emerald-500"
                                            : "bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse"
                                }`}
                                style={{ width: `${
                                    isRepairing 
                                        ? (activeProgress.total > 0 ? Math.min(100, (activeProgress.current / activeProgress.total) * 100) : 0)
                                        : campaign.status === "COMPLETED"
                                            ? 100
                                            : (campaign.total_leads > 0 ? Math.min(100, (campaign.emails_sent / campaign.total_leads) * 100) : 0)
                                }%` }}
                            />
                        </div>
                        
                        {/* Live Reasoning Stream (Appears Only During Repair) */}
                        {isRepairing && activeStream && (
                            <div className="mt-2 w-full p-2.5 bg-black/60 border border-amber-500/20 rounded font-mono text-[10px] text-amber-400/90 shadow-inner flex items-center gap-2">
                                <span className="animate-pulse">▶</span>
                                <span className="truncate">{activeStream}</span>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Warmup Dashboard Banner */}
                {campaign.warmup && campaign.warmup.dailyLimit !== -1 && (
                    <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-indigo-500/5 to-purple-500/5 backdrop-blur-md overflow-hidden relative shadow-lg shadow-amber-500/5">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <Zap className="w-24 h-24 text-amber-500 animate-pulse" />
                        </div>
                        <CardHeader className="pb-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold uppercase text-[10px] tracking-wider border-none px-2.5 py-0.5 animate-pulse">
                                            Warmup Mode Active
                                        </Badge>
                                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 font-bold uppercase text-[10px]">
                                            {campaign.warmup.phase}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground font-semibold">
                                            Day {campaign.warmup.daysActive + 1}
                                        </span>
                                    </div>
                                    <CardTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2 mt-1">
                                        <Mail className="w-4 h-4 text-amber-400" />
                                        Warming up: <span className="text-amber-400 font-mono select-all text-sm md:text-base font-semibold">{campaign.warmup.senderEmail}</span>
                                    </CardTitle>
                                </div>
                                <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 backdrop-blur-sm self-start md:self-auto">
                                    <Clock className="w-4 h-4 text-amber-400 animate-spin-slow" />
                                    <div className="text-xs">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Next Batch Ready In</p>
                                        <p className="text-sm font-black mt-0.5"><WarmupCountdown /></p>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                                        Today's Sends Progress
                                    </span>
                                    <span className="font-mono font-bold text-amber-400">
                                        {campaign.warmup.sentToday} <span className="text-muted-foreground">/</span> {campaign.warmup.dailyLimit}
                                        <span className="text-muted-foreground ml-1.5">
                                            ({Math.round((campaign.warmup.sentToday / campaign.warmup.dailyLimit) * 100)}%)
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-indigo-500 transition-all duration-500"
                                        style={{ width: `${Math.min(100, (campaign.warmup.sentToday / campaign.warmup.dailyLimit) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] border-t border-white/5">
                                <div className="space-y-0.5">
                                    <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Quota Reset Cycle</span>
                                    <p className="text-white font-medium">Daily limit resets automatically at UTC Midnight.</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Warmup Logic</span>
                                    <p className="text-white font-medium">Gradually increases: Days 1–2 (20/d), Days 3–4 (50/d), Days 5–6 (100/d).</p>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-muted-foreground uppercase font-bold tracking-widest text-[9px]">Deduplication Guarantee</span>
                                    <p className="text-white font-medium">Any lead emailed in this phase is permanently skipped to prevent double-sends.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Separator className="bg-white/5" />

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-background/50 border border-primary/10 rounded-xl p-1">
                        <TabsTrigger value="overview" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Target className="w-3.5 h-3.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="lists" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Users className="w-3.5 h-3.5" />
                            Lists
                        </TabsTrigger>
                        <TabsTrigger value="outreach" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Mail className="w-3.5 h-3.5" />
                            Outreach
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <BarChart3 className="w-3.5 h-3.5" />
                            Analytics
                        </TabsTrigger>
                        <TabsTrigger value="abtesting" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <FlaskConical className="w-3.5 h-3.5" />
                            A/B Tests
                        </TabsTrigger>
                        <TabsTrigger value="linkedin" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Linkedin className="w-3.5 h-3.5" />
                            LinkedIn
                        </TabsTrigger>
                        <TabsTrigger value="cron" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            CRON Jobs
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="mt-6 space-y-6">
                        {/* AI Auto-Reply — Hero Section */}
                        <Card className={`backdrop-blur-sm ${campaign.auto_reply_enabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-indigo-500/20 bg-indigo-500/5"}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${campaign.auto_reply_enabled ? "bg-emerald-500/20" : "bg-indigo-500/20"}`}>
                                            <Zap className={`w-5 h-5 ${campaign.auto_reply_enabled ? "text-emerald-400" : "text-indigo-400"}`} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                AI Auto-Reply
                                                {campaign.auto_reply_enabled && (
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                )}
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-0.5">
                                                {campaign.auto_reply_enabled
                                                    ? "AI is actively monitoring and replying to inbound emails"
                                                    : "Enable to let AI autonomously respond to lead replies using campaign context"}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        size="lg"
                                        variant={campaign.auto_reply_enabled ? "default" : "default"}
                                        className={`gap-2 px-6 font-bold text-sm transition-all ${
                                            campaign.auto_reply_enabled
                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                                        }`}
                                        onClick={() => toggleAutoReply(!campaign.auto_reply_enabled)}
                                        disabled={autoReplyLoading}
                                    >
                                        {autoReplyLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : campaign.auto_reply_enabled ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : (
                                            <Zap className="w-4 h-4" />
                                        )}
                                        {campaign.auto_reply_enabled ? "Enabled — Click to Disable" : "Enable AI Auto-Reply"}
                                    </Button>
                                </div>
                            </CardHeader>
                            {campaign.auto_reply_enabled && (
                                <CardContent className="space-y-3 pt-0">
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Replies Received</span>
                                            <div className="text-xl font-black text-emerald-400 mt-1">{campaign.emails_replied || 0}</div>
                                        </div>
                                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Auto-Replies Sent</span>
                                            <div className="text-xl font-black text-amber-400 mt-1">{autoRepliesSent}</div>
                                        </div>
                                        <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 p-3">
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Max Replies / Thread</span>
                                            <div className="text-xl font-black text-indigo-400 mt-1">{campaign.auto_reply_max_count ?? 3}</div>
                                        </div>
                                        <div className="rounded-lg bg-background/50 border border-white/5 p-3 md:col-span-2 flex items-center gap-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-2 border-white/10 hover:bg-white/5 text-xs"
                                                onClick={backfillReplies}
                                                disabled={backfillLoading}
                                            >
                                                {backfillLoading ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-3 h-3" />
                                                )}
                                                Scan Existing Replies
                                            </Button>
                                            <p className="text-[10px] text-muted-foreground">
                                                Process unreplied inbound threads with AI
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Campaign Brief */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-primary" />
                                        Campaign Brief
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {campaign.campaign_branding?.campaign_brief ||
                                            campaign.campaign_branding?.mission_statement ||
                                            "No campaign brief set. Edit campaign settings to add one."}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Brand Identity Snapshot */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-primary" />
                                        Brand Identity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {campaign.campaign_branding?.company_name && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Company</span>
                                            <p className="text-sm font-semibold">{campaign.campaign_branding.company_name}</p>
                                        </div>
                                    )}
                                    {productFocus && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Product Focus</span>
                                            <p className="text-sm font-semibold">{productFocus}</p>
                                        </div>
                                    )}
                                    {campaign.campaign_branding?.senderMode && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Sender Mode</span>
                                            <p className="text-sm font-semibold capitalize">{campaign.campaign_branding.senderMode}</p>
                                        </div>
                                    )}
                                    {campaign.campaign_branding?.templateId && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Email Template</span>
                                            <p className="text-sm font-semibold capitalize">{campaign.campaign_branding.templateId}</p>
                                        </div>
                                    )}
                                    {campaign.campaign_branding?.persona_preset && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Voice</span>
                                            <p className="text-sm">{campaign.campaign_branding.persona_preset}</p>
                                        </div>
                                    )}
                                    {campaign.campaign_branding?.brand_voice && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tone</span>
                                            <p className="text-sm text-muted-foreground">{campaign.campaign_branding.brand_voice}</p>
                                        </div>
                                    )}
                                    {campaign.campaign_branding?.outreach_approach && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Outreach Approach</span>
                                            <p className="text-sm text-muted-foreground">{campaign.campaign_branding.outreach_approach}</p>
                                        </div>
                                    )}
                                    {!campaign.campaign_branding?.company_name && !campaign.campaign_branding?.senderMode && !productFocus && (
                                        <p className="text-sm text-muted-foreground">No brand identity configured. Set up your brand in Settings → Brand Identity.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ICP Targeting */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Target className="w-4 h-4 text-primary" />
                                        ICP Targeting
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(() => {
                                        const icp = campaign.campaign_branding?.target_industries?.length > 0
                                            ? campaign.campaign_branding
                                            : (campaign as any).assigned_pool?.icpConfig;
                                        if (!icp) return <p className="text-sm text-muted-foreground">No ICP targeting data available.</p>;
                                        return (
                                            <>
                                                {(icp.target_industries || icp.industries)?.length > 0 && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Industries</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {(icp.target_industries || icp.industries).map((ind: string) => (
                                                                <Badge key={ind} variant="secondary" className="text-[10px]">{ind}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(icp.target_geos || icp.geos)?.length > 0 && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Geographies</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {(icp.target_geos || icp.geos).map((geo: string) => (
                                                                <Badge key={geo} variant="secondary" className="text-[10px]">{geo}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(icp.target_titles || icp.titles)?.length > 0 && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Job Titles</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {(icp.target_titles || icp.titles).map((t: string) => (
                                                                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(icp.companySizes)?.length > 0 && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Company Size</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {icp.companySizes.map((s: string) => (
                                                                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(icp.ideal_customer_profile || icp.notes) && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Ideal Customer</span>
                                                        <p className="text-sm text-muted-foreground mt-1">{icp.ideal_customer_profile || icp.notes}</p>
                                                    </div>
                                                )}
                                                {campaign.campaign_branding?.key_value_props?.length > 0 && (
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Value Props</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {campaign.campaign_branding.key_value_props.map((prop: string) => (
                                                                <Badge key={prop} variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-400">{prop}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            {/* Outreach Pipeline */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Send className="w-4 h-4 text-primary" />
                                        Outreach Pipeline
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {(() => {
                                        const oi = campaign.outreach_items || [];
                                        const groups = [
                                            { label: "Pending", count: oi.filter((i: any) => ["PENDING","RESEARCHING","READY"].includes(i.status)).length, color: "text-amber-400" },
                                            { label: "Sent", count: oi.filter((i: any) => i.status === "SENT" || i.status === "DELIVERED").length, color: "text-blue-400" },
                                            { label: "Opened", count: oi.filter((i: any) => i.status === "OPENED" || i.status === "CLICKED").length, color: "text-purple-400" },
                                            { label: "Replied", count: oi.filter((i: any) => i.status === "REPLIED").length, color: "text-emerald-400" },
                                            { label: "Failed", count: oi.filter((i: any) => i.status === "FAILED" || i.status === "BOUNCED").length, color: "text-red-400" },
                                            { label: "Skipped", count: oi.filter((i: any) => i.status === "SKIPPED").length, color: "text-gray-400" },
                                        ].filter(g => g.count > 0);
                                        return groups.length > 0 ? groups.map(g => (
                                            <div key={g.label} className="flex items-center justify-between">
                                                <span className={`text-xs uppercase tracking-wider font-medium ${g.color}`}>{g.label}</span>
                                                <Badge variant="outline" className="text-[10px] font-bold border-white/10">{g.count}</Badge>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground">No outreach items yet. Launch the wizard to start.</p>
                                        );
                                    })()}
                                    {campaign.meeting_link && (
                                        <div className="pt-3 mt-2 border-t border-white/5">
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Meeting Link</span>
                                            <a href={campaign.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block mt-0.5 truncate">
                                                {campaign.meeting_link}
                                            </a>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Lists Tab */}
                    <TabsContent value="lists" className="mt-6">
                        <div className="text-center py-12 bg-card/50 backdrop-blur-sm rounded-xl border border-white/5">
                            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            {campaign.assigned_pool ? (
                                <div>
                                    <h3 className="font-bold mb-2">Linked List: {campaign.assigned_pool.name}</h3>
                                    <Button
                                        variant="default"
                                        className="mt-2"
                                        onClick={() => router.push(`/crm/accounts/lists/${campaign.assigned_pool!.id}`)}
                                    >
                                        View List Details
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="font-bold mb-2">No lists linked yet</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Use the LeadGen Wizard to scrape accounts into a list, then link it to this campaign.</p>
                                    <Button onClick={() => router.push("/crm/accounts?tab=wizard")}>
                                        <Zap className="w-4 h-4 mr-2" />
                                        Launch LeadGen Wizard
                                    </Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Outreach Tab */}
                    <TabsContent value="outreach" className="mt-6">
                        <CampaignContactTracker campaignId={campaignId} onRefresh={() => mutate()} />
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Funnel */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Conversion Funnel</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {[
                                        { label: "Accounts Scraped", value: campaign.total_leads, color: "bg-emerald-500" },
                                        { label: "Emails Sent", value: campaign.emails_sent, color: "bg-blue-500" },
                                        { label: "Emails Opened", value: campaign.emails_opened, color: "bg-amber-500" },
                                        { label: "Meetings Booked", value: campaign.meetings_booked, color: "bg-rose-500" },
                                    ].map((step) => {
                                        const maxVal = Math.max(campaign.total_leads, 1);
                                        const pct = Math.round((step.value / maxVal) * 100);
                                        return (
                                            <div key={step.label}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-muted-foreground">{step.label}</span>
                                                    <span className="font-bold">{step.value} ({pct}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${step.color}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            {/* Channels Breakdown */}
                            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Channel Performance</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm font-bold">Email</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{campaign.emails_sent} sent</div>
                                            <div className="text-xs text-muted-foreground">{openRate}% open rate</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-teal-500/5 border border-teal-500/10">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-teal-400" />
                                            <span className="text-sm font-bold">SMS</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{campaign.sms_sent} sent</div>
                                            <div className="text-xs text-muted-foreground">{campaign.sms_delivered} delivered</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-purple-400" />
                                            <span className="text-sm font-bold">Phone</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{campaign.calls_initiated} calls</div>
                                            <div className="text-xs text-muted-foreground">{campaign.meetings_booked} meetings</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* A/B Testing Tab */}
                    <TabsContent value="abtesting" className="mt-6">
                        <ABTestingPanel campaignId={campaignId} />
                    </TabsContent>

                    {/* LinkedIn Tab */}
                    <TabsContent value="linkedin" className="mt-6">
                        <LinkedInSequencePanel campaignId={campaignId} />
                    </TabsContent>

                    {/* CRON Jobs Tab */}
                    <TabsContent value="cron" className="mt-6">
                        <Tabs defaultValue="email" className="w-full">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList className="bg-background/50 border border-primary/10 rounded-xl p-1">
                                    <TabsTrigger value="email" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <Mail className="w-3.5 h-3.5" />
                                        Email Follow-ups
                                    </TabsTrigger>
                                    <TabsTrigger value="voice" className="gap-2 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                        <Phone className="w-3.5 h-3.5" />
                                        Voice Batches
                                    </TabsTrigger>
                                </TabsList>
                                <Badge variant="outline" className="hidden sm:inline-flex">{cronJobs.length} total jobs</Badge>
                            </div>

                            <TabsContent value="email" className="mt-0">
                                {emailJobs.length === 0 ? (
                                    <div className="text-center py-12 bg-card/50 backdrop-blur-sm rounded-xl border border-white/5">
                                        <Mail className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                                        <h3 className="font-bold">No Email CRON Jobs</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Auto follow-up email jobs will appear here when configured.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {emailJobs.map((job: any) => (
                                            <CronJobCard key={job.id} job={job} toggleCronJob={toggleCronJob} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="voice" className="mt-0">
                                {voiceJobs.length === 0 ? (
                                    <div className="text-center py-12 bg-card/50 backdrop-blur-sm rounded-xl border border-white/5">
                                        <Phone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                                        <h3 className="font-bold">No Voice CRON Jobs</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Voice batching jobs will appear here when an AI Voice payload is configured.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {voiceJobs.map((job: any) => (
                                            <CronJobCard key={job.id} job={job} toggleCronJob={toggleCronJob} />
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                </Tabs>

                {/* Delete Confirmation Overlay */}
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-card border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Delete Campaign</h3>
                                    <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                                </div>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-1">
                                <p className="text-sm">This will:</p>
                                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
                                    <li>Delete all outreach items for this campaign</li>
                                    <li>Reset all leads back to <span className="text-white font-bold">IDLE</span> status</li>
                                    <li>Cancel all CRON jobs linked to this campaign</li>
                                    <li>Permanently delete the campaign record</li>
                                </ul>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="gap-2"
                                >
                                    {deleting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                    ) : (
                                        <><Trash2 className="w-4 h-4" /> Delete Campaign</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
