"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    ShieldCheck,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Building2,
    Smartphone,
    LifeBuoy,
    Mail,
    Lock,
    Server,
    Activity,
    Check,
    ClipboardCheck
} from "lucide-react";
import { toast } from "react-hot-toast";
import { logUserMetric } from "@/actions/university/log-user-metric";

const CHECKLIST_ITEMS = [
    {
        id: "spf_dkim",
        label: "SPF & 2048-bit DKIM DNS records verified on sending domain",
        category: "Email Auth"
    },
    {
        id: "dmarc_policy",
        label: "DMARC policy active (p=quarantine or p=reject) with RUA reporting",
        category: "Email Auth"
    },
    {
        id: "ten_dlc",
        label: "10DLC Brand & Campaign registration approved by carriers",
        category: "SMS 10DLC"
    },
    {
        id: "opt_in_audit",
        label: "Target Lead Pool audited for documented Prior Express Consent",
        category: "TCPA / GDPR"
    },
    {
        id: "unsubscribe_header",
        label: "One-Click List-Unsubscribe header & 'Reply STOP' footer enabled",
        category: "Deliverability"
    },
    {
        id: "bounce_breaker",
        label: "Automated hard-bounce (< 2%) and spam-complaint (< 0.1%) circuit breaker armed",
        category: "Deliverability"
    },
];

export default function ComplianceAcademy() {
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [moduleLogged, setModuleLogged] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("basalt_university_compliance_checklist");
            if (saved) {
                setCheckedItems(JSON.parse(saved));
            }
        } catch {}
    }, []);

    const handleToggleCheck = async (id: string) => {
        const next = { ...checkedItems, [id]: !checkedItems[id] };
        setCheckedItems(next);
        try {
            localStorage.setItem("basalt_university_compliance_checklist", JSON.stringify(next));
        } catch {}

        const completedCount = CHECKLIST_ITEMS.filter((item) => !!next[item.id]).length;
        if (completedCount === CHECKLIST_ITEMS.length && !moduleLogged) {
            setModuleLogged(true);
            try {
                await logUserMetric("completed_training_module");
                toast.success("Pre-Launch Compliance Checklist Complete! Mastery training credit recorded.");
            } catch {
                toast.success("Pre-Launch Compliance Checklist Complete!");
            }
        }
    };

    const completedChecklistCount = CHECKLIST_ITEMS.filter((item) => !!checkedItems[item.id]).length;
    const isChecklistComplete = completedChecklistCount === CHECKLIST_ITEMS.length;

    const tenDlcSteps = [
        {
            title: "Brand Registration",
            description: "Submit your legal entity information (EIN, Address, Website) to get verified for SMS.",
            status: "Foundational",
            icon: Building2,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            borderColor: "border-blue-500/20"
        },
        {
            title: "Campaign Submission",
            description: "Define your use case (e.g., Marketing, Notifications) and provide sample messages for review.",
            status: "Verification",
            icon: MessageSquare,
            color: "text-violet-500",
            bgColor: "bg-violet-500/10",
            borderColor: "border-violet-500/20"
        },
        {
            title: "Number Matching",
            description: "Assign your high-deliverability numbers to your approved campaign.",
            status: "Activation",
            icon: Smartphone,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
            borderColor: "border-emerald-500/20"
        }
    ];

    const emailAuthPillars = [
        {
            protocol: "SPF",
            name: "Sender Policy Framework",
            record: "v=spf1 include:_spf.basaltcrm.com ~all",
            description: "Authorizes BasaltCRM outbound mail servers to send on behalf of your root and subdomain.",
            icon: Server,
            color: "text-cyan-400",
            bgColor: "bg-cyan-500/10",
        },
        {
            protocol: "DKIM",
            name: "DomainKeys Identified Mail",
            record: "basalt._domainkey.yourdomain.com (2048-bit RSA)",
            description: "Attaches a cryptographic signature to every email header so inbox providers verify it wasn't altered in transit.",
            icon: Lock,
            color: "text-indigo-400",
            bgColor: "bg-indigo-500/10",
        },
        {
            protocol: "DMARC",
            name: "Domain-based Message Auth",
            record: "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com",
            description: "Instructs Gmail, Outlook, and enterprise gateways how to handle unauthenticated mail and sends daily reputation telemetry.",
            icon: ShieldCheck,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10",
        },
        {
            protocol: "WARMUP",
            name: "Progressive Volume Ramp",
            record: "Max +15% daily volume | < 2.0% Bounce Limit",
            description: "Gradually builds sender reputation on new domains and automatically pauses sequences if bounce thresholds spike.",
            icon: Activity,
            color: "text-amber-400",
            bgColor: "bg-amber-500/10",
        },
    ];

    const complianceRules = [
        {
            title: "Prior Express Consent",
            description: "You must have documented permission before sending any non-essential outreach.",
            icon: CheckCircle2,
            severity: "Critical"
        },
        {
            title: "Clear Opt-Out",
            description: "Every initial message must include 'Reply STOP to unsubscribe' or similar language.",
            icon: AlertCircle,
            severity: "Required"
        },
        {
            title: "Identification",
            description: "Always identify your company in the first message of a sequence.",
            icon: ShieldCheck,
            severity: "Required"
        }
    ];

    return (
        <div className="space-y-8 pb-4">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* 10DLC Track */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            <Smartphone className="w-6 h-6 text-blue-400" />
                            10DLC Path-to-Live (SMS)
                        </h3>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-black text-gray-500 border-white/10 px-3 py-1">
                            Carrier Approved
                        </Badge>
                    </div>

                    <div className="relative space-y-6">
                        {tenDlcSteps.map((step, idx) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={cn(
                                    "relative p-8 rounded-3xl border bg-white/[0.02] transition-colors hover:bg-white/[0.05] group",
                                    step.borderColor
                                )}
                            >
                                <div className="flex items-start gap-6">
                                    <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-500", step.bgColor, step.color)}>
                                        <step.icon className="w-7 h-7" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-black text-xl tracking-tight">{step.title}</h4>
                                            <Badge variant="secondary" className="text-[10px] uppercase font-black py-1 px-3">
                                                {step.status}
                                            </Badge>
                                        </div>
                                        <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                                {idx < tenDlcSteps.length - 1 && (
                                    <div className="absolute -bottom-6 left-14 w-px h-6 bg-gradient-to-b from-white/10 to-transparent hidden md:block" />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* TCPA Rules */}
                <div className="space-y-8">
                    <div className="flex items-center border-b border-white/5 pb-4">
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            Outreach Guards
                        </h3>
                    </div>

                    <Card className="bg-white/[0.02] border-white/10 overflow-hidden shadow-2xl">
                        <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                            <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">The Golden Rules</CardTitle>
                            <CardDescription className="text-xs font-medium text-gray-500">Industry standards for high deliverability.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {complianceRules.map((rule) => (
                                    <div key={rule.title} className="p-6 space-y-3 group hover:bg-white/[0.03] transition-colors cursor-default">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                                                    <rule.icon className="w-4 h-4" />
                                                </div>
                                                <span className="font-black text-sm uppercase tracking-tight">{rule.title}</span>
                                            </div>
                                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-black px-2 py-0.5 uppercase tracking-widest">
                                                {rule.severity}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed pl-10 group-hover:text-gray-300 transition-colors">
                                            {rule.description}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 bg-blue-500/[0.03] border-t border-white/5 mt-auto">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 flex-shrink-0">
                                        <LifeBuoy className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-black uppercase tracking-tight">Need assistance?</p>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Our compliance team reviews all 10DLC applications before submission to ensure your brand gets verified instantly.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Email Deliverability & Authentication Module */}
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <Mail className="w-6 h-6 text-cyan-400" />
                        Email Deliverability & Authentication
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-black text-cyan-400 border-cyan-500/20 bg-cyan-500/5 px-3 py-1">
                        RFC 7489 / Google & Yahoo 2024+ Standard
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {emailAuthPillars.map((pillar) => (
                        <Card key={pillar.protocol} className="bg-white/[0.02] border-white/10 hover:border-white/20 transition-colors">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className={cn("p-3 rounded-xl", pillar.bgColor, pillar.color)}>
                                        <pillar.icon className="w-5 h-5" />
                                    </div>
                                    <Badge variant="secondary" className="font-mono text-[10px] font-black uppercase tracking-widest">
                                        {pillar.protocol}
                                    </Badge>
                                </div>
                                <div>
                                    <h4 className="font-black text-base text-white">{pillar.name}</h4>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{pillar.description}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 font-mono text-[10px] text-gray-300 truncate">
                                    {pillar.record}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Interactive Pre-Launch Compliance Checklist */}
            <Card className={cn(
                "border overflow-hidden transition-colors",
                isChecklistComplete
                    ? "bg-emerald-500/[0.04] border-emerald-500/30"
                    : "bg-white/[0.02] border-white/10"
            )}>
                <CardHeader className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <ClipboardCheck className={cn("w-6 h-6", isChecklistComplete ? "text-emerald-400" : "text-blue-400")} />
                            <CardTitle className="text-xl font-black uppercase tracking-tight">
                                Pre-Launch Compliance Checklist (1,000+ Prospect Campaigns)
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-gray-400">
                            Verify every item below before activating high-volume SMS or Email outbound sequences. Completing this checklist also awards University training credit.
                        </CardDescription>
                    </div>
                    <Badge
                        className={cn(
                            "text-xs font-black uppercase tracking-widest px-4 py-1.5 shrink-0",
                            isChecklistComplete
                                ? "bg-emerald-500 text-black"
                                : "bg-white/10 text-gray-300 border-white/10"
                        )}
                    >
                        {completedChecklistCount} / {CHECKLIST_ITEMS.length} Verified
                    </Badge>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CHECKLIST_ITEMS.map((item) => {
                            const isChecked = !!checkedItems[item.id];
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleToggleCheck(item.id)}
                                    className={cn(
                                        "flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all",
                                        isChecked
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                                            : "bg-black/40 border-white/10 text-gray-300 hover:border-white/25 hover:bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div
                                            className={cn(
                                                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                                isChecked
                                                    ? "bg-emerald-500 border-emerald-400 text-black"
                                                    : "border-white/20 bg-white/5"
                                            )}
                                        >
                                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>
                                        <span className={cn("text-xs font-bold leading-snug", isChecked && "text-emerald-300")}>
                                            {item.label}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-white/10 text-gray-400 shrink-0">
                                        {item.category}
                                    </Badge>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Opt-out Management Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >
                <Card className="bg-gradient-to-r from-emerald-500/5 to-transparent border-emerald-500/20 overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                                <MessageSquare className="w-10 h-10 text-emerald-400" />
                            </div>
                            <div className="flex-1 space-y-2 text-center md:text-left">
                                <h3 className="text-xl font-bold font-mono uppercase tracking-tighter">Automated Opt-out Handling</h3>
                                <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
                                    BasaltCRM automatically detects legally required keywords like <strong className="text-emerald-400 font-mono">STOP</strong>, <strong className="text-emerald-400 font-mono">QUIT</strong>, and <strong className="text-emerald-400 font-mono">UNSUBSCRIBE</strong>. When a recipient replies with these, our system instantly flags the record and halts all active sequences to protect your sender reputation and ensure TCPA compliance.
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3">
                                {["STOP", "REMOVE", "CANCEL"].map(word => (
                                    <Badge key={word} variant="secondary" className="px-3 py-1 bg-black/40 text-emerald-400 font-mono tracking-widest border border-emerald-500/10">
                                        {word}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
