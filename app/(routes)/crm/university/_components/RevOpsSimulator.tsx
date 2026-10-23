"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    Title,
    AreaChart,
    Metric,
    Text,
    Flex,
    Divider,
    CategoryBar,
} from "@tremor/react";
import {
    Clock,
    Zap,
    DollarSign,
    Target,
    CheckCircle2,
    ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { logUserMetric } from "@/actions/university/log-user-metric";

const COLOR_TEXT_MAP: Record<string, string> = {
    slate: "text-slate-300",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
};

export default function RevOpsSimulator() {
    const router = useRouter();

    // Current Baseline
    const [arr, setArr] = useState(500000);
    const [teamSize, setTeamSize] = useState(5);
    const [leadsPerMonth, setLeadsPerMonth] = useState(200);
    const [closeRate, setCloseRate] = useState(15); // Percentage
    const [dataHealth, setDataHealth] = useState(60); // 0-100%

    // "What-if" improvements (multipliers/percentages)
    const [aiEfficiency, setAiEfficiency] = useState(20); // 0-100% boost in efficiency
    const [speedToLeadBoost, setSpeedToLeadBoost] = useState(15); // 0-50% improvement in close rate due to speed
    const [strategyApplied, setStrategyApplied] = useState(false);

    const results = useMemo(() => {
        // Baseline annual revenue scales with ARR anchor, lead volume (vs 200 baseline), and close rate (vs 15% baseline)
        const volumeFactor = 0.5 + 0.5 * (leadsPerMonth / 200);
        const closeFactor = 0.5 + 0.5 * (closeRate / 15);
        const baselineAnnRevenue = Math.round(arr * volumeFactor * closeFactor);

        // Optimization levers:
        // 1. Data health & enrichment increases pursuable/deliverable pipeline (50% = 1.0x, 100% = 1.3x)
        const dataMultiplier = 0.75 + (dataHealth / 100) * 0.5;
        // 2. AI efficiency increases rep follow-up capacity & multi-touch conversion (0% = 1.0x, 100% = 1.25x)
        const aiMultiplier = 1 + (aiEfficiency / 100) * 0.25;
        // 3. Speed-to-lead directly boosts close rate (0% = 1.0x, 50% = 1.5x)
        const speedMultiplier = 1 + (speedToLeadBoost / 100);

        const combinedOptimization = Math.max(1.02, dataMultiplier * aiMultiplier * speedMultiplier);
        const improvedAnnRevenue = Math.round(baselineAnnRevenue * combinedOptimization);

        const revenueLift = Math.max(0, improvedAnnRevenue - baselineAnnRevenue);
        const revenueLiftPct = baselineAnnRevenue > 0 ? ((improvedAnnRevenue / baselineAnnRevenue) - 1) * 100 : 0;
        const timeSavedHours = Math.round(teamSize * 160 * (aiEfficiency / 100) * 0.25);

        const estAnnualInvestment = Math.max(6000, teamSize * 1800);
        const roiMultiplier = (revenueLift / estAnnualInvestment).toFixed(1);

        const enrichmentMatchRate = Math.min(99, Math.round(52 + dataHealth * 0.42));
        const velocityScore = Math.min(99, Math.round(45 + speedToLeadBoost * 0.7 + aiEfficiency * 0.2));

        return {
            baselineAnnRevenue,
            improvedAnnRevenue,
            revenueLift,
            revenueLiftPct,
            timeSavedHours,
            roiMultiplier,
            enrichmentMatchRate,
            velocityScore,
        };
    }, [arr, leadsPerMonth, closeRate, dataHealth, aiEfficiency, speedToLeadBoost, teamSize]);

    const chartData = useMemo(() => {
        return [
            { month: "Current", Revenue: results.baselineAnnRevenue },
            { month: "Month 3", Revenue: Math.round(results.baselineAnnRevenue + results.revenueLift * 0.3) },
            { month: "Month 6", Revenue: Math.round(results.baselineAnnRevenue + results.revenueLift * 0.6) },
            { month: "Month 9", Revenue: Math.round(results.baselineAnnRevenue + results.revenueLift * 0.85) },
            { month: "Optimized", Revenue: results.improvedAnnRevenue },
        ];
    }, [results]);

    const handleApplyStrategy = async () => {
        setStrategyApplied(true);
        try {
            await logUserMetric("forecast_reviewed");
        } catch {}
        toast.success(
            `RevOps Strategy Applied! Projected Lift: +$${(results.revenueLift / 1000).toFixed(1)}k/yr (${results.roiMultiplier}x ROI)`
        );
    };

    return (
        <div className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs */}
                <Card className="bg-card border-border ring-0 shadow-sm space-y-6">
                    <div>
                        <Title className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Baseline Metrics</Title>
                        <div className="space-y-4">
                            <InputRange
                                label="Annual Revenue Anchor"
                                value={arr}
                                min={100000}
                                max={5000000}
                                step={50000}
                                formatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                onChange={(val) => setArr(val)}
                            />
                            <InputRange
                                label="Lead Volume / Mo"
                                value={leadsPerMonth}
                                min={10}
                                max={1000}
                                step={10}
                                formatter={(val) => `${val} leads`}
                                onChange={(val) => setLeadsPerMonth(val)}
                            />
                            <InputRange
                                label="Baseline Close Rate"
                                value={closeRate}
                                min={5}
                                max={40}
                                step={1}
                                formatter={(val) => `${val}%`}
                                onChange={(val) => setCloseRate(val)}
                            />
                            <InputRange
                                label="Team Size"
                                value={teamSize}
                                min={1}
                                max={50}
                                step={1}
                                formatter={(val) => `${val} reps`}
                                onChange={(val) => setTeamSize(val)}
                            />
                        </div>
                    </div>

                    <Divider />

                    <div>
                        <Title className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4">Optimization Levers</Title>
                        <div className="space-y-4">
                            <InputRange
                                label="Data Health & Enrichment"
                                value={dataHealth}
                                min={0}
                                max={100}
                                step={5}
                                formatter={(val) => `${val}% Accuracy`}
                                color="emerald"
                                onChange={(val) => setDataHealth(val)}
                            />
                            <InputRange
                                label="AI Efficiency Gains"
                                value={aiEfficiency}
                                min={0}
                                max={100}
                                step={5}
                                formatter={(val) => `+${val}% Output`}
                                color="blue"
                                onChange={(val) => setAiEfficiency(val)}
                            />
                            <InputRange
                                label="Speed-to-Lead Impact"
                                value={speedToLeadBoost}
                                min={0}
                                max={50}
                                step={1}
                                formatter={(val) => `+${val}% Close Rate`}
                                color="violet"
                                onChange={(val) => setSpeedToLeadBoost(val)}
                            />
                        </div>
                    </div>
                </Card>

                {/* Results & Projections */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ResultCard
                            title="Annual Revenue Lift"
                            metric={`+$${(results.revenueLift / 1000).toFixed(1)}k`}
                            icon={DollarSign}
                            color="text-emerald-400"
                        />
                        <ResultCard
                            title="Monthly Hours Saved"
                            metric={`${results.timeSavedHours}h`}
                            icon={Clock}
                            color="text-blue-400"
                        />
                        <ResultCard
                            title="Net Pipeline Expansion"
                            metric={`+${results.revenueLiftPct.toFixed(1)}%`}
                            icon={Target}
                            color="text-violet-400"
                        />
                        <ResultCard
                            title="Est. ROI Multiplier"
                            metric={`${results.roiMultiplier}x`}
                            icon={Zap}
                            color="text-amber-400"
                        />
                    </div>

                    <Card className="bg-card border-border ring-0 shadow-sm">
                        <Title className="text-foreground">Projected Growth Path</Title>
                        <AreaChart
                            className="h-72 mt-4"
                            data={chartData}
                            index="month"
                            categories={["Revenue"]}
                            colors={["emerald"]}
                            valueFormatter={(number: number) => `$${(number / 1000).toFixed(0)}k`}
                            showAnimation={true}
                            showYAxis={false}
                            showXAxis={true}
                            showGridLines={false}
                            startEndOnly={true}
                        />
                    </Card>

                    {/* Integrated Performance Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-card border-border ring-0 shadow-sm">
                            <Title className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">System Performance Baseline</Title>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Flex>
                                        <Text className="text-xs">Data Cleanliness</Text>
                                        <Text className="text-xs font-bold text-emerald-400">{dataHealth}%</Text>
                                    </Flex>
                                    <CategoryBar
                                        values={[40, 30, 30]}
                                        colors={["rose", "amber", "emerald"]}
                                        markerValue={dataHealth}
                                        showLabels={false}
                                        className="h-2.5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Flex>
                                        <Text className="text-xs">Enrichment Match Rate</Text>
                                        <Text className="text-xs font-bold text-blue-400">{results.enrichmentMatchRate}%</Text>
                                    </Flex>
                                    <CategoryBar
                                        values={[30, 40, 30]}
                                        colors={["rose", "amber", "emerald"]}
                                        markerValue={results.enrichmentMatchRate}
                                        showLabels={false}
                                        className="h-2.5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Flex>
                                        <Text className="text-xs">Lead Velocity Score</Text>
                                        <Text className="text-xs font-bold text-violet-400">
                                            {results.velocityScore >= 75 ? "Elite" : results.velocityScore >= 55 ? "High" : "Moderate"} ({results.velocityScore}/100)
                                        </Text>
                                    </Flex>
                                    <CategoryBar
                                        values={[20, 30, 50]}
                                        colors={["rose", "amber", "emerald"]}
                                        markerValue={results.velocityScore}
                                        showLabels={false}
                                        className="h-2.5"
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="bg-card border-border ring-0 shadow-sm">
                            <Title className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Strategic Action Items</Title>
                            <div className="space-y-3">
                                {[
                                    { text: `Enrich ${leadsPerMonth} monthly leads to ${dataHealth}% accuracy`, color: "text-blue-400", href: "/crm/lead-pools" },
                                    { text: `Automate AI multi-channel sequences (+${aiEfficiency}% output)`, color: "text-emerald-400", href: "/campaigns" },
                                    { text: `Deploy FlowState instant routing (+${speedToLeadBoost}% close lift)`, color: "text-violet-400", href: "/crm/workflows" }
                                ].map((item, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => router.push(item.href)}
                                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("w-1.5 h-1.5 rounded-full bg-current shrink-0", item.color)} />
                                            <Text className="text-xs text-gray-300 truncate">{item.text}</Text>
                                        </div>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-blue-400 shrink-0" />
                            <Text className="text-sm text-gray-300">
                                Scaling these efficiencies across your {teamSize}-person team projects an optimized run-rate of{" "}
                                <span className="text-emerald-400 font-bold">${(results.improvedAnnRevenue / 1000).toFixed(0)}k/yr</span>.
                            </Text>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyStrategy}
                            className={cn(
                                "px-4 py-2 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0",
                                strategyApplied ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-500 hover:bg-blue-400"
                            )}
                        >
                            {strategyApplied && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {strategyApplied ? "Strategy Logged" : "Apply Strategy"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InputRange({ label, value, min, max, step, formatter, color = "slate", onChange }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatter?: (val: number) => string;
    color?: string;
    onChange: (val: number) => void;
}) {
    const colorClass = COLOR_TEXT_MAP[color] || "text-slate-300";
    return (
        <div className="space-y-2">
            <Flex>
                <Text className="text-xs font-medium text-gray-400">{label}</Text>
                <Text className={cn("text-xs font-bold", colorClass)}>{formatter ? formatter(value) : value}</Text>
            </Flex>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </div>
    );
}

function ResultCard({ title, metric, icon: Icon, color }: { title: string; metric: string; icon: any; color: string }) {
    return (
        <Card className="bg-card border-border ring-0 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icon className={cn("w-12 h-12", color)} />
            </div>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</Text>
            <Metric className={cn("text-2xl font-black mt-1", color)}>{metric}</Metric>
        </Card>
    );
}
