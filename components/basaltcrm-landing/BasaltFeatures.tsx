"use client";

import { motion } from "framer-motion";
import { Zap, Mail, Bot, Globe, MessageSquare, TrendingUp, Cpu, Server, Shield } from "lucide-react";
import LeadGenDashboard from "@/app/components/LeadGenDashboard";
import AgentInterface from "@/app/components/AgentInterface";
import AnalyticsGraph from "@/app/components/AnalyticsGraph";
import NeuralStreamVisualizer from "@/app/components/NeuralStreamVisualizer";

export default function BasaltFeatures() {
    return (
        <section id="features" className="relative pt-24 pb-32 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-24 text-center">
                    <h2 className="text-sm font-mono tracking-[0.5em] text-cyan-500 uppercase mb-4">Neural Architecture</h2>
                    <h3 className="text-4xl md:text-6xl font-bold text-white tracking-tight">System Capabilities</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
                    {[
                        { icon: Cpu, title: "DECISION INTELLIGENCE", desc: "Powered by Jev: buying intent, reply signals, and decisions you can inspect. Included for every team.", tag: "JEV", color: "text-violet-400" },
                        { icon: Cpu, title: "NEURAL DISCOVERY", desc: "Autonomous ICP mapping using multi-agent site crawls.", tag: "PHASE 01", color: "text-cyan-400" },
                        { icon: Bot, title: "AGENCY CORES", desc: "Deploy digital workers for SDR and CSM roles.", tag: "PHASE 02", color: "text-violet-400" },
                        { icon: TrendingUp, title: "COMMAND CENTER", desc: "Predictive revenue forecasting with sentiment deep-dives.", tag: "PHASE 03", color: "text-emerald-400" },
                        { icon: MessageSquare, title: "0.12s LATENCY", desc: "Real-time voice and text inference protocols.", tag: "INFRA", color: "text-blue-400" },
                        { icon: Globe, title: "MULTI-MODAL", desc: "Social, technical, and firmographic signal harvesting.", tag: "DATA", color: "text-fuchsia-400" },
                        { icon: Shield, title: "SOC2 CORE", desc: "Enterprise-grade guardrails for neural data.", tag: "SECURITY", color: "text-rose-400" },
                    ].map((feat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="group relative p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors duration-500 hover:-translate-y-2 overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <span className="text-[10px] font-mono text-gray-500 tracking-widest">{feat.tag}</span>
                            </div>

                            <div className="absolute -bottom-12 -right-12 opacity-10 group-hover:opacity-60 transition-[opacity,transform,filter] duration-700 pointer-events-none group-hover:scale-125 group-hover:-rotate-12 group-hover:drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                                <feat.icon className={`w-64 h-64 ${feat.color}`} />
                            </div>

                            <h4 className="text-xl font-bold text-white mb-3 uppercase tracking-tight relative z-10">{feat.title}</h4>
                            <p className="text-gray-400 leading-relaxed text-sm relative z-10">
                                {feat.desc}
                            </p>
                            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-700 ${feat.color}`} />
                        </motion.div>
                    ))}
                </div>

                {/* Basalt Echo Feature Highlight */}
                <div className="glass-panel rounded-3xl p-8 md:p-12 border border-cyan-500/30 relative overflow-hidden mt-32">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="max-w-xl">
                            <div className="inline-flex items-center gap-2 mb-4">
                                <span className="animate-pulse w-2 h-2 bg-cyan-500 rounded-full" />
                                <span className="text-xs font-mono text-cyan-500 tracking-widest uppercase">Infrastructure Fuel</span>
                            </div>
                            <h2 className="text-4xl font-bold text-white mb-6">BasaltEcho Architecture</h2>
                            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                                Our low-latency voice engine is battle-tested for high-volume outbound. Integrated directly with <span className="text-cyan-400">Azure AI Communication</span> and <span className="text-cyan-400">AWS SES</span> for maximum throughput.
                            </p>
                            <div className="flex gap-4">
                                <a
                                    href="https://echo.basalthq.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center px-10 py-4 font-bold text-black bg-cyan-400 rounded-xl hover:bg-white shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-colors duration-300 uppercase tracking-widest text-sm"
                                >
                                    Explore Echo
                                </a>
                                <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase">
                                    <Server className="h-4 w-4" /> Edge Provisioned
                                </div>
                            </div>
                        </div>
                        <div className="relative w-full md:w-1/3 aspect-square shadow-2xl">
                            <NeuralStreamVisualizer />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
