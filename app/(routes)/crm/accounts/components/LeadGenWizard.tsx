"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, FileText, Settings, Sparkles, Wand2, Zap, Globe, Code, Loader2, Sliders, FolderKanban, Target } from "lucide-react";
import { toast } from "react-hot-toast";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import AIWriterModal from "../../leads/components/modals/AIWriterModal";
import DashboardCard from "../../dashboard/_components/DashboardCard";
import { Combobox } from "@/components/ui/combobox";
import { getTeamCreditsInfo } from "@/actions/crm/credits/index";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type WizardMode = "ai-only" | "step-by-step" | "advanced";

type WizardState = {
  name: string;
  description?: string;
  industries: string;
  companySizes: string;
  geos: string;
  techStack: string;
  titles: string;
  excludeDomains: string;
  notes?: string;
  maxCompanies: number;
  maxContactsPerCompany: number;
  serpFallback?: boolean; // Allow SERP to run only if AI finds 0 companies
  aiPrompt?: string; // For AI-only mode
  campaignId?: string; // Link to a campaign (project) - Deprecated in UI, now mapping to existing pool if needed? 
  // User wants "Lists" dropdown. If selecting a list, do we append? Or just link?
  // User said: "dropdown for projects this should be changed to lists"
  existingListId?: string;
  searchProvider: "ddg" | "google-stealth" | "scraper-api";
};

export default function LeadGenWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<WizardMode>("ai-only");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [aiWriterOpen, setAiWriterOpen] = useState(false);
  const [currentAiField, setCurrentAiField] = useState<keyof WizardState | null>(null);
  const [limitsInfo, setLimitsInfo] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; } | null>(null);

  useEffect(() => {
    getTeamCreditsInfo().then(setLimitsInfo).catch(console.error);
  }, []);

  // Fetch existing lists (pools) for selector
  const { data: poolsData } = useSWR<{ pools: { id: string; name: string; candidatesCount: number }[] }>("/api/crm/leads/pools", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
  const availablePools = useMemo(() => poolsData?.pools || [], [poolsData?.pools]);

  // Fetch brand identity for ICP pre-fill
  const { data: brandData } = useSWR("/api/admin/brand", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  // Common State (Top Level)
  const [state, setState] = useState<WizardState>({
    name: "",
    description: "",
    industries: "",
    companySizes: "",
    geos: "",
    techStack: "",
    titles: "",
    excludeDomains: "",
    notes: "",
    maxCompanies: 100,
    maxContactsPerCompany: 3,
    serpFallback: false, // SERP disabled — purely agentic process
    aiPrompt: "",
    campaignId: "",
    existingListId: searchParams?.get("poolId") || "",
    searchProvider: "ddg",
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "number" || name === "maxCompanies" || name === "maxContactsPerCompany") {
      if (value === "" || value === "-") {
         setState((prev) => ({ ...prev, [name]: value as any }));
         return;
      }
      // Strip leading zeros and clamp to valid range
      const stripped = value.replace(/^-?0+(?=\d)/, (m) => m.startsWith('-') ? '-' : '');
      const num = Number(stripped);
      setState((prev) => ({ ...prev, [name]: isNaN(num) ? 0 : num }));
    } else {
      setState((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Pre-fill list name when poolId is provided via URL and pools data loads
  useEffect(() => {
    const urlPoolId = searchParams?.get("poolId");
    if (urlPoolId && availablePools.length > 0) {
      const matchedPool = availablePools.find(p => p.id === urlPoolId);
      if (matchedPool) {
        setState(prev => ({
          ...prev,
          existingListId: urlPoolId,
          name: prev.name || matchedPool.name,
        }));
      }
    }
  }, [searchParams, availablePools]);

  useEffect(() => {
    if (!brandData) return;
    
    // Handle multi-brand vs single-brand shapes
    const brand = brandData.multiBrand && Array.isArray(brandData.brands)
      ? (brandData.brands.find((b: any) => b.is_default) || brandData.brands[0])
      : brandData;

    if (!brand) return;

    setState((prev) => {
      const updates: Partial<WizardState> = {};
      // Pre-fill industries from brand's industry or ICP
      if (!prev.industries && brand.industry) {
        updates.industries = brand.industry;
      }
      // Pre-fill geos from brand's location
      if (!prev.geos && brand.location) {
        updates.geos = brand.location;
      }
      // Pre-fill AI prompt with brand context for AI-only mode
      if (!prev.aiPrompt && brand.ideal_customer_profile) {
        updates.aiPrompt = brand.ideal_customer_profile;
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [brandData]);

  const handleWriteAi = (field: keyof WizardState) => {
    setCurrentAiField(field);
    setAiWriterOpen(true);
  };

  const handleAiInsert = (text: string) => {
    if (currentAiField) {
      if (currentAiField === 'maxCompanies' || currentAiField === 'maxContactsPerCompany') {
        // ignore number fields
      } else {
        setState(prev => ({ ...prev, [currentAiField!]: text }));
      }
    } else {
      setState(prev => ({ ...prev, aiPrompt: text }));
    }
  };

  const handleEnhance = async (field: keyof WizardState | 'aiPrompt') => {
    const currentValue = field === 'aiPrompt' ? state.aiPrompt : state[field];
    if (typeof currentValue !== 'string' || !currentValue || currentValue.trim().length < 3) {
      toast.error("Please enter some text to enhance first");
      return;
    }

    const toastId = toast.loading(`AI is enhancing ${field === 'aiPrompt' ? 'your prompt' : field}...`);
    try {
      const res = await fetch("/api/ai/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentValue,
          context: `You are an expert at Ideal Customer Profiles (ICP). Rewrite and enhance the following targeting criteria for better search results. Maintain the original intent but make it more professional and precise: "${currentValue}"`
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (field === 'aiPrompt') {
        setState(prev => ({ ...prev, aiPrompt: data.text }));
      } else {
        setState(prev => ({ ...prev, [field]: data.text }));
      }
      toast.success("Enhanced successfully!", { id: toastId });
    } catch (error: any) {
      console.error("[ENHANCE_ERROR]", error);
      toast.error("Failed to enhance text", { id: toastId });
    }
  };

  // --- Render Helpers (plain functions, NOT components) ---
  // Defined as functions returning JSX to avoid React remounting on every state change.
  // If these were capitalized components defined inside the parent, React would treat
  // them as new component types on each render, killing input focus after each keystroke.

  const renderAIInputLabel = (label: string, field: keyof WizardState, className?: string) => (
    <div className={`flex items-center justify-between mb-2 ${className || ""}`}>
      <label className="text-sm font-medium text-foreground/90">{label}</label>
      <div className="flex gap-2 scale-90 origin-right">
        <button
          type="button"
          tabIndex={-1}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          onClick={() => handleEnhance(field)}
        >
          <Zap className="w-3 h-3" /> Enhance AI
        </button>
      </div>
    </div>
  );

  const renderInputWithAI = (label: string, name: keyof WizardState, placeholder?: string) => (
    <div key={name}>
      {renderAIInputLabel(label, name)}
      <input
        name={name}
        value={state[name] as string}
        onChange={onChange}
        className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors"
        placeholder={placeholder}
      />
    </div>
  );

  const renderTextAreaWithAI = (label: string, name: keyof WizardState, placeholder?: string, rows: number = 3) => (
    <div key={name}>
      {renderAIInputLabel(label, name)}
      <textarea
        name={name}
        value={state[name] as string}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors resize-none"
        placeholder={placeholder}
      />
    </div>
  );

  const tags = (csv: string) =>
    csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleWizardSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!state.name && !state.existingListId) {
      toast.error("Please enter a pool name");
      return;
    }

    if (limitsInfo && !limitsInfo.isUnlimited) {
      if (limitsInfo.remaining !== -1 && limitsInfo.remaining <= 0) {
        toast.error("You have exhausted your LeadGen Target for this month.");
        return;
      }
      if (limitsInfo.aiTokensLimit !== -1 && limitsInfo.aiTokensBalance <= 0) {
        toast.error("You do not have enough AI Tokens to run Lead Generation.");
        return;
      }
      
      // Warnings if close to limits
      if (limitsInfo.remaining > 0 && limitsInfo.remaining < state.maxCompanies) {
         setConfirmModal({
             isOpen: true,
             title: "LeadGen Credits Warning",
             description: `You only have ${limitsInfo.remaining} LeadGen credits remaining, but you are attempting to consume up to ${state.maxCompanies}. The pipeline will stop dynamically once your wallet is empty. Do you want to continue?`,
             onConfirm: executeSubmission
         });
         return;
      } else if (limitsInfo.aiTokensBalance > 0 && limitsInfo.aiTokensBalance < 100000) {
         setConfirmModal({
             isOpen: true,
             title: "AI Tokens Warning",
             description: `You only have ${limitsInfo.aiTokensBalance.toLocaleString()} AI Tokens remaining. Agentic AI is heavily intensive and your pipeline may halt early automatically. Do you want to continue?`,
             onConfirm: executeSubmission
         });
         return;
      }
    }

    await executeSubmission();
  };

  const executeSubmission = async () => {
    setSubmitting(true);
    setConfirmModal(null);

    try {
      // If in AI-only mode with a prompt, parse it first to populate fields
      if (mode === "ai-only" && state.aiPrompt && state.aiPrompt.trim().length > 0) {
        console.log("[AUTOGEN] AI-only mode detected, parsing prompt...");
        try {
          const parseRes = await fetch("/api/crm/leads/parse-icp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: state.aiPrompt }),
          });

          if (parseRes.ok) {
            const parsed = await parseRes.json();
            
            // Populate the state with the AI's generated parameters
            setState(prev => ({
              ...prev,
              industries: parsed.industries?.length ? parsed.industries.join(", ") : prev.industries,
              companySizes: parsed.companySizes?.length ? parsed.companySizes.join(", ") : prev.companySizes,
              geos: parsed.geos?.length ? parsed.geos.join(", ") : prev.geos,
              techStack: parsed.techStack?.length ? parsed.techStack.join(", ") : prev.techStack,
              titles: parsed.titles?.length ? parsed.titles.join(", ") : prev.titles,
              notes: parsed.notes || prev.aiPrompt,
            }));

            // Force user to review by dropping them into the Advanced Mode tab
            setMode("advanced");
            setSubmitting(false);
            toast.success("ICP Strategy parsed! Please review and confirm the logic below before launching.");
            return;
          }
        } catch (parseErr: any) {
          console.error("[AUTOGEN] AI parsing/submission error:", parseErr);
          toast.error(parseErr.message || "Failed to start AI Agent. Please check limits.");
          throw parseErr; // Escalate to the outer catch
        }
      }

      // Regular submission
      const payload = {
        name: state.name || "AI Generated Pool",
        description: state.description,
        icp: {
          industries: tags(state.industries),
          companySizes: tags(state.companySizes),
          geos: tags(state.geos),
          techStack: tags(state.techStack),
          titles: tags(state.titles),
          excludeDomains: tags(state.excludeDomains),
          notes: mode === "ai-only" ? state.aiPrompt : state.notes,
        },
        providers: {
          agenticAI: true,
          serp: false,
          serpFallback: false,
          searchProvider: state.searchProvider,
        },
        limits: {
          maxCompanies: state.maxCompanies,
          maxContactsPerCompany: state.maxContactsPerCompany,
        },

        campaignId: state.campaignId || undefined,
        existingPoolId: state.existingListId || undefined,
      };

      const res = await fetch("/api/crm/leads/autogen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      try {
        await fetch(`/api/crm/leads/autogen/run/${data.jobId}`, { method: "POST" });
      } catch (err) { console.error(err); }

      toast.success("Lead generation started successfully!");
      router.push(`/lists/jobs/${data.jobId}`);

    } catch (err: any) {
      toast.error(err.message || "Failed to start job");
    } finally {
      setSubmitting(false);
    }
  };

  const navCards = [
    {
      id: "ai-only" as WizardMode,
      title: "Full Auto AI",
      description: "Let AI do the rest",
      icon: Bot,
      variant: "violet" as const,
    },
    {
      id: "step-by-step" as WizardMode,
      title: "Guided Wizard",
      description: "Step-by-step targeting",
      icon: Wand2,
      variant: "info" as const,
    },
    {
      id: "advanced" as WizardMode,
      title: "Advanced Mode",
      description: "Full control over settings",
      icon: Sliders,
      variant: "warning" as const,
    },
  ];

  const renderTopConfiguration = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="relative group overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4 backdrop-blur-md shadow-sm transition-colors hover:border-indigo-500/40">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-indigo-400 mb-1.5 block flex items-center gap-1.5">
          <FolderKanban className="w-3 h-3" /> Append to List
        </label>
        <Combobox
          options={availablePools.map(p => ({ label: `${p.name} (${p.candidatesCount})`, value: p.id }))}
          value={state.existingListId}
          onChange={(value) => {
            const selectedPool = availablePools.find(p => p.id === value);
            setState(prev => ({
              ...prev,
              existingListId: value,
              name: selectedPool ? selectedPool.name : prev.name,
            }));
          }}
          placeholder="Search lists..."
          emptyMessage="No lists found."
          variant="ghost"
          className="w-full justify-start bg-transparent border-none text-sm font-medium focus:ring-0 px-0 hover:bg-white/5 transition-colors text-white h-auto py-1.5"
        />
        <div className="text-[10px] text-muted-foreground mt-1">{state.existingListId ? "New leads will be added to this list" : "Or leave empty to create a new list"}</div>
      </div>

      {/* Campaign Name */}
      <div className="md:col-span-2 relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-sm transition-colors hover:bg-white/10">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 block">
          Pool Name
        </label>
        <input
          name="name"
          value={state.name}
          onChange={onChange}
          className="w-full bg-transparent border-none text-lg font-medium placeholder:text-muted-foreground/50 focus:ring-0 px-0"
          placeholder="e.g. Q1 SaaS Outreach..."
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent to-background/10" />
      </div>

      {/* Leads Limit */}
      <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-sm transition-colors hover:bg-white/10">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 block">
          {limitsInfo?.isUnlimited ? "Credits Target (Infinite limit)" : `Credits Target (Max ${limitsInfo?.monthlyLimit || 100})`}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="maxCompanies"
            value={String(state.maxCompanies)}
            onChange={onChange}
            onFocus={(e) => e.target.select()}
            className="w-full bg-transparent border-none text-lg font-medium focus:ring-0 px-0"
            min={-1}
            max={limitsInfo?.isUnlimited ? 100000 : (limitsInfo?.monthlyLimit || 100)}
          />
          <div className="text-xs text-muted-foreground whitespace-nowrap">credits</div>
        </div>
      </div>
    </div>
  );

  const renderModeSelector = () => (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {navCards.map((card) => (
        <DashboardCard
          key={card.id}
          icon={card.icon}
          label={card.title}
          description={card.description}
          variant={card.variant}
          hideIcon={true}
          onClick={() => { setMode(card.id); if (card.id === 'step-by-step') setStep(1); }}
          className={mode === card.id ? "ring-2 ring-primary border-primary/50 bg-accent/10" : ""}
          labelClassName="text-sm md:text-base"
          descriptionClassName="text-[10px] md:text-xs"
        />
      ))}
    </div>
  );

  const submitButtonClass = "px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all hover:opacity-90 disabled:opacity-50 disabled:hover:shadow-none";
  const backButtonClass = "px-6 py-2.5 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-medium";

  const renderAIOnlyMode = () => (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-card/10 p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 pb-2 border-b border-white/5 mb-6">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><Sparkles className="w-5 h-5" /></div>
          <h3 className="text-lg font-semibold">AI Agent Instructions</h3>
          <div className="ml-auto">
            <button
              type="button"
              className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
              onClick={() => handleEnhance('aiPrompt')}
            >
              <Zap className="w-3 h-3" /> Enhance AI
            </button>
          </div>
        </div>

        <textarea
          name="aiPrompt"
          value={state.aiPrompt}
          onChange={onChange}
          className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors resize-none min-h-[120px]"
          placeholder="Describe your ideal customer profile in detail. For example: 'I'm looking for B2B SaaS companies in the US with 50-200 employees that use HubSpot and Stripe. They should be in the Fintech or Healthcare sectors...'"
        />

        <div className="pt-4 border-t border-white/5 mt-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Search Infrastructure
              {limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/5">EXEMPT PLAN ONLY</span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">Select the backend search engine routing your AI agent will use to discover companies.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <label className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${state.searchProvider === 'ddg' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider_ai" value="ddg" className="sr-only" checked={state.searchProvider === 'ddg'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">DuckDuckGo</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Default headless web search. Reliable and stable.</span>
                </div>
              </label>

              <label className={`relative flex rounded-lg border p-4 shadow-sm focus:outline-none ${limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${state.searchProvider === 'google-stealth' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider_ai" value="google-stealth" className="sr-only" disabled={limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT'} checked={state.searchProvider === 'google-stealth'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">Google (Stealth)</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Aggressive evasion mode targeting Google SERP.</span>
                </div>
              </label>

              <label className={`relative flex rounded-lg border p-4 shadow-sm focus:outline-none ${limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${state.searchProvider === 'scraper-api' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider_ai" value="scraper-api" className="sr-only" disabled={limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT'} checked={state.searchProvider === 'scraper-api'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">ScraperAPI</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Enterprise scraping via structural proxy endpoints.</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !limitsInfo || (!state.name && !state.existingListId) || (mode === 'ai-only' && !state.aiPrompt)}
          className={submitButtonClass}
        >
          <span className="flex items-center justify-center gap-2">
            {(submitting || !limitsInfo) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {submitting ? "Deploying Agent..." : !limitsInfo ? "Checking Allocations..." : "Launch AI Agent"}
          </span>
        </button>
      </div>
    </div>
  );

  const renderStepByStep = () => {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-card/10 p-6 backdrop-blur-xl shadow-2xl">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><FileText className="w-5 h-5" /></div>
                <h3 className="text-lg font-semibold">Pool Details</h3>
              </div>

              {renderTextAreaWithAI("Description", "description", "e.g. We are targeting B2B SaaS companies...", 4)}

              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setStep(2)} className={submitButtonClass}>Next Step</button>
              </div>
            </div>
          )}
          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                <div className="p-2 rounded-lg bg-pink-500/20 text-pink-400"><Globe className="w-5 h-5" /></div>
                <h3 className="text-lg font-semibold">Targeting</h3>
              </div>

              <div className="grid gap-6">
                {renderInputWithAI("Industries", "industries", "e.g. SaaS, Fintech, Healthcare")}
                {renderInputWithAI("Locations", "geos", "e.g. United States, Canada, UK")}
              </div>

              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(1)} className={backButtonClass}>Back</button>
                <button type="button" onClick={() => setStep(3)} className={submitButtonClass}>Next Step</button>
              </div>
            </div>
          )}
          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400"><Code className="w-5 h-5" /></div>
                <h3 className="text-lg font-semibold">Roles & Tech</h3>
              </div>

              <div className="grid gap-6">
                {renderInputWithAI("Job Titles", "titles", "e.g. CEO, CTO, VP Sales")}
                {renderInputWithAI("Tech Stack", "techStack", "e.g. HubSpot, Salesforce, AWS")}
              </div>

              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(2)} className={backButtonClass}>Back</button>
                <button type="submit" disabled={submitting || !limitsInfo} className={submitButtonClass}>
                  {submitting ? "Launching..." : !limitsInfo ? "Checking Allocations..." : "Launch Lead Gen"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdvancedMode = () => (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-card/10 p-6 backdrop-blur-xl shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Settings className="w-5 h-5" /></div>
          <h3 className="text-lg font-semibold">Full Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderInputWithAI("Industries", "industries", "e.g. SaaS, Fintech, Healthcare, E-commerce")}
          {renderInputWithAI("Locations", "geos", "e.g. United States, Canada, United Kingdom")}
          {renderInputWithAI("Job Titles", "titles", "e.g. CEO, CTO, VP Sales, Head of Marketing")}
          {renderInputWithAI("Tech Stack", "techStack", "e.g. HubSpot, Salesforce, AWS, Stripe")}
          {renderInputWithAI("Company Sizes", "companySizes", "e.g. 10-50, 50-200, 200-1000")}
          {renderInputWithAI("Exclude Domains", "excludeDomains", "e.g. google.com, amazon.com")}
        </div>

        <div className="pt-2">
          {renderTextAreaWithAI("Additional Notes", "notes", "Any specific requirements...")}
        </div>

        <div className="pt-4 border-t border-white/5 mt-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> Search Infrastructure
              {limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/5">EXEMPT PLAN ONLY</span>
              )}
            </h4>
            <p className="text-xs text-muted-foreground">Select the backend search engine routing your AI agent will use to discover companies.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <label className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${state.searchProvider === 'ddg' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider" value="ddg" className="sr-only" checked={state.searchProvider === 'ddg'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">DuckDuckGo</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Default headless web search. Reliable and stable.</span>
                </div>
              </label>

              <label className={`relative flex rounded-lg border p-4 shadow-sm focus:outline-none ${limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${state.searchProvider === 'google-stealth' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider" value="google-stealth" className="sr-only" disabled={limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT'} checked={state.searchProvider === 'google-stealth'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">Google (Stealth)</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Aggressive evasion mode targeting Google SERP.</span>
                </div>
              </label>

              <label className={`relative flex rounded-lg border p-4 shadow-sm focus:outline-none ${limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${state.searchProvider === 'scraper-api' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <input type="radio" name="searchProvider" value="scraper-api" className="sr-only" disabled={limitsInfo?.planSlug?.toUpperCase() !== 'EXEMPT'} checked={state.searchProvider === 'scraper-api'} onChange={(e) => setState(prev => ({...prev, searchProvider: e.target.value as any}))} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold mb-1">ScraperAPI</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">Enterprise scraping via structural proxy endpoints.</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || !limitsInfo}
          className={submitButtonClass}
        >
          <span className="flex items-center justify-center gap-2">
            {(submitting || !limitsInfo) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            {submitting ? "Starting..." : !limitsInfo ? "Checking Allocations..." : "Start Lead Gen"}
          </span>
        </button>
      </div>
    </div>
  );

  // Icon for fallback
  const Play = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
            AI Lead Generation
          </h1>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-lg">
              Deploy autonomous agents to find, qualify, and engage your ideal customers.
            </p>
            {limitsInfo && !limitsInfo.isUnlimited && (
              <div className="flex gap-4 text-xs font-semibold bg-white/5 border border-white/10 rounded-lg py-2 px-3 w-max">
                 <div className="flex items-center gap-1.5 font-mono text-cyan-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>AI Tokens Available: {limitsInfo.aiTokensBalance.toLocaleString()}</span>
                 </div>
                 <div className="w-px bg-white/10" />
                 <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                    <Target className="w-3.5 h-3.5" />
                    <span>Credits Remaining: {limitsInfo.remaining}</span>
                 </div>
              </div>
            )}
            {limitsInfo && limitsInfo.isUnlimited && (
              <div className="flex gap-4 text-xs font-semibold bg-white/5 border border-white/10 rounded-lg py-2 px-3 w-max">
                 <div className="flex items-center gap-1.5 font-mono text-indigo-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>AI Features: Unlimited</span>
                 </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleWizardSubmit}>
          {renderTopConfiguration()}

          {renderModeSelector()}

          <div className="relative">
            {mode === "ai-only" && renderAIOnlyMode()}
            {mode === "step-by-step" && renderStepByStep()}
            {mode === "advanced" && renderAdvancedMode()}
          </div>
        </form>
      </div>

      <AIWriterModal
        isOpen={aiWriterOpen}
        onClose={() => { setAiWriterOpen(false); setCurrentAiField(null); }}
        onInsert={handleAiInsert}
      />

      {confirmModal && (
        <AlertDialog open={confirmModal.isOpen} onOpenChange={(open) => !open && setConfirmModal(null)}>
          <AlertDialogContent className="bg-black/95 border border-white/10 text-white shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl flex items-center gap-2 text-pink-400">
                <Target className="w-5 h-5 flex-shrink-0" />
                {confirmModal.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400 text-sm mt-3 leading-relaxed">
                {confirmModal.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 pt-4 border-t border-white/5">
              <AlertDialogCancel 
                onClick={() => setConfirmModal(null)}
                className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white transition-colors"
               >
                 Cancel
               </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => confirmModal.onConfirm()} 
                className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white hover:from-pink-500 hover:to-indigo-500 shadow-md hover:shadow-pink-500/25 transition-all outline-none border-none"
               >
                Start Job Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
