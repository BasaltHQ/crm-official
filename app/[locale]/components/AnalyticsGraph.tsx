"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, CheckCircle2, BarChart3, PieChart, Activity, Target, ArrowUpRight } from "lucide-react";

export default function AnalyticsGraph() {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStep((prev) => (prev + 1) % 8);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const metrics = [
        { label: "Revenue", value: "$124K", change: "+23%", color: "emerald" },
        { label: "Deals", value: "47", change: "+12%", color: "teal" },
        { label: "Win Rate", value: "68%", change: "+8%", color: "green" },
    ];

    const barData = [65, 82, 45, 93, 58, 77, 88];

    return (
        <div className="relative w-full h-full p-6 flex flex-col gap-4 overflow-hidden bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Predictive AI Active
                </div>
            </div>

            {/* Metric Cards */}
            <div className="flex gap-3">
                {metrics.map((metric, index) => (
                    <motion.div
                        key={metric.label}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                            opacity: step > index ? 1 : 0.3,
                            y: step > index ? 0 : 10,
                            borderColor: step === index ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.1)",
                        }}
                    >
                        <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                        <div className="flex items-end justify-between">
                            <span className="text-lg font-bold text-white">{metric.value}</span>
                            <span className="text-xs text-emerald-400 flex items-center">
                                <ArrowUpRight className="w-3 h-3" />
                                {metric.change}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Chart Area */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Revenue Forecast</div>
                    <div className="flex items-center gap-2">
                        <motion.div
                            animate={{
                                opacity: step >= 4 ? 1 : 0.5,
                            }}
                            className="flex items-center gap-1 text-xs text-emerald-400"
                        >
                            <Activity className="w-3 h-3" />
                            <span>95% Accuracy</span>
                        </motion.div>
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="flex items-end justify-between gap-2 h-24">
                    {barData.map((value, index) => (
                        <motion.div
                            key={index}
                            className="flex-1 bg-emerald-500/20 rounded-t relative overflow-hidden"
                            initial={{ height: 0 }}
                            animate={{
                                height: step >= 3 ? `${value}%` : 0,
                            }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <motion.div
                                className="absolute bottom-0 left-0 right-0 bg-emerald-500"
                                initial={{ height: 0 }}
                                animate={{
                                    height: step >= 4 ? "100%" : 0,
                                }}
                                transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Trend Line */}
                <AnimatePresence>
                    {step >= 5 && (
                        <motion.svg
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute bottom-8 left-4 right-4 h-24 pointer-events-none"
                        >
                            <motion.path
                                d="M 0 80 Q 50 60 100 50 T 200 30 T 300 20"
                                stroke="rgba(16,185,129,0.8)"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray="300"
                                initial={{ strokeDashoffset: 300 }}
                                animate={{ strokeDashoffset: 0 }}
                                transition={{ duration: 1 }}
                            />
                        </motion.svg>
                    )}
                </AnimatePresence>
            </div>

            {/* Sentiment & Pipeline Status */}
            <div className="grid grid-cols-2 gap-3">
                <motion.div
                    className="bg-white/5 border border-white/10 rounded-lg p-3"
                    animate={{
                        borderColor: step === 6 ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.1)",
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-medium text-white">Sentiment</span>
                    </div>
                    <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="flex-1 h-2 rounded-full bg-emerald-500/20"
                                initial={{ opacity: 0 }}
                                animate={{
                                    opacity: step >= 6 ? 1 : 0.3,
                                    backgroundColor: step >= 6 && i < 4 ? "rgba(16,185,129,0.8)" : "rgba(16,185,129,0.2)",
                                }}
                                transition={{ delay: i * 0.1 }}
                            />
                        ))}
                    </div>
                    <div className="text-xs text-emerald-400 mt-1">Highly Positive</div>
                </motion.div>

                <motion.div
                    className="bg-white/5 border border-white/10 rounded-lg p-3"
                    animate={{
                        borderColor: step === 6 ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.1)",
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-medium text-white">Pipeline</span>
                    </div>
                    <div className="w-full h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-emerald-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: step >= 6 ? "78%" : "0%" }}
                            transition={{ duration: 0.8 }}
                        />
                    </div>
                    <div className="text-xs text-emerald-400 mt-1">78% to Goal</div>
                </motion.div>
            </div>

            {/* Prediction Result */}
            <AnimatePresence>
                {step >= 7 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-emerald-900/50 to-green-900/50 p-4 rounded-xl border border-emerald-500/50 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">Q4 Forecast</div>
                                <div className="text-xs text-emerald-200">$485K projected revenue</div>
                            </div>
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
