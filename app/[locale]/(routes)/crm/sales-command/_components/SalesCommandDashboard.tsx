"use client";

import React from "react";
import { useSalesCommand } from "./SalesCommandProvider";
import { UnifiedMetricCard } from "./UnifiedMetricCard";
import MyCommandView from "./MyCommandView";
import TeamCommandView from "./TeamCommandView";

import { cn } from "@/lib/utils";
import Container from "../../../components/ui/Container"; // Adjust path if needed

export default function SalesCommandDashboard() {
    const { data, viewMode, setViewMode, isManager, selectedUserData } = useSalesCommand();
    const { summary } = data;

    return (
        <Container
            title="Unified Sales Command"
            description="Centralized control for pipeline, tasks, and team analytics."
        >
            <div className="space-y-8">

                {/* Global Stats Header (Sticky-ish feel) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <UnifiedMetricCard
                        title="Total Revenue"
                        value={summary.revenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                        subtitle="From active opportunities"
                        iconName="DollarSign"
                        accentColor="emerald"
                    />
                    <UnifiedMetricCard
                        title="Active Deals"
                        value={summary.activeDeals}
                        subtitle="Total pipeline volume"
                        iconName="Zap"
                        accentColor="amber"
                        delay={0.1}
                    />
                    <UnifiedMetricCard
                        title="Active Team"
                        value={summary.activeUsers}
                        subtitle="Sales representatives"
                        iconName="Users2"
                        accentColor="cyan"
                        delay={0.2}
                    />
                    <UnifiedMetricCard
                        title="Storage"
                        value={`${summary.storagePercentage.toFixed(1)}%`}
                        subtitle="Quota used"
                        iconName="HardDrive"
                        accentColor={summary.storagePercentage > 80 ? "rose" : "violet"}
                        delay={0.3}
                    />
                </div>

                {/* View Controller */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode("team")}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-md transition-all",
                                viewMode === "team"
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setViewMode("personal")}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-md transition-all",
                                viewMode === "personal"
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {/* Dynamic Title if drilling down */}
                            {selectedUserData && selectedUserData.meta.userName !== "Me"
                                ? `${selectedUserData.meta.userName}'s Dashboard`
                                : "My Dashboard"}
                        </button>

                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            Last updated: {new Date(data.meta.serverTime).toLocaleTimeString()}
                        </span>
                        {isManager && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                                Admin Access
                            </span>
                        )}
                    </div>
                </div>

                {/* Dynamic View Content */}
                <div className="min-h-[500px]">
                    {viewMode === "personal" && <MyCommandView />}
                    {viewMode === "team" && <TeamCommandView />}

                </div>

            </div>
        </Container>
    );
}
