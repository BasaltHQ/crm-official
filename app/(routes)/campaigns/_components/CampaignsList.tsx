"use client";

import React, { useState } from "react";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    Plus,
    Search,
    LayoutGrid,
    List as ListIcon,
    Mail,
    MessageSquare,
    Phone,
    Users,
    BarChart3,
    Target,
    Calendar,
    MoreVertical,
    Trash2,
    Settings,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NewCampaignDialog from "../../projects/dialogs/NewCampaign";
import { EnhancedDateFilter } from "@/components/date-filter/EnhancedDateFilter";

type Campaign = {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    channels: string[];
    total_leads: number;
    emails_sent: number;
    emails_opened: number;
    sms_sent: number;
    sms_delivered: number;
    calls_initiated: number;
    meetings_booked: number;
    createdAt?: string;
    updatedAt?: string;
    campaign_branding?: any;
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
        daysActive: number;
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
        case "PENDING_APPROVAL":
            return "bg-purple-500/10 text-purple-400 border-purple-500/20";
        default:
            return "bg-muted/50 text-muted-foreground border-transparent";
    }
};

const getChannelIcon = (channel: string) => {
    switch (channel) {
        case "EMAIL":
            return <Mail className="w-3.5 h-3.5" />;
        case "SMS":
            return <MessageSquare className="w-3.5 h-3.5" />;
        case "PHONE":
            return <Phone className="w-3.5 h-3.5" />;
        default:
            return null;
    }
};

export default function CampaignsList() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined,
    });

    const { data, error, isLoading, mutate } = useSWR<{ campaigns: Campaign[] }>(
        "/api/campaigns",
        fetcher,
        { revalidateOnFocus: true, dedupingInterval: 5000, refreshInterval: 10000 }
    );
    const campaigns = data?.campaigns || [];

    const filteredCampaigns = (campaigns || []).filter((c) => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (dateRange.from || dateRange.to) {
            if (!c.createdAt) return false;
            const createdAt = new Date(c.createdAt);
            if (dateRange.from && dateRange.to) return createdAt >= dateRange.from && createdAt <= dateRange.to;
            if (dateRange.from) return createdAt >= dateRange.from;
            if (dateRange.to) return createdAt <= dateRange.to;
        }

        return true;
    });

    const totalStats = (campaigns || []).reduce(
        (acc, c) => ({
            total: acc.total + 1,
            leads: acc.leads + (c.total_leads || 0),
            sent: acc.sent + (c.emails_sent || 0),
            opened: acc.opened + (c.emails_opened || 0),
            meetings: acc.meetings + (c.meetings_booked || 0),
        }),
        { total: 0, leads: 0, sent: 0, opened: 0, meetings: 0 }
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent tracking-tight uppercase leading-[1.2] py-2">
                        Campaigns
                    </h2>
                    <p className="text-muted-foreground/80 mt-1 text-base font-medium tracking-wide">
                        AI-powered outreach campaigns with brand identity integration.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <NewCampaignDialog
                        entityName="Campaign"
                        customTrigger={
                            <Button className="gap-2 bg-primary shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4" />
                                New Campaign
                            </Button>
                        }
                    />
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Total Campaigns", value: totalStats.total, icon: Target, color: "text-indigo-400" },
                    { label: "Accounts Scraped", value: totalStats.leads, icon: Users, color: "text-emerald-400" },
                    { label: "Emails Sent", value: totalStats.sent, icon: Mail, color: "text-blue-400" },
                    { label: "Emails Opened", value: totalStats.opened, icon: BarChart3, color: "text-amber-400" },
                    { label: "Meetings Booked", value: totalStats.meetings, icon: Calendar, color: "text-rose-400" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border border-white/5 bg-card/50 backdrop-blur-sm p-4 space-y-1"
                    >
                        <div className="flex items-center gap-2">
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{stat.label}</span>
                        </div>
                        <div className="text-2xl font-black">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters & View Toggle */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search campaigns..."
                            className="pl-9 bg-card/50 backdrop-blur-sm border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <EnhancedDateFilter
                        onFilterChange={(range: { from: Date | undefined; to: Date | undefined }) => setDateRange(range)}
                        storageKey="campaigns-date-filter"
                        initialType="all-time"
                        className="w-full md:w-auto"
                    />
                </div>

                <Tabs
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as "grid" | "list")}
                >
                    <TabsList className="bg-background/50 border border-primary/10 rounded-xl p-1">
                        <TabsTrigger
                            value="grid"
                            className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Grid
                        </TabsTrigger>
                        <TabsTrigger
                            value="list"
                            className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                        >
                            <ListIcon className="w-4 h-4" />
                            List
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Separator className="bg-white/5" />

            {/* Loading */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredCampaigns.length === 0 && (
                <div className="text-center py-16 bg-card/50 backdrop-blur-sm rounded-xl border border-white/5 border-dashed">
                    <Target className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">
                        {searchQuery ? "No campaigns matching your search" : "No campaigns yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        {searchQuery
                            ? "Try adjusting your search terms."
                            : "Create your first campaign to start scraping accounts and launching AI-powered outreach."}
                    </p>
                    {!searchQuery && (
                        <NewCampaignDialog
                            entityName="Campaign"
                            customTrigger={
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Create Your First Campaign
                                </Button>
                            }
                        />
                    )}
                </div>
            )}

            {/* Grid View */}
            {!isLoading && filteredCampaigns.length > 0 && viewMode === "grid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCampaigns.map((campaign) => {
                        const productFocus = campaign.campaign_branding?.product_focus;
                        const openRate = campaign.emails_sent > 0
                            ? Math.round((campaign.emails_opened / campaign.emails_sent) * 100)
                            : 0;

                        return (
                            <Card
                                key={campaign.id}
                                className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all group bg-card/50 backdrop-blur-sm border border-white/5 cursor-pointer hover:scale-[1.01]"
                                onClick={() => router.push(`/campaigns/${campaign.id}`)}
                            >
                                <div
                                    className="h-1.5 w-full"
                                    style={{
                                        backgroundColor:
                                            campaign.campaign_branding?.primary_brand_color ||
                                            "#6366f1",
                                    }}
                                />
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <CardTitle className="text-lg font-black tracking-tight uppercase leading-tight truncate">
                                                {campaign.name}
                                            </CardTitle>
                                            <CardDescription className="line-clamp-1 text-xs">
                                                {campaign.description || "No description"}
                                            </CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuLabel>Campaign</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/campaigns/${campaign.id}`);
                                                    }}
                                                >
                                                    <Settings className="w-4 h-4 mr-2" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push("/crm/accounts?tab=wizard");
                                                    }}
                                                >
                                                    <Zap className="w-4 h-4 mr-2" />
                                                    Launch LeadGen Wizard
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm(`Delete "${campaign.name}"? This will reset all leads and cancel CRON jobs.`)) return;
                                                        try {
                                                            const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
                                                            if (res.ok) {
                                                                toast.success("Campaign deleted");
                                                                mutate();
                                                            } else {
                                                                const err = await res.json();
                                                                toast.error(err.message || "Delete failed");
                                                            }
                                                        } catch {
                                                            toast.error("Failed to delete campaign");
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Campaign
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-4 space-y-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(campaign.status)}`}
                                        >
                                            {campaign.status}
                                        </Badge>
                                        {campaign.warmup && (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] font-bold uppercase tracking-wider border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-indigo-300 animate-pulse gap-1"
                                            >
                                                🔥 Warmup ({campaign.warmup.phase})
                                            </Badge>
                                        )}
                                        {productFocus && (
                                            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border-none">
                                                {productFocus}
                                            </Badge>
                                        )}
                                        {campaign.channels.map((ch) => (
                                            <Badge
                                                key={ch}
                                                variant="outline"
                                                className="text-[10px] font-bold uppercase tracking-wider border-white/10 gap-1"
                                            >
                                                {getChannelIcon(ch)}
                                                {ch}
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-4 gap-2 pt-1">
                                        <div className="text-center">
                                            <div className="text-lg font-black text-emerald-400">{campaign.total_leads}</div>
                                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Accounts</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-black text-blue-400">{campaign.emails_sent}</div>
                                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Sent</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-black text-amber-400">{openRate}%</div>
                                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Open Rate</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-black text-rose-400">{campaign.meetings_booked}</div>
                                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Meetings</div>
                                        </div>
                                    </div>

                                    {/* Send Progress Bar */}
                                    {(campaign.total_leads > 0 || campaign.emails_sent > 0) && (
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                                                <span>Send Progress</span>
                                                <span className="font-mono text-primary">
                                                    {campaign.emails_sent}/{campaign.total_leads}
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                                                    style={{ width: `${campaign.total_leads > 0 ? Math.min(100, (campaign.emails_sent / campaign.total_leads) * 100) : (campaign.emails_sent > 0 ? 100 : 0)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Linked Pool */}
                                    {campaign.assigned_pool && (
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-white/5">
                                            <Users className="w-3 h-3" />
                                            List: <span className="font-bold text-foreground">{campaign.assigned_pool.name}</span>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-3 border-t border-white/5 bg-muted/5 flex gap-2">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1 text-xs font-bold uppercase tracking-wider h-8 bg-indigo-600 hover:bg-indigo-700"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/campaigns/${campaign.id}`);
                                        }}
                                    >
                                        Manage
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs font-bold uppercase tracking-wider h-8 border-white/10 hover:bg-white/5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push("/crm/accounts?tab=wizard");
                                        }}
                                    >
                                        Scrape Accounts
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {!isLoading && filteredCampaigns.length > 0 && viewMode === "list" && (
                <div className="rounded-xl border border-white/5 bg-card/50 backdrop-blur-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="border-white/5">
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Campaign</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Status</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Product</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Channels</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-center">Accounts</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-center">Sent</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-center">Opened</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-center">Meetings</TableHead>
                                <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCampaigns.map((campaign) => {
                                const productFocus = campaign.campaign_branding?.product_focus;
                                return (
                                    <TableRow
                                        key={campaign.id}
                                        className="border-white/5 hover:bg-white/5 cursor-pointer"
                                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                                    >
                                        <TableCell>
                                            <div className="font-bold">{campaign.name}</div>
                                            {campaign.description && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {campaign.description}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 items-start">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(campaign.status)}`}
                                                >
                                                    {campaign.status}
                                                </Badge>
                                                {campaign.warmup && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[9px] font-bold uppercase tracking-wider border-indigo-500/20 bg-indigo-500/5 text-indigo-300 gap-1"
                                                    >
                                                        🔥 {campaign.warmup.phase}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {productFocus ? (
                                                <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border-none">
                                                    {productFocus}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {campaign.channels.map((ch) => (
                                                    <span key={ch} className="text-muted-foreground">
                                                        {getChannelIcon(ch)}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-emerald-400">{campaign.total_leads}</TableCell>
                                        <TableCell className="text-center font-bold text-blue-400">{campaign.emails_sent}</TableCell>
                                        <TableCell className="text-center font-bold text-amber-400">{campaign.emails_opened}</TableCell>
                                        <TableCell className="text-center font-bold text-rose-400">{campaign.meetings_booked}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "—"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
