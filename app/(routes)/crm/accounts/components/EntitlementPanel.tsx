"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
    Shield, Plus, Loader2, Calendar, Clock, Hash,
    Phone, Mail, MessageSquare, Globe, CheckCircle2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Entitlement {
    id: string;
    name: string;
    type: string;
    total_cases: number | null;
    remaining_cases: number | null;
    total_hours: number | null;
    remaining_hours: number | null;
    response_time_hrs: number | null;
    channels: string[];
    start_date: string;
    end_date: string;
    is_active: boolean;
    account: { name: string };
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
    email: Mail, phone: Phone, chat: MessageSquare, portal: Globe,
};

export default function EntitlementPanel({ accountId }: { accountId: string }) {
    const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/api/crm/entitlements?account_id=${accountId}`);
            setEntitlements(data);
        } catch { /* skip */ }
        setLoading(false);
    }, [accountId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreate = async (formData: any) => {
        try {
            await axios.post("/api/crm/entitlements", { ...formData, account_id: accountId });
            setShowCreate(false);
            fetchData();
        } catch { /* skip */ }
    };

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <h3 className="font-semibold text-white">Entitlements</h3>
                    <Badge variant="outline" className="text-[10px]">{entitlements.length}</Badge>
                </div>
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <Plus className="w-3 h-3" /> Add
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Create Entitlement</DialogTitle></DialogHeader>
                        <CreateEntitlementForm onSubmit={handleCreate} />
                    </DialogContent>
                </Dialog>
            </div>

            {entitlements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No entitlements configured for this account.
                </div>
            ) : (
                <div className="space-y-2">
                    {entitlements.map(e => {
                        const isExpired = new Date(e.end_date) < new Date();
                        const isLow = e.remaining_cases !== null && e.remaining_cases <= 3;
                        const usagePct = e.total_cases && e.remaining_cases !== null
                            ? ((e.total_cases - e.remaining_cases) / e.total_cases) * 100 : 0;

                        return (
                            <div key={e.id} className={`rounded-lg border p-3 space-y-2 ${isExpired ? "border-red-500/20 bg-red-500/5 opacity-60" : "border-white/10 bg-white/5"}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-white">{e.name}</span>
                                        <Badge className={`text-[9px] border-0 ${e.type === "unlimited" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                                            {e.type}
                                        </Badge>
                                    </div>
                                    {isExpired ? (
                                        <Badge className="bg-red-500/10 text-red-400 border-0 text-[9px]">Expired</Badge>
                                    ) : isLow ? (
                                        <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[9px]"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Low</Badge>
                                    ) : (
                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[9px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Active</Badge>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                    {e.remaining_cases !== null && (
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Hash className="w-3 h-3" /> {e.remaining_cases}/{e.total_cases} cases
                                        </div>
                                    )}
                                    {e.response_time_hrs && (
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="w-3 h-3" /> {e.response_time_hrs}hr SLA
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Calendar className="w-3 h-3" /> {new Date(e.end_date).toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Usage bar */}
                                {e.total_cases && (
                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${usagePct > 80 ? "bg-red-500" : usagePct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${usagePct}%` }} />
                                    </div>
                                )}

                                {/* Channel badges */}
                                <div className="flex gap-1">
                                    {e.channels.map(ch => {
                                        const Icon = CHANNEL_ICONS[ch] || Globe;
                                        return (
                                            <Badge key={ch} variant="outline" className="text-[8px] gap-1 px-1.5">
                                                <Icon className="w-2.5 h-2.5" /> {ch}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CreateEntitlementForm({ onSubmit }: { onSubmit: (data: any) => void }) {
    const [name, setName] = useState("");
    const [type, setType] = useState("cases");
    const [totalCases, setTotalCases] = useState("50");
    const [responseTime, setResponseTime] = useState("4");
    const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(() =>
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    );

    return (
        <div className="space-y-4 pt-2">
            <div>
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium Support" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cases">Case Limit</SelectItem>
                            <SelectItem value="hours">Support Hours</SelectItem>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {type === "cases" && (
                    <div>
                        <Label className="text-xs">Total Cases</Label>
                        <Input type="number" value={totalCases} onChange={e => setTotalCases(e.target.value)} className="mt-1" />
                    </div>
                )}
            </div>
            <div>
                <Label className="text-xs">Response Time (hours)</Label>
                <Input type="number" value={responseTime} onChange={e => setResponseTime(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                    <Label className="text-xs">End Date</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                </div>
            </div>
            <Button className="w-full" onClick={() => onSubmit({
                name, type,
                total_cases: type === "cases" ? parseInt(totalCases) : null,
                response_time_hrs: parseInt(responseTime),
                start_date: startDate, end_date: endDate,
                channels: ["email", "phone", "chat", "portal"],
            })}>
                Create Entitlement
            </Button>
        </div>
    );
}
