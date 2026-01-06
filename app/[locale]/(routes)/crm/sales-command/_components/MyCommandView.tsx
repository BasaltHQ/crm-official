"use client";

import React from "react";
import { useSalesCommand } from "./SalesCommandProvider";
import { UnifiedMetricCard } from "./UnifiedMetricCard";
import { UnifiedStageBar } from "./UnifiedStageBar";
import { motion } from "framer-motion";

export default function MyCommandView() {
    const { data, selectedUserData } = useSalesCommand();
    // Use drilled-down data if available, otherwise fallback to own data
    const activeData = selectedUserData ? {
        myPipeline: selectedUserData.pipeline,
        myScore: selectedUserData.score,
        myRank: selectedUserData.rank,
        name: selectedUserData.meta.userName
    } : {
        ...data.userData,
        name: "My"
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* Left Column: Pipeline Health */}
            <div className="lg:col-span-4 space-y-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border bg-card p-6 shadow-sm h-full"
                >
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold tracking-tight">{activeData.name === "My" ? "My Pipeline" : `${activeData.name}'s Pipeline`}</h2>
                        <p className="text-sm text-muted-foreground">Real-time status of active leads.</p>
                    </div>
                    <UnifiedStageBar
                        stages={activeData.myPipeline.counts as any}
                        total={activeData.myPipeline.total}
                        orientation="vertical"
                        height={500}
                        className="w-full"
                    />
                </motion.div>
            </div>

            {/* Middle Column: Tasks & Actions (Placeholder for future expansion) */}
            <div className="lg:col-span-5 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border bg-card p-6 shadow-sm min-h-[400px]"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">Priority Actions</h2>
                            <p className="text-sm text-muted-foreground">Focus on these tasks today.</p>
                        </div>
                        <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full hover:opacity-90 transition">
                            + New Task
                        </button>
                    </div>

                    {/* Placeholder Empty State */}
                    <div className="flex flex-col items-center justify-center h-[300px] text-center border-2 border-dashed rounded-lg bg-muted/20">
                        <div className="text-muted-foreground text-sm">No urgent tasks pending.</div>
                        <div className="text-xs text-muted-foreground mt-1">Great job clearing your queue!</div>
                    </div>
                </motion.div>
            </div>

            {/* Right Column: Performance & Rank */}
            <div className="lg:col-span-3 space-y-4">
                <UnifiedMetricCard
                    title="Revenue Score"
                    value={activeData.myScore * 100} // Placeholder calculation for revenue derived from score/points
                    subtitle="Estimated value closed"
                    iconName="DollarSign"
                    accentColor="emerald"
                    delay={0.2}
                />
                <UnifiedMetricCard
                    title="Team Rank"
                    value={`#${activeData.myRank ?? "-"}`}
                    subtitle={`Top ${activeData.myRank && activeData.myRank <= 3 ? "Performer" : "Contender"}`}
                    iconName="TrendingUp"
                    accentColor="violet"
                    delay={0.3}
                />
                <UnifiedMetricCard
                    title="Pipeline Value"
                    value={activeData.myPipeline.total}
                    subtitle="Active Deals"
                    iconName="Target"
                    accentColor="cyan"
                    delay={0.4}
                />
            </div>
        </div>
    );
}
