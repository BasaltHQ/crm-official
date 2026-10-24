"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    GraduationCap,
    PlayCircle,
    PauseCircle,
    StopCircle,
    FileText,
    GitBranch,
    Layers,
    FolderKanban,
    BarChart3,
    ShieldCheck,
    Bot,
    Rocket,
    Search,
    Volume2,
    CheckCircle2,
    Sparkles,
} from "lucide-react";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { LearnLink } from "@/components/ui/LearnLink";
import { toast } from "react-hot-toast";
import { logUserMetric } from "@/actions/university/log-user-metric";

// Phase 1 components
import ComplianceAcademy from "./ComplianceAcademy";

// Phase 2 components
import RevOpsSimulator from "./RevOpsSimulator";
import IntegrationBlueprints from "./IntegrationBlueprints";

// Phase 3 components
import CertificationPaths from "./CertificationPaths";
import AIPromptLab from "./AIPromptLab";

// Flow components
import FlowDiagramCard, { PIPELINE_LEGEND, CONVERSION_LEGEND } from "./FlowDiagramCard";
import PipelineFlow, { PIPELINE_STAGES } from "./PipelineStageCard";
import EntityRelationshipView from "./EntityRelationshipView";
import OutreachFlowView from "./OutreachFlowView";
import { MermaidDiagram, CRM_FLOW_DIAGRAM, CONVERSION_FLOW_DIAGRAM, CRM_FLOW_DIAGRAM_MOBILE, CONVERSION_FLOW_DIAGRAM_MOBILE } from "./MermaidDiagram";
import AutoConversionFlow from "./AutoConversionFlow";
import FlowStatsCharts from "./FlowStatsCharts";
import ProjectWorkflowGuide from "./ProjectWorkflowGuide";
import { PROJECT_WORKFLOW_DESKTOP, PROJECT_WORKFLOW_MOBILE, PROJECT_WORKFLOW_LEGEND, CAMPAIGN_PIPELINE_DESKTOP, CAMPAIGN_PIPELINE_MOBILE, CAMPAIGN_PIPELINE_LEGEND } from "./ProjectWorkflowDiagrams";
import TabNavigationCard from "./TabNavigationCard";
import GettingStarted from "./GettingStarted";

type TabId = "getting-started" | "flow" | "reference" | "project-workflow" | "compliance" | "performance" | "certification" | "prompt-lab";

const TAB_ALIASES: Record<string, TabId> = {
    "getting-started": "getting-started",
    "project-workflow": "project-workflow",
    "flow": "flow",
    "compliance": "compliance",
    "certification": "certification",
    "mastery": "certification",
    "prompt-lab": "prompt-lab",
    "prompts": "prompt-lab",
    "performance": "performance",
    "roi-modeler": "performance",
    "reference": "reference",
};

const GLOSSARY_TERMS = [
    {
        term: "Account (Foundation)",
        category: "Data Model",
        definition: "The top-level company or organization record populated via AI LeadGen or manual entry. Anchors all associated Contacts, Leads, and Opportunities.",
    },
    {
        term: "Contact vs. Lead",
        category: "Pipeline",
        definition: "A Contact is an individual discovered at an Account. Once engagement or buying intent is verified, they are promoted to a Lead to enter active sales qualification.",
    },
    {
        term: "Close Won → Project Handoff",
        category: "Automation",
        definition: "Marking an Opportunity as Close Won automatically provisions a delivery Project board, tasks, and team handoff without manual data re-entry.",
    },
    {
        term: "10DLC (10-Digit Long Code)",
        category: "Compliance",
        definition: "Carrier-verified SMS registration linking your legal EIN (Brand) and message templates (Campaign) to unlock high-throughput, low-filtering SMS delivery.",
    },
    {
        term: "SPF / DKIM / DMARC",
        category: "Compliance",
        definition: "Cryptographic DNS authentication records that prove domain ownership, sign outbound headers, and protect your domain from spoofing or spam folder placement.",
    },
    {
        term: "FlowState Workflows",
        category: "Automation",
        definition: "Event-driven visual automation rules that trigger multi-channel actions, enrichments, and stage updates whenever CRM records change.",
    },
    {
        term: "Lead Pool & ICP Filter",
        category: "Sourcing",
        definition: "Segmented batches of AI-discovered companies and decision-makers filtered by Ideal Customer Profile criteria (industry, tech stack, headcount, geography).",
    },
    {
        term: "Global Search (Cmd/Ctrl + K)",
        category: "Shortcut",
        definition: "Instant command palette to jump to any Account, Contact, Lead, Opportunity, or University module from anywhere in the workspace.",
    },
    {
        term: "Varuni AI Assistant",
        category: "AI Engine",
        definition: "Your embedded RevOps copilot accessible from the bottom Utility Bar for drafting contextual replies, summarizing threads, and querying pipeline health.",
    },
];

const AUDIO_BRIEFINGS = [
    {
        id: "arch",
        title: "1. BasaltCRM Architecture Deep Dive",
        duration: "SOP Briefing • Part 1",
        summary: "How Brand Identity, AI LeadGen Pools, Contacts, Leads, Opportunities, and Delivery Projects connect in one continuous loop.",
        transcript:
            "Welcome to the BasaltCRM Architecture Deep Dive. In BasaltCRM, your Brand Identity is configured once and flows automatically across every downstream module. Step one begins in Campaigns and the AI LeadGen Wizard, which discovers target Accounts matching your Ideal Customer Profile. Step two enriches decision-makers as Contacts. When a Contact replies or crosses an engagement threshold, they are promoted to a Lead. Once qualified, the Lead converts into a formal Opportunity on your Kanban pipeline, tracking revenue value, quotes, and contracts. Finally, marking an Opportunity as Close Won automatically provisions a Project board for post-sale execution.",
    },
    {
        id: "compliance",
        title: "2. High-Velocity Outbound & 10DLC Guardrails",
        duration: "SOP Briefing • Part 2",
        summary: "Protecting domain reputation with SPF, DKIM, DMARC, progressive warmup, and carrier-approved 10DLC SMS registration.",
        transcript:
            "Welcome to the Outbound Compliance and Deliverability Briefing. Scaling outreach past one thousand prospects requires strict authentication. For email, ensure your sending domain has a valid SPF record, a 2048-bit DKIM signature, and an active DMARC policy. Always ramp new domains gradually at no more than fifteen percent daily volume growth, and keep hard bounces below two percent. For SMS, complete your 10DLC Brand and Campaign registration, identify your organization in the opening message, and rely on BasaltCRM's automatic STOP and UNSUBSCRIBE circuit breakers.",
    },
    {
        id: "automation",
        title: "3. FlowState Automation & Persona Engineering",
        duration: "SOP Briefing • Part 3",
        summary: "Combining AI Prompt Lab personas with FlowState triggers and Power Dialer queues to maximize Speed-to-Lead.",
        transcript:
            "Welcome to the FlowState Automation and Persona Engineering Briefing. Speed-to-lead is the single highest-leverage multiplier in modern RevOps. Use the Persona Playbook to calibrate your AI agent's temperature and tone—whether Consultative Partner for enterprise deals or Technical Expert for engineering buyers. Pair your saved outreach prompt with FlowState rules to automatically route inbound replies, schedule follow-up tasks, and queue priority calls in the Power Dialer within two minutes of prospect engagement.",
    },
];

// Page transition variants
const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

const UNIVERSITY_TABS = [
    {
        id: "getting-started" as TabId,
        label: "Getting Started",
        title: "CRM University",
        description: "Master the complete lead-to-sale flow, track your performance, and level up your sales game.",
        icon: Rocket,
        color: "text-amber-400 group-hover:text-amber-300",
        gradient: "from-amber-600/30 via-amber-500/10 to-transparent",
        borderColor: "border-amber-500/50 ring-amber-500/20",
        shadowColor: "shadow-amber-500/20"
    },
    {
        id: "project-workflow" as TabId,
        label: "Project Workflow",
        title: "Project Workflow",
        description: "Master the end-to-end process of setting up lead pools, launching campaigns, and managing automated outreach.",
        icon: FolderKanban,
        color: "text-indigo-400 group-hover:text-indigo-300",
        gradient: "from-indigo-600/30 via-indigo-500/10 to-transparent",
        borderColor: "border-indigo-500/50 ring-indigo-500/20",
        shadowColor: "shadow-indigo-500/20"
    },
    {
        id: "flow" as TabId,
        label: "CRM Flow",
        title: "CRM Flow",
        description: "Understand the journey of a lead through your system and how automated triggers turn prospects into customers.",
        icon: GitBranch,
        color: "text-blue-400 group-hover:text-blue-300",
        gradient: "from-blue-600/30 via-blue-500/10 to-transparent",
        borderColor: "border-blue-500/50 ring-blue-500/20",
        shadowColor: "shadow-blue-500/20"
    },
    {
        id: "compliance" as TabId,
        label: "Compliance Academy",
        title: "Compliance Academy",
        description: "Master the regulatory landscape of SMS and Email outreach. Get verified, stay compliant, and ensure deliverability.",
        icon: ShieldCheck,
        color: "text-blue-400 group-hover:text-blue-300",
        gradient: "from-blue-600/30 via-blue-500/10 to-transparent",
        borderColor: "border-blue-500/50 ring-blue-500/20",
        shadowColor: "shadow-blue-500/20"
    },

    {
        id: "certification" as TabId,
        label: "Mastery Paths",
        title: "Mastery Paths",
        description: "Professional certification paths to master every aspect of Basalt CRM and level up your career.",
        icon: GraduationCap,
        color: "text-blue-400 group-hover:text-blue-300",
        gradient: "from-blue-600/30 via-blue-500/10 to-transparent",
        borderColor: "border-blue-500/50 ring-blue-500/20",
        shadowColor: "shadow-blue-500/20"
    },
    {
        id: "prompt-lab" as TabId,
        label: "Persona Playbook",
        title: "Persona Playbook",
        description: "Master the art of AI communication and persona management to personalize your outreach at scale.",
        icon: Bot,
        color: "text-emerald-400 group-hover:text-emerald-300",
        gradient: "from-emerald-600/30 via-emerald-500/10 to-transparent",
        borderColor: "border-emerald-500/50 ring-emerald-500/20",
        shadowColor: "shadow-emerald-500/20"
    },
    {
        id: "performance" as TabId,
        label: "Performance Modeler",
        title: "Performance Modeler",
        description: "Model your sales ROI based on lead quality, data health, and AI efficiency improvements.",
        icon: BarChart3,
        color: "text-emerald-400 group-hover:text-emerald-300",
        gradient: "from-emerald-600/30 via-emerald-500/10 to-transparent",
        borderColor: "border-emerald-500/50 ring-emerald-500/20",
        shadowColor: "shadow-emerald-500/20"
    },
    {
        id: "reference" as TabId,
        label: "Quick Reference",
        title: "Quick Reference",
        description: "Essential information at a glance, including pipeline stages, conversion rules, and technical guides.",
        icon: Layers,
        color: "text-emerald-400 group-hover:text-emerald-300",
        gradient: "from-emerald-600/30 via-emerald-500/10 to-transparent",
        borderColor: "border-emerald-500/50 ring-emerald-500/20",
        shadowColor: "shadow-emerald-500/20"
    },
];

interface UniversityDashboardProps {
    plan?: string;
    userLevel?: number;
    user?: any;
    dynamicFlags?: Record<string, boolean>;
}

export default function UniversityDashboard({ plan, userLevel, user, dynamicFlags }: UniversityDashboardProps) {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabId>("getting-started");
    const [activeStage, setActiveStage] = useState<string | undefined>(undefined);
    const [glossaryQuery, setGlossaryQuery] = useState<string>("");

    // Audio Briefing Player State
    const [selectedBriefingId, setSelectedBriefingId] = useState<string>(AUDIO_BRIEFINGS[0].id);
    const [isPlayingBriefing, setIsPlayingBriefing] = useState<boolean>(false);
    const [showTranscript, setShowTranscript] = useState<boolean>(false);
    const [completedBriefings, setCompletedBriefings] = useState<Record<string, boolean>>({});

    const availableTabs = useMemo(() => {
        if (plan === "FREE") {
            return UNIVERSITY_TABS.filter(t => !["performance", "certification", "prompt-lab"].includes(t.id));
        }
        return UNIVERSITY_TABS;
    }, [plan]);

    useEffect(() => {
        const tabParam = searchParams?.get("tab")?.toLowerCase().trim();
        if (tabParam && TAB_ALIASES[tabParam]) {
            const resolvedTab = TAB_ALIASES[tabParam];
            if (availableTabs.some((t) => t.id === resolvedTab)) {
                setActiveTab(resolvedTab);
            }
        }
    }, [searchParams, availableTabs]);

    useEffect(() => {
        return () => {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const activeBriefing = useMemo(
        () => AUDIO_BRIEFINGS.find((b) => b.id === selectedBriefingId) || AUDIO_BRIEFINGS[0],
        [selectedBriefingId]
    );

    const handleToggleSpeech = async () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            setShowTranscript(true);
            await logUserMetric("completed_training_module");
            setCompletedBriefings((prev) => ({ ...prev, [activeBriefing.id]: true }));
            toast.success("Transcript opened & training module credit recorded!");
            return;
        }

        if (isPlayingBriefing) {
            window.speechSynthesis.cancel();
            setIsPlayingBriefing(false);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(activeBriefing.transcript);
        utterance.rate = 1.02;
        utterance.onend = () => {
            setIsPlayingBriefing(false);
            setCompletedBriefings((prev) => ({ ...prev, [activeBriefing.id]: true }));
        };
        utterance.onerror = () => {
            setIsPlayingBriefing(false);
        };
        setIsPlayingBriefing(true);
        window.speechSynthesis.speak(utterance);

        if (!completedBriefings[activeBriefing.id]) {
            setCompletedBriefings((prev) => ({ ...prev, [activeBriefing.id]: true }));
            try {
                await logUserMetric("completed_training_module");
                toast.success("Audio briefing started — University training credit recorded!");
            } catch {}
        }
    };

    const filteredGlossary = useMemo(() => {
        const q = glossaryQuery.trim().toLowerCase();
        if (!q) return GLOSSARY_TERMS;
        return GLOSSARY_TERMS.filter(
            (item) =>
                item.term.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q) ||
                item.definition.toLowerCase().includes(q)
        );
    }, [glossaryQuery]);

    const currentTab = useMemo(() => availableTabs.find(t => t.id === activeTab) || availableTabs[0], [activeTab, availableTabs]);

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col"
            >
                <Heading
                    title={currentTab?.title || "CRM University"}
                    description={currentTab?.description || "Master the complete lead-to-sale flow, track your performance, and level up your sales game."}
                />
                <Separator className="mt-4" />
            </motion.div>

            {/* Navigation Cards Grid */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className={cn(
                    "grid gap-2 md:gap-3 mb-6 bg-transparent",
                    availableTabs.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-8"
                )}
            >
                {availableTabs.map((tab) => (
                    <TabNavigationCard
                        key={tab.id}
                        id={tab.id}
                        label={tab.label}
                        icon={tab.icon}
                        color={tab.color}
                        gradient={tab.gradient}
                        borderColor={tab.borderColor}
                        shadowColor={tab.shadowColor}
                        isActive={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id as TabId)}
                    />
                ))}
            </motion.div>

            <AnimatePresence mode="wait">

                {/* Getting Started Tab */}
                {activeTab === "getting-started" && (
                    <motion.div
                        key="getting-started"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="getting-started"
                            overviewTitle="Foundations of BASALT"
                            overviewWhat="The entry point for mastering the CRM's core philosophy and layout."
                            overviewWhy="CRM platforms can be overwhelming. Starting here ensures you understand the high-level relationship between accounts, leads, and sales automation before you start clicking."
                            overviewHow="Follow the 'Critical Path' guide below. Complete each milestone to earn your first platform badge and unlock more advanced outreach tools."
                        />
                        <GettingStarted plan={plan} onSelectTab={(tab) => setActiveTab(tab as TabId)} />
                    </motion.div>
                )}

                {/* Flow Architecture Tab */}
                {activeTab === "flow" && (
                    <motion.div
                        key="flow"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                    >
                        <LearnLink
                            tab="flow"
                            overviewTitle="Neural Flow Architecture"
                            overviewWhat="A technical and strategic visualization of how data moves from a raw internet signal to a closed deal."
                            overviewWhy="Understanding the 'Under the Hood' logic prevents confusion when automated events occur (like why a lead moved stages). It empowers you to build better workflows."
                            overviewHow="Review the Mermaid diagrams to see the branching logic. Hover over the stage cards below to see the specific system events that trigger a status change."
                        />

                        {/* Interactive 6-Stage Pipeline Explorer */}
                        <FlowDiagramCard
                            title="Interactive 6-Stage Pipeline Explorer"
                            description="Click any pipeline stage below to inspect its activities and automated conversion triggers"
                            accentColor="blue"
                        >
                            <PipelineFlow activeStage={activeStage} onStageClick={setActiveStage} />
                        </FlowDiagramCard>

                        {/* Main Pipeline Mermaid Diagram */}
                        <FlowDiagramCard
                            title="Complete CRM Pipeline Flow"
                            description="Interactive diagram showing lead acquisition through post-sale"
                            accentColor="blue"
                            legend={PIPELINE_LEGEND}
                        >
                            <MermaidDiagram chart={CRM_FLOW_DIAGRAM} mobileChart={CRM_FLOW_DIAGRAM_MOBILE} />
                        </FlowDiagramCard>

                        {/* Stats Charts */}
                        {plan !== "FREE" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                                    Pipeline Analytics (Sample Data)
                                </h3>
                                <FlowStatsCharts />
                            </motion.div>
                        )}

                        {/* Auto-Conversion Flow */}
                        <FlowDiagramCard
                            title="Auto-Conversion Rules"
                            description="How leads automatically convert to contacts and accounts"
                            accentColor="emerald"
                        >
                            <AutoConversionFlow />
                        </FlowDiagramCard>

                        {/* Conversion Mermaid Diagram */}
                        <FlowDiagramCard
                            title="Conversion Flow Diagram"
                            description="See how leads automatically become contacts and accounts"
                            accentColor="violet"
                            legend={CONVERSION_LEGEND}
                        >
                            <MermaidDiagram chart={CONVERSION_FLOW_DIAGRAM} mobileChart={CONVERSION_FLOW_DIAGRAM_MOBILE} />
                        </FlowDiagramCard>

                        {/* Entity Relationships */}
                        <FlowDiagramCard
                            title="Entity Relationships"
                            description="How CRM entities connect and convert"
                            accentColor="amber"
                        >
                            <EntityRelationshipView />
                        </FlowDiagramCard>

                        {/* Outreach Channels */}
                        <FlowDiagramCard
                            title="Outreach Channels"
                            description="Communication endpoints and their triggers"
                            accentColor="rose"
                        >
                            <OutreachFlowView />
                        </FlowDiagramCard>
                        {/* Architecture Integrations */}
                        <FlowDiagramCard
                            title="System Integrations"
                            description="Technical blueprints for external API services"
                            accentColor="violet"
                        >
                            <IntegrationBlueprints />
                        </FlowDiagramCard>
                    </motion.div>
                )}

                {/* Compliance Academy Tab */}
                {activeTab === "compliance" && (
                    <motion.div
                        key="compliance"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="compliance"
                            overviewTitle="Trust & Deliverability Academy"
                            overviewWhat="The definitive guide to staying legal and professional in the world of high-velocity digital outreach."
                            overviewWhy="One bad campaign can blacklist your entire domain. Mastery of these rules ensures your messages actually reach the inbox and that your brand remains respected."
                            overviewHow="Study the SMS and Email modules. Complete the 'Compliance Checklist' before launching any campaign reaching over 1,000 prospects."
                        />
                        <ComplianceAcademy />
                    </motion.div>
                )}


                {/* Mastery Paths Tab */}
                {activeTab === "certification" && (
                    <motion.div
                        key="certification"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="certification"
                            overviewTitle="Professional Mastery Center"
                            overviewWhat="The career-building hub where you can prove your expertise in CRM operations and Sales AI."
                            overviewWhy="Certifications standardized the team's skillset. Earning these badges demonstrates to leadership that you are capable of managing complex automation and high-value accounts."
                            overviewHow="Enroll in a Mastery Path. Complete the interactive assessments and pass the final simulation to earn your digital certificate and platform profile badge."
                        />
                        <CertificationPaths userLevel={userLevel} user={user} dynamicFlags={dynamicFlags} />
                    </motion.div>
                )}

                {/* Persona Playbook Tab */}
                {activeTab === "prompt-lab" && (
                    <motion.div
                        key="prompt-lab"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="prompt-lab"
                            overviewTitle="AI Persona Engineering"
                            overviewWhat="The collaborative workspace for iterating on the 'brain center' of your AI outreach agents."
                            overviewWhy="Generic AI sounds like a robot. This lab allows you to fine-tune the tone, empathy, and technical depth of your agents to ensure they represent your brand perfectly."
                            overviewHow="Use the playground to test prompt variations. Compare output results against your 'Golden Dataset' and push the winning persona to your live campaigns."
                        />
                        <AIPromptLab />
                    </motion.div>
                )}

                {/* Performance Modeler Tab */}
                {activeTab === "performance" && (
                    <motion.div
                        key="performance"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="roi-modeler"
                            overviewTitle="Strategic Performance Modeler"
                            overviewWhat="A mathematical simulator for projecting revenue outcomes based on your current outreach efficiency."
                            overviewWhy="Sales is a numbers game. This tool allows you to see the exact financial impact of improving your lead quality or AI reply rates by just 1 or 2 percent."
                            overviewHow="Adjust the sliders to match your current metrics. Watch the 'Projected Revenue' chart update in real-time to identify which optimization will have the highest ROI."
                        />
                        <RevOpsSimulator />
                    </motion.div>
                )}


                {/* Quick Reference Tab */}
                {activeTab === "reference" && (
                    <motion.div
                        key="reference"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        <LearnLink
                            tab="reference"
                            overviewTitle="Sales Operations Almanac"
                            overviewWhat="The rapid-access encyclopedia for all technical terms, stage definitions, and system shortcuts."
                            overviewWhy="Speed is leverage. This section provides the precise 'meaning of truth' for every field in the CRM so there is never ambiguity during team handoffs."
                            overviewHow="Scroll through the Stage Overview grid for quick definitions. Use the 'What Happens Automatically' section to troubleshoot system behavior."
                        />

                        {/* Stage Overview Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {PIPELINE_STAGES.map((stg, index) => {
                                const Icon = stg.icon;
                                return (
                                    <motion.div
                                        key={stg.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <Card className={`${stg.bgColor} ${stg.borderColor} border h-full`}>
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`w-5 h-5 ${stg.color}`} />
                                                    <CardTitle className={`text-sm ${stg.color}`}>
                                                        {stg.displayName}
                                                    </CardTitle>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-xs text-muted-foreground mb-3">{stg.description}</p>
                                                <div className="space-y-1">
                                                    {stg.activities.map((act, i) => (
                                                        <div key={i} className="text-xs flex items-center gap-2">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${stg.color.replace("text-", "bg-")}`} />
                                                            {act}
                                                        </div>
                                                    ))}
                                                </div>
                                                {stg.triggerNote && (
                                                    <Badge variant="outline" className="mt-3 text-xs">
                                                        {stg.triggerNote}
                                                    </Badge>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Conversion Rules - Plain English */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">What Happens Automatically</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="p-4 rounded-lg bg-card border border-border"
                                >
                                    <h4 className="font-semibold text-sm text-sky-500 flex items-center gap-2">
                                        Contact → Lead & Opportunity
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        When a person at an Account shows interest, you can promote them from a <strong>Contact</strong> to a <strong>Lead</strong>. This signals qualified intent and allows you to create an <strong>Opportunity</strong>.
                                    </p>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="p-4 rounded-lg bg-card border border-border"
                                >
                                    <h4 className="font-semibold text-sm text-emerald-500 flex items-center gap-2">
                                        Opportunity → Project
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        When you <strong>Close Won</strong> an Opportunity, it automatically creates a <strong>Project</strong> board. This seamlessly triggers the hand-off from sales to delivery.
                                    </p>
                                </motion.div>
                            </CardContent>
                        </Card>

                        {/* Searchable CRM Operations Almanac & Shortcuts */}
                        <Card className="bg-black/40 border-white/10">
                            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-emerald-400" />
                                        Operations Glossary & Shortcuts
                                    </CardTitle>
                                    <CardDescription className="text-xs text-gray-400 mt-1">
                                        Search standard definitions, compliance protocols, and keyboard shortcuts across BasaltCRM.
                                    </CardDescription>
                                </div>
                                <div className="relative w-full md:w-72">
                                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        value={glossaryQuery}
                                        onChange={(e) => setGlossaryQuery(e.target.value)}
                                        placeholder="Filter terms, e.g. 10DLC, Lead..."
                                        className="pl-9 bg-white/5 border-white/10 h-9 text-xs"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredGlossary.map((item) => (
                                        <div
                                            key={item.term}
                                            className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 hover:border-white/20 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-bold text-sm text-white">{item.term}</h4>
                                                <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest border-white/10 text-emerald-400">
                                                    {item.category}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">{item.definition}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Interactive AI Audio Briefings & SOP Walkthroughs */}
                        <div className="pt-4 border-t border-white/5 space-y-6">
                            <div>
                                <h3 className="text-2xl font-black flex items-center gap-3">
                                    <GraduationCap className="w-7 h-7 text-primary" />
                                    Learning Center — AI Audio Briefings
                                </h3>
                                <p className="text-gray-400 text-sm mt-1">
                                    Listen to narrated Standard Operating Procedure (SOP) briefings or inspect the full architecture transcripts to earn University training credit.
                                </p>
                            </div>

                            <Card className="bg-white/5 border-white/10 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-50 pointer-events-none" />
                                <CardContent className="p-8 space-y-6 relative z-10">
                                    {/* Episode Selector */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {AUDIO_BRIEFINGS.map((briefing) => {
                                            const isSelected = briefing.id === selectedBriefingId;
                                            const isDone = !!completedBriefings[briefing.id];
                                            return (
                                                <button
                                                    key={briefing.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isPlayingBriefing && typeof window !== "undefined" && "speechSynthesis" in window) {
                                                            window.speechSynthesis.cancel();
                                                            setIsPlayingBriefing(false);
                                                        }
                                                        setSelectedBriefingId(briefing.id);
                                                    }}
                                                    className={cn(
                                                        "p-4 rounded-2xl border text-left transition-all space-y-2",
                                                        isSelected
                                                            ? "bg-blue-500/15 border-blue-500/40 shadow-lg"
                                                            : "bg-black/40 border-white/10 hover:bg-white/5"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                                            {briefing.duration}
                                                        </span>
                                                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                                    </div>
                                                    <h4 className="font-bold text-sm text-white leading-snug">{briefing.title}</h4>
                                                    <p className="text-xs text-gray-400 line-clamp-2">{briefing.summary}</p>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Active Player Box */}
                                    <div className="bg-black/50 border border-white/10 rounded-2xl p-6 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                                                    <Volume2 className={cn("w-6 h-6 text-blue-400", isPlayingBriefing && "animate-pulse")} />
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-bold text-white">{activeBriefing.title}</h4>
                                                    <p className="text-xs text-gray-400">{activeBriefing.summary}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={handleToggleSpeech}
                                                    className={cn(
                                                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                                                        isPlayingBriefing
                                                            ? "bg-amber-500 text-black hover:bg-amber-400"
                                                            : "bg-blue-500 text-white hover:bg-blue-400"
                                                    )}
                                                >
                                                    {isPlayingBriefing ? (
                                                        <>
                                                            <StopCircle className="w-4 h-4" />
                                                            Stop Narration
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PlayCircle className="w-4 h-4" />
                                                            Listen to Briefing
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const nextState = !showTranscript;
                                                        setShowTranscript(nextState);
                                                        if (nextState && !completedBriefings[activeBriefing.id]) {
                                                            setCompletedBriefings((prev) => ({ ...prev, [activeBriefing.id]: true }));
                                                            try {
                                                                await logUserMetric("completed_training_module");
                                                            } catch {}
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-colors"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    {showTranscript ? "Hide SOP" : "Read SOP"}
                                                </button>
                                            </div>
                                        </div>

                                        {showTranscript && (
                                            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-gray-300 leading-relaxed">
                                                {activeBriefing.transcript}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {/* Project Workflow Tab */}
                {activeTab === "project-workflow" && (
                    <motion.div
                        key="project-workflow"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.3 }}
                    >
                        <LearnLink
                            tab="project-workflow"
                            overviewTitle="Campaign Execution Strategy"
                            overviewWhat="A step-by-step masterclass in launching and scaling a new sales initiative."
                            overviewWhy="Moving from 'one-off sales' to 'scaled operations' requires a predictable sequence. This workflow ensures no step is missed during the transition from list building to outreach."
                            overviewHow="Follow the visual 'Setup to Launch' flow. Reference the 'Pool Management' guide to see how to properly shard your lead lists for maximum agent efficiency."
                        />
                        <ProjectWorkflowGuide />

                        {/* Campaign Pipeline Flow - Brand Identity Data Flow */}
                        <div className="mt-4">
                            <FlowDiagramCard
                                title="Campaign Pipeline — Brand Identity Flow"
                                description="Your Brand Identity is set up once and flows automatically through every stage. Campaigns inherit company context, the LeadGen Wizard pre-fills ICP targeting, and the Outreach Wizard builds AI prompts — all from your brand data. Zero re-typing."
                                accentColor="violet"
                                legend={CAMPAIGN_PIPELINE_LEGEND}
                            >
                                <MermaidDiagram
                                    chart={CAMPAIGN_PIPELINE_DESKTOP}
                                    mobileChart={CAMPAIGN_PIPELINE_MOBILE}
                                />
                            </FlowDiagramCard>
                        </div>

                        <div className="mt-4">
                            <FlowDiagramCard
                                title="Visual Workflow: From Setup to Launch"
                                description="How projects, pools, and outreach allow for scalable outreach."
                                accentColor="blue"
                                legend={PROJECT_WORKFLOW_LEGEND}
                            >
                                <MermaidDiagram
                                    chart={PROJECT_WORKFLOW_DESKTOP}
                                    mobileChart={PROJECT_WORKFLOW_MOBILE}
                                />
                            </FlowDiagramCard>
                        </div>
                    </motion.div>
                )}


            </AnimatePresence>
        </div>
    );
}
