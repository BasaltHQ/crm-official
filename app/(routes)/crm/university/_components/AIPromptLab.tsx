"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Bot,
    MessageCircle,
    Sparkles,
    Settings2,
    Play,
    Copy,
    Check,
    Cpu,
    Zap,
    Mic2,
    Save,
    RotateCcw,
    ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { logUserMetric } from "@/actions/university/log-user-metric";

const PERSONAS = [
    {
        name: "The Consultative Partner",
        role: "Strategic Advisor",
        description: "Focuses on deep discovery and long-term value. Best for high-ticket Enterprise deals.",
        tone: "Professional, Empathetic, Authority-driven",
        defaultTemp: 0.4,
        defaultLength: 2,
        samplePrompt: "You are a senior strategic advisor. Your goal is to uncover the underlying business challenges and demonstrate how our platform acts as a catalyst for growth. Do not rush the close; focus on building extreme trust.",
        tags: ["High Ticket", "Enterprise", "B2B"]
    },
    {
        name: "The High-Energy Closer",
        role: "Sales Specialist",
        description: "Fast-paced and focused on immediate action. Best for transactional sales and limited-time offers.",
        tone: "Enthusiastic, Urgent, Benefits-focused",
        defaultTemp: 0.75,
        defaultLength: 1,
        samplePrompt: "You are a high-energy sales specialist. Your goal is to highlight the immediate ROI and create a sense of healthy urgency. Focus on 'Quick Wins' and ease of implementation.",
        tags: ["Transactional", "SaaS", "Fast Paced"]
    },
    {
        name: "The Technical Expert",
        role: "Solutions Engineer",
        description: "Deep technical knowledge. Best for developer-facing products or complex implementations.",
        tone: "Precise, Fact-based, Logical",
        defaultTemp: 0.2,
        defaultLength: 3,
        samplePrompt: "You are a principal solutions engineer. You lead with data and technical specifications. Avoid fluff; provide clear, verifiable answers to technical hurdles.",
        tags: ["Technical", "DevOps", "Precise"]
    }
];

const SCENARIOS = [
    { id: "cold_intro", label: "Cold Outbound Intro", context: "VP of RevOps scaling outbound team" },
    { id: "discovery_followup", label: "Post-Discovery Follow-Up", context: "Recapping pipeline bottlenecks" },
    { id: "objection", label: "Pricing / ROI Objection", context: "Evaluating migration cost vs ROI" },
    { id: "reactivation", label: "Stale Deal Re-engagement", context: "Prospect went quiet after demo" },
];

function generateSimulatedOutput(
    prompt: string,
    scenarioId: string,
    temperature: number,
    lengthLevel: number
): string {
    const lowerPrompt = prompt.toLowerCase();
    const isTechnical = lowerPrompt.includes("technical") || lowerPrompt.includes("engineer") || lowerPrompt.includes("data") || lowerPrompt.includes("spec");
    const isCloser = lowerPrompt.includes("urgency") || lowerPrompt.includes("quick win") || lowerPrompt.includes("roi") || lowerPrompt.includes("high-energy");

    const greeting = temperature > 0.65
        ? "Hey Alex — loved seeing your team's recent expansion!"
        : isTechnical
            ? "Hi Alex,"
            : "Hello Alex,";

    let coreBody = "";
    if (scenarioId === "cold_intro") {
        if (isTechnical) {
            coreBody = "I reviewed your stack architecture and noticed your SDRs are manually syncing enrichment payloads between lead pools and outbound queues. BasaltCRM's native webhook & AI LeadGen pipeline eliminates that latency with sub-second deduplication and automated 10DLC/SPF guardrails.";
        } else if (isCloser) {
            coreBody = "Teams scaling past 5 reps usually lose 6+ hours a week to manual list hygiene. We can spin up an automated AI LeadGen + Power Dialer workflow for your team in under 48 hours so your reps double their live conversations this week.";
        } else {
            coreBody = "While researching how fast-growing RevOps teams are structuring their outbound motion this quarter, I noticed you're scaling your enterprise segment. I'm curious — what is currently the biggest bottleneck between account discovery and qualified pipeline?";
        }
    } else if (scenarioId === "discovery_followup") {
        if (isTechnical) {
            coreBody = "Following up on our architecture review: I've mapped out how your custom objects, Enrichers, and FlowState triggers connect with zero middleware. Every stage transition from Lead to Opportunity automatically provisions the downstream delivery project.";
        } else if (isCloser) {
            coreBody = "Great speaking today! Based on your 200 monthly lead target, turning on automated Speed-to-Lead routing will immediately lift your close rate by ~18%. Let's lock in your onboarding slot for Thursday so you capture this month's pipeline.";
        } else {
            coreBody = "Thank you for sharing your team's Q3 priorities today. To align with your goal of improving data hygiene while protecting rep selling time, I've outlined a phased rollout that addresses lead enrichment first before automating multi-channel follow-ups.";
        }
    } else if (scenarioId === "objection") {
        if (isTechnical) {
            coreBody = "Regarding total cost of ownership: consolidating your standalone dialer, enrichment API credits, and workflow engine into BasaltCRM reduces per-seat infrastructure overhead by 34% while maintaining 99.9% webhook reliability.";
        } else if (isCloser) {
            coreBody = "I completely understand watching budget closely — that's exactly why teams switch to BasaltCRM. Closing just one additional deal from automated follow-ups pays for the entire annual license in month one.";
        } else {
            coreBody = "Evaluating the investment against measurable outcomes makes complete sense. If we look at the 15 hours per rep saved each month alongside a conservative 12% lift in stage conversion, let's review whether the net return justifies the transition.";
        }
    } else {
        if (isTechnical) {
            coreBody = "Since we last spoke, we shipped upgraded AI Prompt Lab personas and real-time RevOps telemetry. If data enrichment latency is still on your roadmap, I'd be glad to share the updated benchmark specs.";
        } else if (isCloser) {
            coreBody = "Wanted to put this back at the top of your inbox! We just opened two fast-track implementation spots for this month — should we get your workspace live before the quarter closes?";
        } else {
            coreBody = "I know priorities shift quickly during the quarter. Are pipeline visibility and automated lead routing still key initiatives for your team, or would it make sense to reconnect next month?";
        }
    }

    const closing = lengthLevel === 1
        ? "Open to a quick 10-minute walkthrough Tuesday?"
        : lengthLevel === 2
            ? "Would you be open to a brief 15-minute working session this week to test this against your live workflow?"
            : "I've prepared a tailored sandbox environment modeled on your current team size and deal velocity. Let me know if Tuesday at 2:00 PM or Thursday morning works best for a deep-dive review.";

    if (lengthLevel === 1) {
        return `${greeting} ${coreBody.split(". ")[0]}. ${closing}`;
    }
    if (lengthLevel === 3) {
        const extraDetail = temperature > 0.6
            ? "\n\nBonus idea: we can even A/B test two distinct AI outreach personas across your top 50 target accounts to see which tone books meetings faster."
            : "\n\nKey Operational Metrics Included:\n• Automated ICP scoring & contact promotion\n• Built-in TCPA / 10DLC & DMARC compliance checks\n• Instant Close-Won to Project board handoff";
        return `${greeting}\n\n${coreBody}${extraDetail}\n\n${closing}`;
    }
    return `${greeting}\n\n${coreBody}\n\n${closing}`;
}

export default function AIPromptLab() {
    const [copied, setCopied] = useState<string | null>(null);
    const [activePersona, setActivePersona] = useState<string>(PERSONAS[0].name);
    const [systemPrompt, setSystemPrompt] = useState<string>(PERSONAS[0].samplePrompt);
    const [temperature, setTemperature] = useState<number>(0.4);
    const [outputLength, setOutputLength] = useState<number>(2); // 1 = Short, 2 = Balanced, 3 = Long
    const [scenario, setScenario] = useState<string>(SCENARIOS[0].id);
    const [previewOutput, setPreviewOutput] = useState<string>(() =>
        generateSimulatedOutput(PERSONAS[0].samplePrompt, SCENARIOS[0].id, 0.4, 2)
    );
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    useEffect(() => {
        let mounted = true;
        fetch("/api/profile/outreach-prompt")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (mounted && data?.prompt && typeof data.prompt === "string" && data.prompt.trim().length > 0) {
                    setSystemPrompt(data.prompt);
                    setActivePersona("Custom Profile Prompt");
                    setPreviewOutput(generateSimulatedOutput(data.prompt, SCENARIOS[0].id, 0.5, 2));
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(null), 2000);
    };

    const handleSelectPersona = (persona: typeof PERSONAS[0]) => {
        setActivePersona(persona.name);
        setSystemPrompt(persona.samplePrompt);
        setTemperature(persona.defaultTemp);
        setOutputLength(persona.defaultLength);
        const generated = generateSimulatedOutput(
            persona.samplePrompt,
            scenario,
            persona.defaultTemp,
            persona.defaultLength
        );
        setPreviewOutput(generated);
        toast.success(`Loaded "${persona.name}" into Playground`);
    };

    const handleTestInstructionSet = async () => {
        if (!systemPrompt.trim()) {
            toast.error("Please enter a system prompt to test.");
            return;
        }
        setIsTesting(true);
        try {
            const generated = generateSimulatedOutput(systemPrompt, scenario, temperature, outputLength);
            setPreviewOutput(generated);
            await logUserMetric("used_prompt_lab");
            toast.success("Instruction set tested & Mastery metric recorded!");
        } catch (err) {
            toast.error("Failed to test instruction set.");
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveToProfile = async () => {
        if (!systemPrompt.trim()) {
            toast.error("System prompt cannot be empty.");
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch("/api/profile/outreach-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptText: systemPrompt }),
            });
            if (!res.ok) throw new Error("Failed to save");
            await logUserMetric("used_prompt_lab");
            toast.success("Saved as your default AI Outreach Prompt!");
        } catch (err) {
            toast.error("Could not save outreach prompt to profile.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-4">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Persona Playbook */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Bot className="w-5 h-5 text-blue-400" />
                            Winning Persona Library
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Click any persona to load
                        </span>
                    </div>
                    <div className="space-y-4">
                        {PERSONAS.map((persona) => {
                            const isSelected = activePersona === persona.name;
                            return (
                                <motion.div
                                    key={persona.name}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => handleSelectPersona(persona)}
                                    className={cn(
                                        "group p-5 rounded-2xl border transition-all cursor-pointer",
                                        isSelected
                                            ? "bg-blue-500/10 border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.1)]"
                                            : "bg-white/5 border-white/10 hover:border-blue-500/30"
                                    )}
                                >
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-lg group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                                        {persona.name}
                                                    </h4>
                                                    {isSelected && (
                                                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] uppercase font-black">
                                                            Loaded
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {persona.tags.map(tag => (
                                                        <Badge key={tag} variant="secondary" className="text-[9px] py-0 h-4">{tag}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                                Load <ArrowUpRight className="w-3 h-3" />
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-400 leading-relaxed italic">
                                            {persona.description}
                                        </p>

                                        <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Base Instruction</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(persona.samplePrompt, persona.name);
                                                    }}
                                                    className="text-muted-foreground hover:text-white transition-colors"
                                                >
                                                    {copied === persona.name ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                                {persona.samplePrompt}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Interactive Instruction Playground */}
                <div className="space-y-6 h-fit">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        Instruction Playground
                    </h3>

                    <Card className="bg-black/40 border-white/10 flex flex-col overflow-hidden">
                        <CardHeader className="bg-white/5 border-b border-white/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                        <Settings2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed">
                                            Sandbox Mode
                                        </CardTitle>
                                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                                            Active Persona: {activePersona}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest">Interactive</span>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 p-6 space-y-6">
                            {/* Scenario Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Target Outreach Scenario
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SCENARIOS.map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setScenario(s.id)}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-left transition-all",
                                                scenario === s.id
                                                    ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            <div className="text-xs font-bold truncate">{s.label}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{s.context}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Editable System Prompt */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-muted-foreground uppercase">
                                        System Prompt (Instructions)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectPersona(PERSONAS[0])}
                                        className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Reset
                                    </button>
                                </div>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => {
                                        setSystemPrompt(e.target.value);
                                        setActivePersona("Custom Instruction Set");
                                    }}
                                    rows={5}
                                    placeholder="You are an AI sales expert specialized in SaaS. Lead with curiosity..."
                                    className="w-full min-h-[130px] p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 font-mono leading-relaxed outline-none focus:border-emerald-500/50 transition-colors resize-y"
                                />
                            </div>

                            {/* Sliders */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Temperature</label>
                                        <span className="text-xs font-mono font-bold text-emerald-400">{temperature.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                        <span>Concise (0.0)</span>
                                        <span>Creative (1.0)</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Output Length</label>
                                        <span className="text-xs font-mono font-bold text-blue-400">
                                            {outputLength === 1 ? "Short" : outputLength === 2 ? "Balanced" : "Detailed"}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={1}
                                        value={outputLength}
                                        onChange={(e) => setOutputLength(parseInt(e.target.value, 10))}
                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                        <span>Short</span>
                                        <span>Balanced</span>
                                        <span>Detailed</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={handleTestInstructionSet}
                                    disabled={isTesting}
                                    className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/10 transition-transform flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                >
                                    <Play className="w-4 h-4 fill-white" />
                                    {isTesting ? "Generating..." : "Test Instruction Set"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveToProfile}
                                    disabled={isSaving}
                                    className="py-3.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4 text-emerald-400" />
                                    {isSaving ? "Saving..." : "Save to Profile"}
                                </button>
                            </div>
                        </CardContent>

                        <div className="bg-white/5 border-t border-white/10 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                        Preview Output ({SCENARIOS.find(s => s.id === scenario)?.label})
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(previewOutput, "preview")}
                                    className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    {copied === "preview" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied === "preview" ? "Copied" : "Copy Output"}
                                </button>
                            </div>
                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 whitespace-pre-line leading-relaxed font-medium">
                                {previewOutput}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* AI Capability Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                {[
                    { label: "Voice Optimized", icon: Mic2, colorClass: "text-blue-400" },
                    { label: "High Token Limit", icon: Zap, colorClass: "text-amber-400" },
                    { label: "JSON Structure", icon: Cpu, colorClass: "text-emerald-400" },
                    { label: "Multi-modal Ready", icon: Bot, colorClass: "text-violet-400" },
                ].map((cap, i) => (
                    <Card key={i} className="bg-white/5 border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-white/5", cap.colorClass)}>
                                <cap.icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">{cap.label}</span>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
