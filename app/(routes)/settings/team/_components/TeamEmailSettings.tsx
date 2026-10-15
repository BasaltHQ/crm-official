"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { Loader2, Mail, CheckCircle2, AlertCircle, Copy, Inbox, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailConfig {
    id: string;
    from_email: string;
    verification_status: "PENDING" | "VERIFIED" | "FAILED" | "NOT_STARTED";
}

interface DnsRecord {
    type: string;
    name: string;
    value: string;
    priority?: number;
}

interface ReplyDomainConfig {
    domain: string | null;
    status: string | null;
    mxRecord?: DnsRecord;
    dkimRecords?: DnsRecord[];
    verificationRecord?: DnsRecord;
    verifiedAt?: string;
}

interface TeamEmailSettingsProps {
    teamId: string;
}

export function TeamEmailSettings({ teamId }: TeamEmailSettingsProps) {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<EmailConfig | null>(null);
    const [emailInput, setEmailInput] = useState("");

    // Reply domain state
    const [replyDomain, setReplyDomain] = useState<ReplyDomainConfig | null>(null);
    const [replyDomainInput, setReplyDomainInput] = useState("");
    const [replyLoading, setReplyLoading] = useState(false);

    const fetchConfig = useCallback(async () => {
        if (!teamId) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                if (data?.from_email) setEmailInput(data.from_email);
            }
        } catch (error) {
            console.error("Failed to fetch email config", error);
        }
    }, [teamId]);

    const fetchReplyDomain = useCallback(async () => {
        if (!teamId) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config/reply-domain`);
            if (res.ok) {
                const data = await res.json();
                setReplyDomain(data);
            }
        } catch (error) {
            console.error("Failed to fetch reply domain config", error);
        }
    }, [teamId]);

    useEffect(() => {
        if (!teamId) return;
        fetchConfig();
        fetchReplyDomain();
    }, [teamId, fetchConfig, fetchReplyDomain]);

    const handleRemove = async () => {
        if (!config || !teamId || !confirm("Are you sure? This will stop future campaigns from using this email.")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Failed to remove config");

            setConfig(null);
            setEmailInput("");
            toast.success("Email configuration removed.");
        } catch (error) {
            toast.error("Failed to remove configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!teamId || !emailInput) return;
        if (!emailInput.includes("@")) {
            toast.error("Invalid email address");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailInput }),
            });

            if (!res.ok) throw new Error("Failed to save");

            const data = await res.json();
            setConfig(data);
            toast.success("Verification email sent! Please check your inbox.");
        } catch (error) {
            toast.error("Failed to save email configuration");
        } finally {
            setLoading(false);
        }
    };

    // Reply domain handlers
    const handleSetupReplyDomain = async () => {
        if (!teamId || !replyDomainInput) return;
        const cleaned = replyDomainInput.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
        if (!cleaned.includes(".")) {
            toast.error("Enter a valid domain (e.g. reply.yourcompany.com)");
            return;
        }

        setReplyLoading(true);
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config/reply-domain`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: cleaned }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData?.error || "Failed to set up reply domain");
            }

            const data = await res.json();
            setReplyDomain(data);
            toast.success("Reply domain configured! Add the DNS records below.");
        } catch (error: any) {
            toast.error(error?.message || "Failed to set up reply domain");
        } finally {
            setReplyLoading(false);
        }
    };

    const handleCheckReplyStatus = async () => {
        setReplyLoading(true);
        await fetchReplyDomain();
        setReplyLoading(false);
        toast.success("Status refreshed");
    };

    const handleRemoveReplyDomain = async () => {
        if (!teamId || !confirm("Remove reply domain? Inbound reply routing will stop working.")) return;
        setReplyLoading(true);
        try {
            const res = await fetch(`/api/teams/${teamId}/email-config/reply-domain`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to remove");
            setReplyDomain(null);
            setReplyDomainInput("");
            toast.success("Reply domain removed.");
        } catch (error) {
            toast.error("Failed to remove reply domain");
        } finally {
            setReplyLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Copied to clipboard", { duration: 1500 });
        }).catch(() => {
            toast.error("Failed to copy");
        });
    };

    // Collect all DNS records into a flat array for display
    const dnsRecords: (DnsRecord & { label: string })[] = [];
    if (replyDomain?.mxRecord) {
        dnsRecords.push({ ...replyDomain.mxRecord, label: "MX (Receive Email)" });
    }
    if (replyDomain?.verificationRecord) {
        dnsRecords.push({ ...replyDomain.verificationRecord, label: "TXT (Domain Verification)" });
    }
    if (replyDomain?.dkimRecords) {
        replyDomain.dkimRecords.forEach((r, i) => {
            dnsRecords.push({ ...r, label: `CNAME (DKIM ${i + 1})` });
        });
    }

    return (
        <div className="space-y-6">
            {/* ─── Outbound Email Config ────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                        <Mail className="w-5 h-5 text-primary" />
                        Company Email Settings (Bring Your Own Email)
                    </CardTitle>
                    <CardDescription>
                        Configure your own email service (AWS SES, Resend, SMTP, etc.) to handle client outreach.
                        <br />
                        <span className="text-red-500 font-semibold">Mandatory:</span> Mass outreach, quotes, and invoices WILL NOT be sent until a verified custom email is configured here. This protects the system from being blacklisted.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Sender Email Address</label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="sales@yourcompany.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                            />
                            <Button onClick={handleSave} disabled={loading || !emailInput}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Changing this will send a new verification link to the address.
                        </p>
                    </div>

                    {config && (
                        <div className={cn(
                            "p-3 rounded-md border flex items-center gap-3",
                            config.verification_status === "VERIFIED" ? "bg-green-500/10 border-green-500/20" :
                                config.verification_status === "PENDING" ? "bg-amber-500/10 border-amber-500/20" :
                                    "bg-red-500/10 border-red-500/20"
                        )}>
                            {config.verification_status === "VERIFIED" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            {config.verification_status === "PENDING" && <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />}
                            {config.verification_status === "FAILED" && <AlertCircle className="w-5 h-5 text-red-600" />}

                            <div className="flex-1">
                                <p className="text-sm font-medium">
                                    Status: {config.verification_status}
                                </p>
                                {config.verification_status === "PENDING" && (
                                    <p className="text-xs text-muted-foreground">
                                        A verification link has been sent to <strong>{config.from_email}</strong>.
                                        Click the link in the email, then refresh this page.
                                    </p>
                                )}
                                {config.verification_status === "VERIFIED" && (
                                    <p className="text-xs text-muted-foreground">
                                        You are ready to send campaigns as <strong>{config.from_email}</strong>.
                                    </p>
                                )}
                            </div>
                            {config.verification_status === "PENDING" && (
                                <Button size="sm" variant="outline" onClick={fetchConfig} disabled={loading}>Check Status</Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={handleRemove} disabled={loading}>Remove</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── Inbound Reply Domain ─────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                        <Inbox className="w-5 h-5 text-blue-500" />
                        Reply Domain (Inbound Email Routing)
                    </CardTitle>
                    <CardDescription>
                        Set up a custom reply domain so that client responses route back into the CRM.
                        <br />
                        Use a subdomain like <strong>reply.yourcompany.com</strong> to avoid conflicts with your main email.
                        After setup, add the DNS records below to your domain registrar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Setup form (show when no domain configured or changing) */}
                    {!replyDomain?.domain && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Reply Domain</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="reply.yourcompany.com"
                                    value={replyDomainInput}
                                    onChange={(e) => setReplyDomainInput(e.target.value)}
                                />
                                <Button onClick={handleSetupReplyDomain} disabled={replyLoading || !replyDomainInput}>
                                    {replyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Up Domain"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                We recommend using a subdomain (e.g. <code>reply.yourcompany.com</code>) dedicated to CRM replies.
                            </p>
                        </div>
                    )}

                    {/* Domain status */}
                    {replyDomain?.domain && (
                        <div className={cn(
                            "p-3 rounded-md border flex items-center gap-3",
                            replyDomain.status === "VERIFIED" ? "bg-green-500/10 border-green-500/20" : "bg-amber-500/10 border-amber-500/20"
                        )}>
                            {replyDomain.status === "VERIFIED" ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                            )}
                            <div className="flex-1">
                                <p className="text-sm font-medium">
                                    <strong>{replyDomain.domain}</strong> — {replyDomain.status === "VERIFIED" ? "Verified ✓" : "Pending DNS Verification"}
                                </p>
                                {replyDomain.status !== "VERIFIED" && (
                                    <p className="text-xs text-muted-foreground">
                                        Add the DNS records below to your domain registrar, then click &quot;Check Status&quot;. Propagation can take up to 72 hours.
                                    </p>
                                )}
                                {replyDomain.status === "VERIFIED" && replyDomain.verifiedAt && (
                                    <p className="text-xs text-muted-foreground">
                                        Verified on {new Date(replyDomain.verifiedAt).toLocaleDateString()}. Replies to <strong>sysadm@{replyDomain.domain}</strong> will route to the CRM.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {replyDomain.status !== "VERIFIED" && (
                                    <Button size="sm" variant="outline" onClick={handleCheckReplyStatus} disabled={replyLoading}>
                                        <RefreshCw className={cn("w-3.5 h-3.5 mr-1", replyLoading && "animate-spin")} />
                                        Check Status
                                    </Button>
                                )}
                                <Button size="sm" variant="destructive" onClick={handleRemoveReplyDomain} disabled={replyLoading}>
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* DNS Records Table */}
                    {replyDomain?.domain && dnsRecords.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/40 px-4 py-2 border-b">
                                <p className="text-sm font-bold">Required DNS Records</p>
                                <p className="text-xs text-muted-foreground">Add all of these records to your domain&apos;s DNS configuration</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/20">
                                            <th className="text-left py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Record</th>
                                            <th className="text-left py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                                            <th className="text-left py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name / Host</th>
                                            <th className="text-left py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Value / Points To</th>
                                            <th className="text-left py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {dnsRecords.map((record, i) => (
                                            <tr key={i} className="hover:bg-muted/10">
                                                <td className="py-2.5 px-4">
                                                    <Badge variant="outline" className={cn(
                                                        "text-[10px] font-bold",
                                                        record.type === "MX" && "border-blue-500/30 text-blue-600",
                                                        record.type === "CNAME" && "border-purple-500/30 text-purple-600",
                                                        record.type === "TXT" && "border-amber-500/30 text-amber-600",
                                                    )}>
                                                        {record.label}
                                                    </Badge>
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-xs font-bold">{record.type}</td>
                                                <td className="py-2.5 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded break-all">{record.name}</code>
                                                        <button
                                                            onClick={() => copyToClipboard(record.name)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                            title="Copy"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <div className="flex items-center gap-1">
                                                        <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded break-all">
                                                            {record.priority ? `${record.priority} ` : ""}{record.value}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(record.priority ? `${record.priority} ${record.value}` : record.value)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                            title="Copy"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-4"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Verified state — no DNS records to show */}
                    {replyDomain?.domain && replyDomain.status === "VERIFIED" && dnsRecords.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            All DNS records are verified. Inbound replies will route to the CRM automatically.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

