"use client";

import React from "react";
import { WidgetWrapper } from "./WidgetWrapper";
import { Wand2, Zap, Play, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadWizardWidgetProps {
    data: {
        activeJobs: any[];
        recentSuccessCount: number;
    } | null;
}

export const LeadWizardWidget = ({ data }: LeadWizardWidgetProps) => {
    return (
        <WidgetWrapper
            title="Lead Wizard"
            icon={Wand2}
            iconColor="text-cyan-400"
            footerHref="/crm/lead-wizard"
            footerLabel="Open Wizard"
        >
            <div className="space-y-4 pt-2">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20 group cursor-pointer hover:border-cyan-500/40 transition-all">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                                New Discovery Session
                                <Zap size={12} className="text-cyan-400 animate-pulse" />
                            </h3>
                            <p className="text-[11px] text-cyan-100/60 leading-relaxed max-w-[180px]">
                                Find high-intent leads using AI-driven industry & geo targeting.
                            </p>
                        </div>
                        <div className="p-2 bg-cyan-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                            <Play size={14} fill="currentColor" />
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Background Discovery</span>
                        {data?.activeJobs.length ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                                {data.activeJobs.length} Running
                            </span>
                        ) : (
                            <span className="text-[10px] font-medium text-muted-foreground/50 italic">Idle</span>
                        )}
                    </div>

                    {data?.activeJobs.map((job, i) => (
                        <div key={job.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                                    <Target size={12} />
                                </div>
                                <p className="text-[11px] font-medium text-white/80 truncate">
                                    {job.assigned_pool?.name || "Global Pool"}
                                </p>
                            </div>
                            <Progress value={45} className="w-12 h-1 bg-white/5" indicatorClassName="bg-cyan-500" />
                        </div>
                    ))}

                    {data?.recentSuccessCount ? (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 size={12} />
                            <span>{data.recentSuccessCount} successful jobs in last 24h</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </WidgetWrapper>
    );
};

// Re-importing Progress because sometimes relative paths get tricky in these quick writes
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
