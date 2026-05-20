"use client";
import { useSignedUrl } from "@/hooks/use-signed-url";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "react-hot-toast";
import { Sparkles, Loader2, Plus, Trash2, GripVertical, ExternalLink, Building2, Mail, User, CheckCircle2, LayoutTemplate, Check, FileText as FileTextIcon, Phone, MessageSquare, Upload } from "lucide-react";
import { OUTREACH_TEMPLATES, type OutreachTemplateId } from "@/lib/outreach/outreach-template-meta";
import { ICON_CATEGORIES, ICON_KEYS, resolveIconUrl } from "@/lib/outreach/outreach-icons";

// Filtered icon keys per template style (no longer filtered, return all)
const ALL_ICON_KEYS = ["none", ...ICON_KEYS];

function getIconOptionsForTemplate(templateId: OutreachTemplateId): string[] {
  return ALL_ICON_KEYS;
}

/** Convert camelCase icon key to human-readable label */
function iconKeyToLabel(key: string): string {
  if (key === "none") return "No icon";
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}


// Per-template preview style presets for resource buttons
function getTemplatePreviewStyles(templateId: OutreachTemplateId): {
  primary: React.CSSProperties;
  secondary: React.CSSProperties;
  wrapper: string;
} {
  switch (templateId) {
    case "professional":
      return {
        primary: {
          background: "linear-gradient(135deg, #F54029 0%, #e03520 100%)",
          color: "#fff", borderRadius: 9999, padding: "8px 18px",
          fontSize: 13, fontWeight: 600, fontFamily: "Inter, Arial, sans-serif",
          border: "none", display: "inline-flex", alignItems: "center", gap: 6,
        },
        secondary: {
          background: "transparent", color: "#F54029",
          border: "2px solid #F54029", borderRadius: 9999, padding: "6px 16px",
          fontSize: 13, fontWeight: 600, fontFamily: "Inter, Arial, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        },
        wrapper: "flex flex-wrap gap-3",
      };
    case "bold":
      return {
        primary: {
          background: "linear-gradient(135deg, #F54029 0%, #ff6b4a 100%)",
          color: "#fff", borderRadius: 8, padding: "12px 24px",
          fontSize: 14, fontWeight: 800, fontFamily: "Inter, Arial, sans-serif",
          border: "none", letterSpacing: 0.5, textTransform: "uppercase" as const,
          display: "inline-flex", alignItems: "center", gap: 8,
          boxShadow: "0 4px 14px rgba(245,64,41,0.4)",
        },
        secondary: {
          background: "#1f2937", color: "#f1f5f9",
          border: "1px solid #374151", borderRadius: 8, padding: "12px 24px",
          fontSize: 14, fontWeight: 800, fontFamily: "Inter, Arial, sans-serif",
          letterSpacing: 0.5, textTransform: "uppercase" as const,
          display: "inline-flex", alignItems: "center", gap: 8,
        },
        wrapper: "flex flex-col gap-3",
      };
    case "executive":
      return {
        primary: {
          background: "transparent", color: "#92734a",
          border: "2px solid #92734a", borderRadius: 0, padding: "10px 28px",
          fontSize: 12, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif",
          textTransform: "uppercase" as const, letterSpacing: 2,
          display: "inline-flex", alignItems: "center", gap: 8,
        },
        secondary: {
          background: "transparent", color: "#6b7280",
          border: "1px solid #d1d5db", borderRadius: 0, padding: "8px 20px",
          fontSize: 12, fontWeight: 500, fontFamily: "Georgia, 'Times New Roman', serif",
          textTransform: "uppercase" as const, letterSpacing: 1.5,
          display: "inline-flex", alignItems: "center", gap: 8,
        },
        wrapper: "flex flex-wrap gap-4",
      };
    case "playful":
      return {
        primary: {
          background: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)",
          color: "#fff", borderRadius: 16, padding: "10px 22px",
          fontSize: 13, fontWeight: 700, fontFamily: "Inter, Arial, sans-serif",
          border: "none", boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
          display: "inline-flex", alignItems: "center", gap: 6,
        },
        secondary: {
          background: "#f3e8ff", color: "#7c3aed",
          border: "2px solid #c4b5fd", borderRadius: 16, padding: "8px 18px",
          fontSize: 13, fontWeight: 600, fontFamily: "Inter, Arial, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        },
        wrapper: "flex flex-wrap gap-3",
      };
    case "newsletter":
      return {
        primary: {
          background: "#1a1a2e", color: "#e2e8f0",
          borderRadius: 4, padding: "10px 20px",
          fontSize: 13, fontWeight: 600, fontFamily: "Inter, Arial, sans-serif",
          border: "none", display: "inline-flex", alignItems: "center", gap: 6,
        },
        secondary: {
          background: "#f8fafc", color: "#1a1a2e",
          border: "1px solid #e2e8f0", borderRadius: 4, padding: "10px 20px",
          fontSize: 13, fontWeight: 500, fontFamily: "Inter, Arial, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        },
        wrapper: "grid grid-cols-2 gap-3",
      };
    case "minimal":
    default:
      return {
        primary: {
          background: "#F54029", color: "#fff",
          borderRadius: 6, padding: "8px 16px",
          fontSize: 13, fontWeight: 500, fontFamily: "Inter, Arial, sans-serif",
          border: "none", display: "inline-flex", alignItems: "center", gap: 6,
        },
        secondary: {
          background: "transparent", color: "#374151",
          border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 16px",
          fontSize: 13, fontWeight: 500, fontFamily: "Inter, Arial, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        },
        wrapper: "flex flex-wrap gap-2",
      };
  }
}
import dynamic from "next/dynamic";

// Lazy-load SignatureBuilder (heavy component with dnd, react-icons, etc.)
const SignatureBuilder = dynamic(() => import("@/components/SignatureBuilder"), { ssr: false, loading: () => <div className="flex items-center justify-center py-12 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading signature builder...</div> });

// Simple stepper header
function StepHeader({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>Step {step} / {total} — <span className="font-medium text-foreground">{labels[step - 1]}</span></div>
        <span className="h-1 w-32 rounded bg-secondary overflow-hidden">
          <span className="block h-1 bg-primary transition-all" style={{ width: `${(step/total)*100}%` }} />
        </span>
      </div>
    </div>
  );
}

export type FirstContactWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[]; // selected leads from manager table
  leadData?: any[]; // optional: full lead objects from parent (avoids re-fetch)
  initialPrompt?: string; // optional: prefill batch prompt (e.g., per-pool)
  poolId?: string; // optional: current pool context
  listContext?: {
    name: string;
    description?: string;
    contactsCount: number;
    icpConfig?: any;
  };
};

const STEP_LABELS = ["Channels", "Brand", "AI Prep", "Signature", "Resources", "Template", "Follow-Up", "Review & Send"];

export default function FirstContactWizard({ isOpen, onClose, leadIds, leadData, initialPrompt, poolId, listContext }: FirstContactWizardProps) {
  const router = useRouter();
  const [active, setActive] = useState(1);
  const totalSteps = 8;

  // Step 1: Channels selection
  const [useEmail, setUseEmail] = useState(true);
  const [useElevenLabs, setUseElevenLabs] = useState(false);
  const [useSms, setUseSms] = useState(false);

  // ElevenLabs Voice Scheduling Config
  const [voiceAgentId, setVoiceAgentId] = useState(process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || "");
  const [voiceStartTime, setVoiceStartTime] = useState<string>("");
  const [voiceConcurrency, setVoiceConcurrency] = useState<number>(2);

  // Step 2: Brand selection (multi-brand)
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [isMultiBrand, setIsMultiBrand] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Step 3: AI prep
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [promptOverride, setPromptOverride] = useState("");
  const [voicePromptOverride, setVoicePromptOverride] = useState("");
  const [meetingLinkOverride, setMeetingLinkOverride] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiOverrideActive, setAiOverrideActive] = useState(false);
  const [senderOverrideEnabled, setSenderOverrideEnabled] = useState(false);
  const [senderOverrideName, setSenderOverrideName] = useState("");
  const [senderOverrideTitle, setSenderOverrideTitle] = useState("");

  // Step 4: Signature (handled by SignatureBuilder component internally)
  // Step 5: Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<OutreachTemplateId>("minimal");
  // Template customization state
  const [bgTexture, setBgTexture] = useState<string>("none");
  const [borderAccent, setBorderAccent] = useState<string>("none");
  const [cardStyle, setCardStyle] = useState<string>("flat");
  const [dividerStyle, setDividerStyle] = useState<string>("thin");
  const [showResources, setShowResources] = useState<boolean>(true);
  const [bannerImageUrl, setBannerImageUrl] = useState<string>("");
  const [bannerHeight, setBannerHeight] = useState<number>(120);
  const [bannerPositionY, setBannerPositionY] = useState<number>(50);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const { signedUrl: signedBannerUrl } = useSignedUrl(bannerImageUrl || null);
  const [templatePreviewHtml, setTemplatePreviewHtml] = useState<string>("");
  const [loadingTemplatePreview, setLoadingTemplatePreview] = useState(false);
  const [themeColorOverride, setThemeColorOverride] = useState<string>(""); // empty = use brand default
  const [secondaryColorOverride, setSecondaryColorOverride] = useState<string>(""); // empty = default green

  // Step 6: Resources
  const [resources, setResources] = useState<any[]>([]);
  const [savingResources, setSavingResources] = useState(false);
  const [signatureSource, setSignatureSource] = useState<"user" | "brand">("user");

  // Step 7: Follow-Up Config
  const [followupEnabled, setFollowupEnabled] = useState(true);
  const [followupDelayDays, setFollowupDelayDays] = useState(3);
  const [followupMaxCount, setFollowupMaxCount] = useState(2);
  const [followupPrompt, setFollowupPrompt] = useState("");

  // Step 8: Review & Send
  const [testMode, setTestMode] = useState(false);
  const [testEmailRecipients, setTestEmailRecipients] = useState("");
  const [senderMode, setSenderMode] = useState<"company" | "personal">("company");
  const [emailConfigs, setEmailConfigs] = useState<any[]>([]);
  const [testLeadId, setTestLeadId] = useState<string | null>(null);
  const { data: session } = useSession();
  const canSend = useMemo(() => {
    return isOpen && leadIds && leadIds.length > 0 && (useEmail || useSms || useElevenLabs);
  }, [isOpen, leadIds, useEmail, useSms, useElevenLabs]);

  // Draft persistence
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ name: string; updatedAt: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);

  // Generate a stable 24-char hex string as a fallback pool ID for drafts
  const fallbackPoolId = React.useMemo(() => {
    if (poolId) return poolId;
    if (!leadIds || leadIds.length === 0) return null;
    const str = leadIds.slice().sort().join("_");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return (hex + hex + hex).slice(0, 24);
  }, [poolId, leadIds]);

  // Check for existing draft on open
  useEffect(() => {
    if (!isOpen || !fallbackPoolId) return;
    fetch(`/api/outreach/drafts?poolId=${encodeURIComponent(fallbackPoolId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.draft) {
          setHasDraft(true);
          setDraftMeta({ name: data.draft.name, updatedAt: data.draft.updatedAt });
        } else {
          setHasDraft(false);
          setDraftMeta(null);
        }
      })
      .catch(() => {});
  }, [isOpen, fallbackPoolId]);

  const saveDraft = async () => {
    const draftPoolId = fallbackPoolId;
    if (!draftPoolId) { toast.error("Cannot save draft — no context"); return; }
    setSavingDraft(true);
    try {
      const state = {
        active,
        useEmail, useElevenLabs, useSms,
        voiceAgentId, voiceStartTime, voiceConcurrency,
        selectedBrandId,
        promptOverride, voicePromptOverride, meetingLinkOverride,
        aiOverrideActive, senderOverrideEnabled, senderOverrideName, senderOverrideTitle,
        selectedTemplate, themeColorOverride, secondaryColorOverride,
        bgTexture, borderAccent, cardStyle, dividerStyle, showResources,
        senderMode, testMode, testEmailRecipients,
      };
      const res = await fetch("/api/outreach/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: draftPoolId,
          name: listContext?.name ? `Draft: ${listContext.name}` : "Untitled Draft",
          state,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setHasDraft(true);
      setDraftMeta({ name: data.draft.name, updatedAt: data.draft.updatedAt });
      toast.success("Draft saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = async () => {
    if (!fallbackPoolId) return;
    setLoadingDraft(true);
    try {
      const res = await fetch(`/api/outreach/drafts?poolId=${encodeURIComponent(fallbackPoolId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data.draft?.state) { toast.error("No draft found"); return; }
      const s = data.draft.state;
      if (data.draft.state) {
          if (data.draft.state.active) setActive(data.draft.state.active);
          if (data.draft.state.useEmail !== undefined) setUseEmail(data.draft.state.useEmail);
          if (data.draft.state.useElevenLabs !== undefined) setUseElevenLabs(data.draft.state.useElevenLabs);
          if (data.draft.state.useSms !== undefined) setUseSms(data.draft.state.useSms);
          if (data.draft.state.voiceAgentId) setVoiceAgentId(data.draft.state.voiceAgentId);
          if (data.draft.state.voiceStartTime) setVoiceStartTime(data.draft.state.voiceStartTime);
          if (data.draft.state.voiceConcurrency) setVoiceConcurrency(data.draft.state.voiceConcurrency);
      }
      if (s.selectedBrandId) setSelectedBrandId(s.selectedBrandId);
      if (s.promptOverride) setPromptOverride(s.promptOverride);
      if (s.voicePromptOverride) setVoicePromptOverride(s.voicePromptOverride);
      if (s.meetingLinkOverride) setMeetingLinkOverride(s.meetingLinkOverride);
      if (s.aiOverrideActive !== undefined) setAiOverrideActive(s.aiOverrideActive);
      if (s.senderOverrideEnabled !== undefined) setSenderOverrideEnabled(s.senderOverrideEnabled);
      if (s.senderOverrideName) setSenderOverrideName(s.senderOverrideName);
      if (s.senderOverrideTitle) setSenderOverrideTitle(s.senderOverrideTitle);
      if (s.selectedTemplate) setSelectedTemplate(s.selectedTemplate);
      if (s.bgTexture) setBgTexture(s.bgTexture);
      if (s.borderAccent) setBorderAccent(s.borderAccent);
      if (s.cardStyle) setCardStyle(s.cardStyle);
      if (s.dividerStyle) setDividerStyle(s.dividerStyle);
      if (s.showResources !== undefined) setShowResources(s.showResources);
      if (s.themeColorOverride) setThemeColorOverride(s.themeColorOverride);
      if (s.secondaryColorOverride) setSecondaryColorOverride(s.secondaryColorOverride);
      if (s.senderMode) setSenderMode(s.senderMode);
      if (s.testMode !== undefined) setTestMode(s.testMode);
      if (s.testEmailRecipients) setTestEmailRecipients(s.testEmailRecipients);
      toast.success("Draft loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load draft");
    } finally {
      setLoadingDraft(false);
    }
  };

  // Brand identity for dynamic prompt building
  const [brandInfo, setBrandInfo] = useState<any>(null);

  // Get the currently selected brand object
  const selectedBrand = useMemo(() => {
    if (!isMultiBrand || brands.length === 0) return brandInfo;
    return brands.find((b: any) => b.id === selectedBrandId) || brandInfo;
  }, [isMultiBrand, brands, selectedBrandId, brandInfo]);

  // Brand-aware API URLs
  const resourcesApiUrl = useMemo(() => {
    return selectedBrandId ? `/api/profile/resources?brandId=${selectedBrandId}` : "/api/profile/resources";
  }, [selectedBrandId]);

  // Helper to load resources for a specific brand or user-level
  async function loadResources(brandIdOverride?: string | null) {
    try {
      const url = brandIdOverride ? `/api/profile/resources?brandId=${brandIdOverride}` : "/api/profile/resources";
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        setResources(j?.resources || []);
        const calRes = (j?.resources || []).find((res: any) => res.id === "calendar");
        if (calRes?.href && calRes.href !== "#") {
          setMeetingLinkOverride(calRes.href);
        }
      }
    } catch {}
  }

  useEffect(() => {
    if (!isOpen) return;
    // Load defaults once when opening
    (async () => {
      let savedPrompt = "";
      try {
        const p = await fetch("/api/profile/outreach-prompt");
        if (p.ok) {
          const j = await p.json();
          savedPrompt = j?.promptText || "";
          setDefaultPrompt(savedPrompt);
        }
      } catch {}
      // Load resources (user-level initially, brand-level loaded after brand fetch)
      await loadResources();
      // Fetch brand identity / multi-brand data
      let fetchedBrand: any = null;
      try {
        setLoadingBrands(true);
        const b = await fetch("/api/admin/brand?_t=" + Date.now(), { cache: "no-store", headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" } });
        if (b.ok) {
          const data = await b.json();
          if (data.multiBrand && Array.isArray(data.brands)) {
            // Multi-brand team
            setIsMultiBrand(true);
            setBrands(data.brands);
            const defaultBrand = data.brands.find((br: any) => br.is_default) || data.brands[0];
            setSelectedBrandId(defaultBrand?.id || null);
            fetchedBrand = defaultBrand;
            setBrandInfo(defaultBrand);
          } else {
            // Single-brand team
            setIsMultiBrand(false);
            setBrands([]);
            fetchedBrand = data;
            setBrandInfo(data);
          }
        }
      } catch {} finally {
        setLoadingBrands(false);
      }

      // Fetch team email configs for sender selection
      try {
        const ec = await fetch("/api/admin/email-config");
        if (ec.ok) {
          const configs = await ec.json();
          setEmailConfigs(Array.isArray(configs) ? configs : configs?.configs || []);
        }
      } catch {}

      // Set test lead from leadData or fallback to first ID
      if (leadData && leadData.length > 0) {
        const withEmail = leadData.filter((l: any) => l.email);
        if (withEmail.length > 0) setTestLeadId(withEmail[0]?.id || leadIds[0]);
        else setTestLeadId(leadIds[0]);
      } else if (leadIds.length > 0) {
        setTestLeadId(leadIds[0]);
      }

      // Auto-populate Default Prompt from brand template if no saved prompt exists
      if (!savedPrompt?.trim()?.length && fetchedBrand) {
        const brandName = fetchedBrand?.company_name || "our company";
        const brandMission = fetchedBrand?.mission_statement || "";
        const brandVoice = fetchedBrand?.brand_voice || "professional and confident";
        const brandLocation = fetchedBrand?.location || "";
        const brandCTAs = Array.isArray(fetchedBrand?.cta_preferences) ? fetchedBrand.cta_preferences.join("; ") : "schedule a meeting";
        const brandProducts = Array.isArray(fetchedBrand?.key_products_services) ? fetchedBrand.key_products_services.join(", ") : "";
        const brandApproach = fetchedBrand?.outreach_approach || "";

        const template = [
          `Persona:`,
          `You are writing on behalf of ${brandName}. Write entirely in first person (I/me).`,
          brandMission ? `Mission: ${brandMission}` : "",
          brandProducts ? `Products/Services: ${brandProducts}` : "",
          ``,
          `Goal:`,
          `Craft personalized outreach emails tailored to the recipients (batch).`,
          brandApproach ? `Approach: ${brandApproach}` : "",
          ``,
          `Requirements:`,
          `- Return JSON with keys "subject" and "body".`,
          `- Body plain text (no HTML), 250–300 words.`,
          `- Narrative, insight-driven; no section headings.`,
          `- Voice: ${brandVoice}.`,
          `- End with confident CTA: ${brandCTAs}.`,
          brandLocation ? `- Location context: ${brandLocation}.` : "",
        ].filter(Boolean).join("\n");
        setDefaultPrompt(template);
      }
    })();
    // Prefill per-pool prompt if provided
    if (initialPrompt && initialPrompt.trim().length) {
      setPromptOverride(initialPrompt);
    }
    setActive(1);
    setSelectedTemplate("minimal");
    setTemplatePreviewHtml("");
  }, [isOpen, initialPrompt]);

  // Re-load resources when brand selection changes
  useEffect(() => {
    if (!isOpen || !selectedBrandId) return;
    loadResources(selectedBrandId);
  }, [selectedBrandId]);

  // Track whether resources have been loaded from the API (skip auto-save on initial hydration)
  const resourcesLoaded = useRef(false);

  // Auto-save resources on change (debounced)
  useEffect(() => {
    if (!resourcesLoaded.current) {
      // First time resources are set from loadResources() — skip auto-save
      if (resources.length > 0) resourcesLoaded.current = true;
      return;
    }
    const timer = setTimeout(() => {
      // Fire-and-forget save
      fetch(resourcesApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceLinks: resources }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [resources, resourcesApiUrl]);

  // When brand selection changes, rebuild the default prompt using selected brand
  useEffect(() => {
    if (!isOpen || !selectedBrandId || brands.length === 0) return;
    const brand = brands.find((b: any) => b.id === selectedBrandId);
    if (!brand) return;

    // Only auto-rebuild if the user hasn't saved a custom prompt (i.e., defaultPrompt was auto-generated)
    // We detect this by checking if the prompt still starts with "Persona:" (our template marker)
    const isAutoGenerated = !defaultPrompt?.trim() || defaultPrompt.trim().startsWith("Persona:");
    if (!isAutoGenerated) return;

    const brandName = brand.company_name || "our company";
    const brandMission = brand.mission_statement || "";
    const brandVoice = brand.brand_voice || "professional and confident";
    const brandLocation = brand.location || "";
    const brandCTAs = Array.isArray(brand.cta_preferences) ? brand.cta_preferences.join("; ") : "schedule a meeting";
    const brandProducts = Array.isArray(brand.key_products_services) ? brand.key_products_services.join(", ") : "";
    const brandApproach = brand.outreach_approach || "";

    const template = [
      `Persona:`,
      `You are writing on behalf of ${brandName}. Write entirely in first person (I/me).`,
      brandMission ? `Mission: ${brandMission}` : "",
      brandProducts ? `Products/Services: ${brandProducts}` : "",
      ``,
      `Goal:`,
      `Craft personalized outreach emails tailored to the recipients (batch).`,
      brandApproach ? `Approach: ${brandApproach}` : "",
      ``,
      `Requirements:`,
      `- Return JSON with keys "subject" and "body".`,
      `- Body plain text (no HTML), 250–300 words.`,
      `- Narrative, insight-driven; no section headings.`,
      `- Voice: ${brandVoice}.`,
      `- End with confident CTA: ${brandCTAs}.`,
      brandLocation ? `- Location context: ${brandLocation}.` : "",
    ].filter(Boolean).join("\n");
    setDefaultPrompt(template);
  }, [selectedBrandId, brands, isOpen]);

  // Generate template preview HTML via API
  const generateTemplatePreview = async (templateId: OutreachTemplateId) => {
    setLoadingTemplatePreview(true);
    try {
      const res = await fetch("/api/outreach/preview/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          brandId: selectedBrandId || undefined,
          signatureSource,
          baseUrl: typeof window !== "undefined" ? window.location.origin : "",
          props: {
            brand: {
              accentColor: themeColorOverride || (selectedBrand || brandInfo)?.primary_brand_color || "#F54029",
              ...(secondaryColorOverride || (selectedBrand || brandInfo)?.secondary_brand_color ? { secondaryColor: secondaryColorOverride || (selectedBrand || brandInfo)?.secondary_brand_color } : {}),
              ...((selectedBrand || brandInfo)?.logo_url ? { logoUrl: (selectedBrand || brandInfo).logo_url } : {}),
            },
            resources: resources.filter((r: any) => r.enabled !== false),
            templateOptions: { backgroundTexture: bgTexture, borderAccent, cardStyle, dividerStyle, showResources, ...(bannerImageUrl ? { bannerImageUrl, bannerHeight, bannerPositionY } : {}) },
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplatePreviewHtml(data.html || "");
    } catch (err) {
      console.error("Failed to render template preview:", err);
      setTemplatePreviewHtml('<div style="padding:20px;color:#ef4444;">Failed to load preview</div>');
    } finally {
      setLoadingTemplatePreview(false);
    }
  };

  // Trigger preview when entering template step or changing template
  useEffect(() => {
    if (active === 6) {
      generateTemplatePreview(selectedTemplate);
    }
  }, [selectedTemplate, active, themeColorOverride, secondaryColorOverride, bgTexture, borderAccent, cardStyle, dividerStyle, showResources, bannerImageUrl, bannerHeight, bannerPositionY]);

  function next() {
    let nextStep = active + 1;
    // Auto-skip brand selection step for single-brand teams
    if (nextStep === 2 && !isMultiBrand) {
      nextStep = 3;
    }
    setActive(Math.min(totalSteps, nextStep));
  }
  function prev() {
    let prevStep = active - 1;
    // Auto-skip brand selection step for single-brand teams
    if (prevStep === 2 && !isMultiBrand) {
      prevStep = 1;
    }
    setActive(Math.max(1, prevStep));
  }

  async function generateBatchPrompt() {
    try {
      setLoadingPrompt(true);
      const brand = selectedBrand || brandInfo;
      const brandName = brand?.company_name || "our company";
      const brandMission = brand?.mission_statement || "";
      const brandVoice = brand?.brand_voice || "professional and confident";
      const brandLocation = brand?.location || "";
      const brandCTAs = Array.isArray(brand?.cta_preferences) ? brand.cta_preferences.join("; ") : "schedule a meeting";
      const brandProducts = Array.isArray(brand?.key_products_services) ? brand.key_products_services.join(", ") : "";
      const brandApproach = brand?.outreach_approach || "";

      const base = defaultPrompt?.trim().length ? defaultPrompt.trim() : [
        `Persona:`,
        `You are writing on behalf of ${brandName}. Write entirely in first person (I/me).`,
        brandMission ? `Mission: ${brandMission}` : "",
        brandProducts ? `Products/Services: ${brandProducts}` : "",
        ``,
        `Goal:`,
        `Craft personalized outreach emails tailored to the recipients (batch).`,
        brandApproach ? `Approach: ${brandApproach}` : "",
        ``,
        `Requirements:`,
        `- Return JSON with keys "subject" and "body".`,
        `- Body plain text (no HTML), 250–300 words.`,
        `- Narrative, insight-driven; no section headings.`,
        `- Voice: ${brandVoice}.`,
        `- End with confident CTA: ${brandCTAs}.`,
        brandLocation ? `- Location context: ${brandLocation}.` : "",
      ].filter(Boolean).join("\n");
      const summary = `\nBatch Context:\n- Pool: ${poolId || "(n/a)"}\n- Leads selected: ${leadIds.length}\n- IDs: ${leadIds.slice(0, 12).join(", ")} ${leadIds.length>12?"…":""}\n- Use stored resources & signature; include tracking pixel.\n`;
      setDefaultPrompt([base, summary].join("\n"));
      setAiOverrideActive(false);
      toast.success("Default prompt populated. You can edit it or use AI Generate.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to build batch prompt");
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function aiGeneratePrompt() {
    try {
      setAiGenerating(true);
      const res = await fetch("/api/ai/generate-outreach-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listContext: listContext || null,
          leadCount: leadIds.length,
          brandId: selectedBrandId || undefined,
          senderName: senderOverrideEnabled && senderOverrideName?.trim() ? senderOverrideName.trim() : undefined,
          senderTitle: senderOverrideEnabled && senderOverrideTitle?.trim() ? senderOverrideTitle.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { prompt } = await res.json();
      setPromptOverride(prompt);
      setAiOverrideActive(true);
      toast.success("AI prompt generated from your brand & list context!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate AI prompt");
    } finally {
      setAiGenerating(false);
    }
  }

  async function saveResources() {
    try {
      setSavingResources(true);
      const res = await fetch(resourcesApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceLinks: resources })
      });
      if (res.ok) toast.success("Resources saved"); else toast.error(await res.text());
    } catch (e: any) {
      toast.error(e?.message || "Failed to save resources");
    } finally { setSavingResources(false); }
  }

  async function savePoolPrompt() {
    try {
      if (!poolId) {
        toast.error("Select a pool in All Leads to save prompt");
        return;
      }
      const bodyPrompt = (promptOverride?.trim()?.length ? promptOverride.trim() : defaultPrompt?.trim() || "");
      if (!bodyPrompt.length) {
        toast.error("Nothing to save. Provide a prompt.");
        return;
      }
      const res = await fetch(`/api/leads/pools/${encodeURIComponent(poolId)}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: bodyPrompt })
      });
      if (res.ok) {
        toast.success("Pool prompt updated");
      } else {
        toast.error(await res.text());
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update pool prompt");
    }
  }

  const [launching, setLaunching] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testProgress, setTestProgress] = useState({ sent: 0, total: 0, errors: 0 });

  async function sendOutreach(forceTestMode?: boolean) {
    const isTest = forceTestMode !== undefined ? forceTestMode : testMode;
    if (!canSend) {
      toast.error("Select at least one lead and channel (Email/SMS/Phone)");
      return;
    }
    if (launching) return; // Prevent double-clicks
    if (!isTest) setLaunching(true);
    try {
      const testEmailValue = isTest && testEmailRecipients.trim() ? testEmailRecipients.trim() : undefined;
      // In test mode, only send for the selected test lead (not all leads)
      const sendLeadIds = isTest && testLeadId ? [testLeadId] : leadIds;
      // For test mode, include inline lead data so the API doesn't need to look it up
      const testLeadData = isTest && testLeadId && leadData
        ? leadData.find((l: any) => (l.email || l.accountEmail || (l.accountAdditionalEmails && l.accountAdditionalEmails[0])) && l.id === testLeadId)
        : undefined;

      const sendLeadData = (leadData || []).filter((l: any) => l.email).map((l: any) => ({
        id: l.id, firstName: l.firstName, lastName: l.lastName,
        company: l.company, jobTitle: l.jobTitle,
        email: l.email,
        additional_emails: l.additional_emails || l.accountAdditionalEmails || [],
      }));

      const emailPayload = {
        leadIds: sendLeadIds,
        leadData: sendLeadData,
        test: isTest,
        testEmail: testEmailValue,
        inlineLeads: testLeadData ? [testLeadData] : undefined,
        promptOverride: promptOverride?.trim() || undefined,
        meetingLinkOverride: meetingLinkOverride?.trim() || undefined,
        brandId: selectedBrandId || undefined,
        poolId: poolId || undefined,
        senderMode,
        signatureSource,
        templateId: selectedTemplate,
        themeColorOverride: themeColorOverride || undefined,
        secondaryColorOverride: secondaryColorOverride || undefined,
        templateOptions: { backgroundTexture: bgTexture, borderAccent, cardStyle, dividerStyle, showResources, ...(bannerImageUrl ? { bannerImageUrl, bannerHeight, bannerPositionY } : {}) },
        senderOverride: senderOverrideEnabled && senderOverrideName?.trim()
          ? { name: senderOverrideName.trim(), title: senderOverrideTitle?.trim() || undefined }
          : undefined,
        followupConfig: followupEnabled ? {
          enabled: true,
          delayHours: followupDelayDays * 24,
          maxCount: followupMaxCount,
          prompt: followupPrompt?.trim() || undefined,
        } : undefined,
      };

      // ── Real (non-test) send: create campaign first, then fire-and-forget emails ──
      if (!isTest) {
        // Step 1: Create the campaign record (awaited — must exist before redirect)
        let newCampaignId: string | undefined;
        try {
          const campaignRes = await fetch("/api/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${listContext?.name || "Outreach"} — ${new Date().toLocaleDateString()}`,
              description: listContext?.description || undefined,
              status: "ACTIVE",
              channels: [
                ...(useEmail ? ["EMAIL"] : []),
                ...(useSms ? ["SMS"] : []),
                ...(useElevenLabs ? ["PHONE"] : []),
              ],
              leadIds: sendLeadIds,
              poolId: poolId || undefined,
              brandId: selectedBrandId || undefined,
              promptOverride: promptOverride?.trim() || undefined,
              signatureHtml: undefined, // Signature is handled per-email in the send route
              meetingLink: meetingLinkOverride?.trim() || undefined,
              campaignBranding: {
                templateId: selectedTemplate,
                senderMode,
                signatureSource,
                themeColorOverride,
                secondaryColorOverride,
                bgTexture,
                borderAccent,
                cardStyle,
                dividerStyle,
                showResources,
                bannerImageUrl,
                bannerHeight,
                bannerPositionY,
                resources: resources.filter((r: any) => r.enabled !== false)
              },
              voiceConfig: useElevenLabs ? {
                agentId: voiceAgentId?.trim() || undefined,
                startTime: voiceStartTime ? new Date(voiceStartTime).toISOString() : undefined,
                concurrency: voiceConcurrency,
                prompt: voicePromptOverride?.trim() || undefined,
              } : undefined,
              followupConfig: followupEnabled ? {
                enabled: true,
                delayHours: followupDelayDays * 24,
                maxCount: followupMaxCount,
                prompt: followupPrompt?.trim() || undefined,
              } : { enabled: false },
            }),
          });
          if (campaignRes.ok) {
            const campaignData = await campaignRes.json();
            newCampaignId = campaignData.id;
          }
        } catch (e) {
          console.error("[OUTREACH] Campaign creation error:", e);
        }

        // Step 2: Fire-and-forget the actual sends with chunking mechanism
        const CHUNK_SIZE = 25;
        const totalLeads = sendLeadIds.length;
        
        // Asynchronous background chunk dispatcher
        (async () => {
          let sentCount = 0;
          let processedCount = 0;
          let warmupLimitHit = false;
          
          for (let i = 0; i < totalLeads; i += CHUNK_SIZE) {
            const chunkIds = sendLeadIds.slice(i, i + CHUNK_SIZE);
            const chunkData = sendLeadData.filter(d => chunkIds.includes(d.id));
            
            const chunkPayload = { 
              ...emailPayload, 
              leadIds: chunkIds,
              leadData: chunkData,
              campaignId: newCampaignId 
            };
            
            try {
              if (useEmail || useElevenLabs) {
                const sendRes = await fetch("/api/outreach/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(chunkPayload),
                });
                
                if (sendRes.ok) {
                  const resJson = await sendRes.json();
                  sentCount += resJson.sent ?? 0;
                  processedCount += chunkIds.length;
                  
                  if (resJson.results && Array.isArray(resJson.results)) {
                    const hasWarmup = resJson.results.some((r: any) => 
                      r.status === "skipped" && 
                      r.reason && 
                      r.reason.toLowerCase().includes("warm-up")
                    );
                    if (hasWarmup) {
                      warmupLimitHit = true;
                    }
                  }
                  
                  const progressState = { current: processedCount, total: totalLeads };
                  
                  let streamMessage = `Batch generated successfully.`;
                  if (resJson.results && resJson.results.length > 0) {
                      const lastResult = resJson.results[resJson.results.length - 1];
                      if (lastResult.status === "sent") {
                          streamMessage = `Generation [OK]. Delivered payload to: ${lastResult.to} (${processedCount}/${totalLeads})`;
                      } else {
                          streamMessage = `Bypass: ${lastResult.to} - ${lastResult.reason}`;
                      }
                  }
                  
                  // Broadcast globally
                  await fetch(`/api/campaigns/${newCampaignId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ 
                          campaignBranding: { 
                            templateId: selectedTemplate,
                            senderMode,
                            signatureSource,
                            themeColorOverride,
                            secondaryColorOverride,
                            bgTexture,
                            borderAccent,
                            cardStyle,
                            dividerStyle,
                            showResources,
                            bannerImageUrl,
                            bannerHeight,
                            bannerPositionY,
                            repair_active: true, 
                            repair_progress: progressState, 
                            repair_stream: streamMessage 
                          } 
                      }),
                  }).catch(() => {});
                } else {
                  console.error(`[OUTREACH] Batch failed:`, await sendRes.text());
                }
              }

              // Run SMS channel
              if (useSms) {
                await fetch("/api/outreach/sms", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    leadIds: chunkIds,
                    test: false,
                    promptOverride: promptOverride?.trim() || undefined,
                  }),
                });
              }
            } catch (err) {
              console.error("[OUTREACH] Background chunk failure:", err);
            }
          }
          
          // Complete
          let streamMessage = `Outreach sequence complete. Output delivered to ${sentCount} aliases.`;
          let finalStatus = "COMPLETED";

          if (warmupLimitHit) {
            finalStatus = "ACTIVE";
            streamMessage = `Outreach paused due to daily email warmup limits. Sent: ${sentCount} emails. The remaining batch will be ready to run after the next daily reset (UTC midnight).`;
          }

          await fetch(`/api/campaigns/${newCampaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                  status: finalStatus,
                  campaignBranding: { 
                    templateId: selectedTemplate,
                    senderMode,
                    signatureSource,
                    themeColorOverride,
                    secondaryColorOverride,
                    bgTexture,
                    borderAccent,
                    cardStyle,
                    dividerStyle,
                    showResources,
                    bannerImageUrl,
                    bannerHeight,
                    bannerPositionY,
                    repair_active: false, 
                    repair_stream: streamMessage, 
                    repair_progress: null 
                  } 
              }),
          }).catch(() => {});
        })();

        // Step 3: Redirect to the live tracking page immediately
        toast.success(`Campaign launched! Directing to observation deck...`);
        onClose();
        router.push(`/campaigns/${newCampaignId}`);
        return;
      }

      // ── Test send: await response for feedback with progress ──
      const totalChannels = [useEmail, useSms, useElevenLabs].filter(Boolean).length;
      setTestSending(true);
      setTestProgress({ sent: 0, total: totalChannels, errors: 0 });

      const emailReq = (useEmail || useElevenLabs) ? fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      }) : null;

      const smsReq = useSms ? fetch("/api/outreach/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: sendLeadIds,
          test: isTest,
          promptOverride: promptOverride?.trim() || undefined,
        })
      }) : null;

      // Voice test sending is unsupported directly from the frontend; tests should use email/sms.
      const phoneReqs: Promise<Response | null>[] = [];

      // Track progress as each request completes
      let completedCount = 0;
      let errorCount = 0;
      const trackPromise = (p: Promise<Response>) => p.then((r) => {
        completedCount++;
        if (!r || !r.ok) errorCount++;
        setTestProgress({ sent: completedCount, total: totalChannels, errors: errorCount });
        return r;
      }).catch((e) => {
        completedCount++;
        errorCount++;
        setTestProgress({ sent: completedCount, total: totalChannels, errors: errorCount });
        throw e;
      });

      const promises = [emailReq, smsReq, ...(phoneReqs.length ? phoneReqs : [])].filter(Boolean) as Promise<Response>[];
      const responses = await Promise.all(promises.map(trackPromise));

      const payloads = await Promise.all(responses.map((r) => r.json().catch(() => null)));

      const emailPayload0 = payloads[0];
      const emailSummary = responses[0] && useEmail
        ? (emailPayload0?.sent === 0 && emailPayload0?.message
          ? `Email: ${emailPayload0.message}`
          : `Email sent=${emailPayload0?.sent ?? 0}, skipped=${emailPayload0?.skipped ?? 0}, errors=${emailPayload0?.errors ?? 0}`)
        : null;
      const smsIdx = useEmail ? 1 : 0;
      const smsSummary = responses[smsIdx] && useSms ? `SMS sent=${payloads[smsIdx]?.sent ?? 0}, skipped=${payloads[smsIdx]?.skipped ?? 0}, errors=${payloads[smsIdx]?.errors ?? 0}` : null;

      const phoneStartIdx = (useEmail ? 1 : 0) + (useSms ? 1 : 0);
      let callsInitiated = 0;
      let callsErrors = 0;
      if (useElevenLabs) {
        // Since we bundle the voice payload in /api/outreach/send, this logic is deprecated for tests.
        // We will just read the voice stats from the main payload if present.
        const voiceStats = payloads[0]?.voice;
        if (voiceStats) {
          callsInitiated = voiceStats.queued || 0;
          callsErrors = voiceStats.errors || 0;
        }
      }
      const phoneSummary = useElevenLabs ? `Voice queued=${callsInitiated}${callsErrors ? ", errors=" + callsErrors : ""}` : null;

      if (emailSummary || smsSummary || phoneSummary) {
        toast.success([emailSummary, smsSummary, phoneSummary].filter(Boolean).join("; "));
      } else {
        const firstError = responses.find((r) => !r || !r.ok);
        const idx = firstError ? responses.indexOf(firstError) : -1;
        const errPayload = idx >= 0 ? payloads[idx] : null;
        toast.error(typeof errPayload === "string" ? errPayload : (errPayload?.message || "Failed to send"));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send outreach");
    } finally {
      setLaunching(false);
      setTestSending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`${
        active === 4 || active === 5 || active === 6
          ? "sm:max-w-[92vw] lg:max-w-7xl"
          : "sm:max-w-4xl lg:max-w-5xl"
      } transition-all duration-300 max-h-[92vh] h-[92vh] flex flex-col`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">Initiate First Contact</DialogTitle>
          <StepHeader step={active} total={totalSteps} labels={STEP_LABELS} />
        </DialogHeader>

        {/* Scrollable step content area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">

        {/* ════════════════ Step 1: Channel Selection ════════════════ */}
        {active === 1 && (
          <div className="space-y-5 py-2">
            {/* Load Draft Banner */}
            {hasDraft && fallbackPoolId && draftMeta && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <FileTextIcon className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{draftMeta.name}</p>
                  <p className="text-[11px] text-muted-foreground">Saved {new Date(draftMeta.updatedAt).toLocaleDateString()} at {new Date(draftMeta.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={loadDraft} disabled={loadingDraft} className="shrink-0">
                  {loadingDraft ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Load Draft
                </Button>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Choose which outreach channels to activate for this campaign. Toggle any combination below.</p>

            {/* Channel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Email Card */}
              <button
                type="button"
                onClick={() => setUseEmail(!useEmail)}
                className={`group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none ${
                  useEmail
                    ? "border-blue-500/60 bg-blue-500/5 shadow-lg shadow-blue-500/10"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                  useEmail
                    ? "bg-blue-500/15 text-blue-500 scale-110"
                    : "bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80"
                }`}>
                  <Mail className="w-8 h-8" />
                </div>
                <h3 className={`text-lg font-bold mb-1 transition-colors ${
                  useEmail ? "text-blue-500" : "text-foreground"
                }`}>Email</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">AI-generated personalized emails sent directly to each lead's inbox</p>

                {/* Toggle Switch */}
                <div className={`mt-5 w-14 h-8 rounded-full relative transition-colors duration-300 ${
                  useEmail ? "bg-blue-500" : "bg-muted-foreground/20"
                }`}>
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                    useEmail ? "left-7" : "left-1"
                  }`} />
                </div>

                {/* Active glow ring */}
                {useEmail && (
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-blue-500/30 pointer-events-none" />
                )}
              </button>

              {/* Voice Card */}
              <button
                type="button"
                onClick={() => setUseElevenLabs(!useElevenLabs)}
                className={`group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none ${
                  useElevenLabs
                    ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/10"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                  useElevenLabs
                    ? "bg-emerald-500/15 text-emerald-500 scale-110"
                    : "bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80"
                }`}>
                  <Phone className="w-8 h-8" />
                </div>
                <h3 className={`text-lg font-bold mb-1 transition-colors ${
                  useElevenLabs ? "text-emerald-500" : "text-foreground"
                }`}>AI Voice</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">ElevenLabs AI agents will call your leads directly via AWS Chime</p>

                {/* Toggle Switch */}
                <div className={`mt-5 w-14 h-8 rounded-full relative transition-colors duration-300 ${
                  useElevenLabs ? "bg-emerald-500" : "bg-muted-foreground/20"
                }`}>
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                    useElevenLabs ? "left-7" : "left-1"
                  }`} />
                </div>

                {useElevenLabs && (
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-500/30 pointer-events-none" />
                )}
              </button>

              {/* SMS Card */}
              <button
                type="button"
                onClick={() => setUseSms(!useSms)}
                className={`group relative flex flex-col items-center text-center p-8 rounded-2xl border-2 transition-all duration-300 cursor-pointer select-none ${
                  useSms
                    ? "border-violet-500/60 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20"
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                  useSms
                    ? "bg-violet-500/15 text-violet-500 scale-110"
                    : "bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80"
                }`}>
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className={`text-lg font-bold mb-1 transition-colors ${
                  useSms ? "text-violet-500" : "text-foreground"
                }`}>SMS</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Send text message outreach to leads with valid phone numbers</p>

                {/* Toggle Switch */}
                <div className={`mt-5 w-14 h-8 rounded-full relative transition-colors duration-300 ${
                  useSms ? "bg-violet-500" : "bg-muted-foreground/20"
                }`}>
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                    useSms ? "left-7" : "left-1"
                  }`} />
                </div>

                {useSms && (
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-violet-500/30 pointer-events-none" />
                )}
              </button>
            </div>

            {/* AI Voice Configuration Panel */}
            {useElevenLabs && (
              <div className="mt-6 p-5 border border-emerald-500/30 bg-emerald-500/5 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-emerald-600 mb-2">
                  <Phone className="w-4 h-4" />
                  <h4 className="font-semibold text-sm">Batch Voice Configuration</h4>
                </div>
                
                <div className="mb-4">
                  <label className="text-xs font-medium text-foreground">Schedule Start Time (Optional)</label>
                  <p className="text-[10px] text-muted-foreground mb-1">Leave blank to start the voice campaign immediately.</p>
                  <Input 
                    type="datetime-local" 
                    value={voiceStartTime}
                    onChange={(e) => setVoiceStartTime(e.target.value)}
                    className="h-9 bg-background/50 border-emerald-500/20 focus-visible:ring-emerald-500/50"
                  />
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-end mb-1">
                    <div>
                      <label className="text-xs font-medium text-foreground">Concurrency Rate Limit</label>
                      <p className="text-[10px] text-muted-foreground">How many calls should the AI dispatch per minute?</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">{voiceConcurrency} calls / min</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={voiceConcurrency}
                    onChange={(e) => setVoiceConcurrency(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                    <span>1 (Safest)</span>
                    <span>10+ (Enterprise SIP Trunks Only)</span>
                    <span>20 (Max)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active channels summary */}
            {(useEmail || useElevenLabs || useSms) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  Active: {[useEmail && "Email", useElevenLabs && "AI Voice", useSms && "SMS"].filter(Boolean).join(", ")}
                  {" "}&middot; {leadIds.length} lead{leadIds.length !== 1 ? "s" : ""} selected
                </span>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ Step 2: Brand Selection (multi-brand teams only) ════════════════ */}
        {active === 2 && isMultiBrand && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Select which brand identity to use for this outreach campaign. The selected brand's voice, CTAs, and context will guide AI prompt generation.</div>
            {loadingBrands ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading brands...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brands.map((brand: any) => (
                  <button
                    key={brand.id}
                    onClick={() => setSelectedBrandId(brand.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedBrandId === brand.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-background hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-muted p-1 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{brand.brand_label || brand.company_name || "Unnamed Brand"}</div>
                        {brand.company_name && brand.brand_label && (
                          <div className="text-xs text-muted-foreground truncate">{brand.company_name}</div>
                        )}
                        {brand.industry && <div className="text-xs text-muted-foreground mt-0.5">{brand.industry}</div>}
                        {brand.is_default && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">Default</span>
                        )}
                      </div>
                    </div>
                    {brand.primary_brand_color && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: brand.primary_brand_color }} />
                        <span className="text-[10px] text-muted-foreground">{brand.primary_brand_color}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ Step 3: AI Prep ════════════════ */}
        {active === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Initialize AI to prepare a batch prompt. Start from your saved default and enrich with the selected leads/project context.
              {isMultiBrand && selectedBrand && (
                <span className="ml-1 font-medium text-foreground">Using brand: {selectedBrand?.brand_label || selectedBrand?.company_name}</span>
              )}
            </div>
            {useElevenLabs ? (
              <Tabs defaultValue={useEmail || useSms ? "text" : "voice"} className="w-full">
                <TabsList className="mb-4 w-full grid grid-cols-2">
                  <TabsTrigger value="text" disabled={!(useEmail || useSms)}>Text Prep (Email / SMS)</TabsTrigger>
                  <TabsTrigger value="voice">Voice Prep (ElevenLabs)</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-4 mt-0">
                  <div className="border border-border rounded-md p-3 space-y-3 bg-card/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-medium">Sender Identity Override</label>
                        <p className="text-[10px] text-muted-foreground">Use a different name and title instead of your profile.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSenderOverrideEnabled(!senderOverrideEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          senderOverrideEnabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          senderOverrideEnabled ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                    {senderOverrideEnabled && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground">Name</label>
                          <Input className="mt-0.5 h-8 text-sm" value={senderOverrideName} onChange={(e) => setSenderOverrideName(e.target.value)} placeholder="e.g., Jane Smith" />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-muted-foreground">Title / Position</label>
                          <Input className="mt-0.5 h-8 text-sm" value={senderOverrideTitle} onChange={(e) => setSenderOverrideTitle(e.target.value)} placeholder="e.g., VP of Partnerships" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium">Default Prompt {aiOverrideActive && <span className="text-muted-foreground">(overridden by AI)</span>}</label>
                    <Textarea className={`mt-1 ${aiOverrideActive ? "opacity-50 cursor-not-allowed" : ""}`} rows={6} value={defaultPrompt} onChange={(e) => setDefaultPrompt(e.target.value)} disabled={aiOverrideActive} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={aiGeneratePrompt} disabled={aiGenerating} className="bg-purple-600 hover:bg-purple-700 text-white">
                      {aiGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> AI Generate Prompt</>}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={generateBatchPrompt} disabled={loadingPrompt}>Use Template</Button>
                    <span className="text-xs text-muted-foreground">AI uses your brand identity & list context.</span>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Batch Prompt Override</label>
                    <Textarea className="mt-1" rows={6} value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} placeholder="Optional: override prompt used when generating emails for this batch" />
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => savePoolPrompt()} disabled={!poolId || !(promptOverride?.trim()?.length)}>Save as Pool Prompt</Button>
                      <span className="text-[11px] text-muted-foreground">Saves this override as the pool-level AI prompt/strategy.</span>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="voice" className="space-y-4 mt-0">
                  <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                        <Phone className="w-4 h-4" /> AI Voice Custom Instructions
                      </label>
                      <p className="text-[11px] text-muted-foreground mb-3">
                        These instructions will be sent as `campaign_instruction` to your ElevenLabs agent dynamically right before the call starts.
                      </p>
                      <Textarea 
                        className="font-mono text-xs h-32 bg-background/50 border-emerald-500/20 focus-visible:ring-emerald-500/50" 
                        value={voicePromptOverride} 
                        onChange={(e) => setVoicePromptOverride(e.target.value)} 
                        placeholder={'Example: "You are calling to follow up on a recent email we sent about {{campaign_context}}. Your ultimate goal is to schedule a meeting. Do not talk for more than 15 seconds at a time."'} 
                      />
                    </div>
                    
                    <div className="bg-background/80 rounded-lg p-3 border border-border">
                      <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Available System Variables</p>
                      <ul className="text-[10px] space-y-1 text-muted-foreground mb-3 font-mono">
                        <li><span className="text-foreground font-semibold">{"{{"}agent_name{"}}"}</span> — Your AI's Name</li>
                        <li><span className="text-foreground font-semibold">{"{{"}lead_first_name{"}}"}</span> — Prospect's First Name</li>
                        <li><span className="text-foreground font-semibold">{"{{"}lead_last_name{"}}"}</span> — Prospect's Last Name</li>
                        <li><span className="text-foreground font-semibold">{"{{"}company_name{"}}"}</span> — Your Company Name</li>
                        <li><span className="text-foreground font-semibold">{"{{"}campaign_context{"}}"}</span> — The contextual reason for this call</li>
                        <li><span className="text-foreground font-semibold">{"{{"}business_facts{"}}"}</span> — Key CRM details about the lead</li>
                      </ul>
                      <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 italic font-medium">To use dynamic variables, your ElevenLabs Agent's First Message or System Prompt must include `{"{{"}campaign_instruction{"}}"}`.</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                {/* Fallback to original text-only block if voice is disabled */}
                <div className="border border-border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium">Sender Identity Override</label>
                      <p className="text-[10px] text-muted-foreground">Use a different name and title instead of your profile.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSenderOverrideEnabled(!senderOverrideEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        senderOverrideEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        senderOverrideEnabled ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                  {senderOverrideEnabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">Name</label>
                        <Input className="mt-0.5 h-8 text-sm" value={senderOverrideName} onChange={(e) => setSenderOverrideName(e.target.value)} placeholder="e.g., Jane Smith" />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground">Title / Position</label>
                        <Input className="mt-0.5 h-8 text-sm" value={senderOverrideTitle} onChange={(e) => setSenderOverrideTitle(e.target.value)} placeholder="e.g., VP of Partnerships" />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium">Default Prompt {aiOverrideActive && <span className="text-muted-foreground">(overridden by AI)</span>}</label>
                  <Textarea className={`mt-1 ${aiOverrideActive ? "opacity-50 cursor-not-allowed" : ""}`} rows={6} value={defaultPrompt} onChange={(e) => setDefaultPrompt(e.target.value)} disabled={aiOverrideActive} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={aiGeneratePrompt} disabled={aiGenerating} className="bg-purple-600 hover:bg-purple-700 text-white">
                    {aiGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-2" /> AI Generate Prompt</>}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={generateBatchPrompt} disabled={loadingPrompt}>Use Template</Button>
                  <span className="text-xs text-muted-foreground">AI uses your brand identity & list context.</span>
                </div>
                <div>
                  <label className="text-xs font-medium">Batch Prompt Override</label>
                  <Textarea className="mt-1" rows={8} value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} placeholder="Optional: override prompt used when generating emails for this batch" />
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => savePoolPrompt()} disabled={!poolId || !(promptOverride?.trim()?.length)}>Save as Pool Prompt</Button>
                    <span className="text-[11px] text-muted-foreground">Saves this override as the pool-level AI prompt/strategy.</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Meeting Link Override</label>
              <Input className="mt-1" value={meetingLinkOverride} onChange={(e) => setMeetingLinkOverride(e.target.value)} placeholder="Optional: e.g., https://calendar.link/..." />
            </div>
          </div>
        )}

        {active === 4 && (
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="text-sm text-muted-foreground">Design your email signature using the visual builder below. Changes are saved automatically when you click Save in the builder.</div>

            {/* Signature source toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
              <button
                type="button"
                onClick={() => setSignatureSource("user")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  signatureSource === "user"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                My Signature
              </button>
              <button
                type="button"
                onClick={() => setSignatureSource("brand")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  signatureSource === "brand"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Brand Signature
              </button>
            </div>

            <SignatureBuilder
              key={signatureSource === "brand" ? `brand-${selectedBrandId}` : "user"}
              brandId={signatureSource === "brand" ? (selectedBrandId || undefined) : undefined}
            />
          </div>
        )}

        {/* ════════════════ Step 6: Choose Template ════════════════ */}
        {active === 6 && (
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="text-sm text-muted-foreground">Choose how your outreach emails will look. Each template styles the body text, resource buttons, and signature differently while keeping your brand identity.</div>
            <div className="flex gap-6 flex-1 min-h-0">
              {/* Left Column: Template Cards + Color Picker */}
              <div className="w-[340px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">
                <label className="text-xs font-medium tracking-wide uppercase">Select a Template</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {OUTREACH_TEMPLATES.map((t) => {
                    const isSelected = selectedTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplate(t.id)}
                        className={`
                          relative text-left p-3 rounded-xl border-2 transition-all duration-200
                          hover:shadow-md hover:border-primary/40
                          ${isSelected
                            ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                            : 'border-border bg-card hover:bg-muted/30'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <h4 className={`font-bold text-xs ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {t.name}
                          </h4>
                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {t.description}
                          </p>
                          <div className="flex flex-wrap gap-0.5 pt-0.5">
                            {t.style.split(' • ').map((tag) => (
                              <span
                                key={tag}
                                className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${
                                  isSelected
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Theme Color Override */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="text-xs font-medium tracking-wide uppercase">Theme Colors</label>

                  {/* Accent / Secondary Button Color */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground w-14 shrink-0">Primary</span>
                      {["#F54029", "#2563eb", "#8b5cf6", "#ec4899", "#f97316"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setThemeColorOverride(themeColorOverride === c ? "" : c)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${themeColorOverride === c ? 'border-foreground scale-110 ring-2 ring-primary/30' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative w-5 h-5">
                        <input type="color" value={themeColorOverride || "#F54029"} onChange={(e) => setThemeColorOverride(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center hover:border-foreground transition-colors cursor-pointer">
                          <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                        </div>
                      </div>
                      {themeColorOverride && (
                        <>
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: themeColorOverride }} />
                          <span className="text-[10px] font-mono text-muted-foreground">{themeColorOverride}</span>
                          <button type="button" onClick={() => setThemeColorOverride("")} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Primary Button Color */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground w-14 shrink-0">Secondary</span>
                      {["#10b981", "#2563eb", "#8b5cf6", "#f59e0b", "#0ea5e9"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSecondaryColorOverride(secondaryColorOverride === c ? "" : c)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${secondaryColorOverride === c ? 'border-foreground scale-110 ring-2 ring-primary/30' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="relative w-5 h-5">
                        <input type="color" value={secondaryColorOverride || "#10b981"} onChange={(e) => setSecondaryColorOverride(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center hover:border-foreground transition-colors cursor-pointer">
                          <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                        </div>
                      </div>
                      {secondaryColorOverride && (
                        <>
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: secondaryColorOverride }} />
                          <span className="text-[10px] font-mono text-muted-foreground">{secondaryColorOverride}</span>
                          <button type="button" onClick={() => setSecondaryColorOverride("")} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Template Upgrades */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="text-xs font-medium tracking-wide uppercase">Template Upgrades</label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Background</label>
                      <select className="w-full text-xs p-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={bgTexture} onChange={e => setBgTexture(e.target.value)}>
                        <option value="none">None</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="lines">Lines</option><option value="noise">Noise</option><option value="diagonal">Diagonal</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Card Style</label>
                      <select className="w-full text-xs p-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={cardStyle} onChange={e => setCardStyle(e.target.value)}>
                        <option value="flat">Flat</option><option value="elevated">Elevated</option><option value="glass">Glass Effect</option><option value="bordered">Bordered</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Border Accent</label>
                      <select className="w-full text-xs p-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={borderAccent} onChange={e => setBorderAccent(e.target.value)}>
                        <option value="none">None</option><option value="top">Top Focus</option><option value="left">Left Border</option><option value="gradient-top">Gradient Top</option><option value="bottom-glow">Hover Glow</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">Dividers</label>
                      <select className="w-full text-xs p-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" value={dividerStyle} onChange={e => setDividerStyle(e.target.value)}>
                        <option value="none">None</option><option value="thin">Thin Line</option><option value="accent">Accent Line</option><option value="gradient">Gradient Glow</option><option value="dotted">Dots Array</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs mt-2 pt-2 cursor-pointer border-t border-border/50">
                    <Checkbox checked={showResources} onCheckedChange={(v) => setShowResources(!!v)} />
                    Show Resource Links Area
                  </label>
                </div>

                {/* Banner Image */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="text-xs font-medium tracking-wide uppercase">Banner Image</label>
                  <p className="text-[10px] text-muted-foreground -mt-1">Full-width cover image at the top of the email — like a social media banner.</p>
                  <div className="flex items-center gap-3">
                    <div className="relative w-32 h-14 rounded border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden group shrink-0">
                      {bannerImageUrl ? (
                        <img src={signedBannerUrl || bannerImageUrl} alt="Banner" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No banner</span>
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Upload className="w-4 h-4 text-white" />
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.error("Max file size is 2MB"); return; }
                          setUploadingBanner(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: formData });
                            const json = await res.json();
                            if (res.ok && json?.document?.document_file_url) {
                              setBannerImageUrl(json.document.document_file_url);
                              toast.success("Banner uploaded!");
                            } else { throw new Error(json?.error || "Upload failed"); }
                          } catch (err: any) { toast.error(err.message || "Upload failed"); }
                          finally { setUploadingBanner(false); }
                        }} disabled={uploadingBanner} />
                      </label>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={bannerImageUrl}
                        onChange={(e) => setBannerImageUrl(e.target.value)}
                        placeholder="https://... or upload"
                        className="w-full text-xs p-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {bannerImageUrl && (
                        <button type="button" onClick={() => setBannerImageUrl("")} className="text-[10px] text-destructive hover:underline">Remove banner</button>
                      )}
                    </div>
                  </div>
                  {bannerImageUrl && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-muted-foreground uppercase">Height</label>
                        <span className="text-[10px] font-mono text-primary">{bannerHeight}px</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="200"
                        step="5"
                        value={bannerHeight}
                        onChange={(e) => setBannerHeight(Number(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <label className="text-[10px] text-muted-foreground uppercase">Position</label>
                        <span className="text-[10px] font-mono text-primary">{bannerPositionY}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={bannerPositionY}
                        onChange={(e) => setBannerPositionY(Number(e.target.value))}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Top</span>
                        <span>Center</span>
                        <span>Bottom</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Preview (full height) */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <label className="text-xs font-medium tracking-wide uppercase">Live Preview</label>
                <div className="border border-border rounded-lg overflow-hidden bg-white flex-1 min-h-[780px]">
                  {loadingTemplatePreview ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering preview...
                    </div>
                  ) : templatePreviewHtml ? (
                    <iframe
                      srcDoc={templatePreviewHtml}
                      title="Template Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      Select a template to see a preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ Step 5: Resources ════════════════ */}
        {active === 5 && (
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="text-sm text-muted-foreground">Configure your outreach resource buttons. These appear at the bottom of every outreach email, giving recipients quick access to your key links.</div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium tracking-wide uppercase">Resource Buttons</label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  const newId = `res_${Date.now()}`;
                  setResources([...resources, { id: newId, label: "New Button", href: "https://", type: "secondary", enabled: true, icon: "none" }]);
                }}
              >
                <Plus className="w-3 h-3" /> Add Button
              </Button>
            </div>
            <div className="space-y-2">
              {resources.map((res: any, idx: number) => (
                <div key={res.id || idx} className={`flex items-center gap-2 border border-border rounded-md p-3 bg-background/60 ${!res.enabled ? 'opacity-50' : ''}`}>
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input
                      value={res.label}
                      onChange={(e) => {
                        const updated = [...resources];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setResources(updated);
                      }}
                      placeholder="Button label"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={res.href}
                      onChange={(e) => {
                        const updated = [...resources];
                        updated[idx] = { ...updated[idx], href: e.target.value };
                        setResources(updated);
                      }}
                      placeholder="https://..."
                      className="h-8 text-sm font-mono"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          // Toggle dropdown for this row
                          const el = document.getElementById(`icon-picker-${idx}`);
                          if (el) el.classList.toggle("hidden");
                        }}
                        className="h-8 text-xs rounded-md border border-border bg-background px-2 flex items-center gap-1.5 min-w-[120px] hover:bg-muted transition-colors"
                      >
                        {res.icon && res.icon !== "none" ? (
                          <>
                            <img src={resolveIconUrl(res.icon) || ""} alt="" className="w-3.5 h-3.5 theme-icon" />
                            <span className="truncate">{iconKeyToLabel(res.icon)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No icon</span>
                        )}
                      </button>
                      <div
                        id={`icon-picker-${idx}`}
                        className="hidden absolute top-9 left-0 z-50 w-[280px] max-h-[320px] overflow-y-auto rounded-lg border border-border bg-background shadow-xl p-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...resources];
                            updated[idx] = { ...updated[idx], icon: "none" };
                            setResources(updated);
                            document.getElementById(`icon-picker-${idx}`)?.classList.add("hidden");
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2 ${(!res.icon || res.icon === "none") ? 'bg-primary/10 text-primary' : ''}`}
                        >
                          <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">—</span>
                          No icon
                        </button>
                        {ICON_CATEGORIES.map((cat) => {
                          const visibleKeys = cat.keys.filter(k => getIconOptionsForTemplate(selectedTemplate).includes(k));
                          if (visibleKeys.length === 0) return null;
                          return (
                            <div key={cat.label}>
                              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold px-2 pt-2 pb-0.5">{cat.label}</div>
                              <div className="grid grid-cols-4 gap-0.5">
                                {visibleKeys.map((iconKey) => {
                                  const path = resolveIconUrl(iconKey);
                                  const isActive = res.icon === iconKey;
                                  return (
                                    <button
                                      key={iconKey}
                                      type="button"
                                      title={iconKeyToLabel(iconKey)}
                                      onClick={() => {
                                        const updated = [...resources];
                                        updated[idx] = { ...updated[idx], icon: iconKey };
                                        setResources(updated);
                                        document.getElementById(`icon-picker-${idx}`)?.classList.add("hidden");
                                      }}
                                      className={`flex flex-col items-center justify-center p-1.5 rounded hover:bg-muted transition-colors ${
                                        isActive ? 'bg-primary/10 ring-1 ring-primary' : ''
                                      }`}
                                    >
                                      {path && <img src={path} alt="" className="w-4 h-4 theme-icon" />}
                                      <span className="text-[8px] text-muted-foreground mt-0.5 truncate w-full text-center">{iconKeyToLabel(iconKey).split(' ')[0]}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={res.type === "primary" ? "default" : "secondary"}
                    className="h-8 text-[10px] px-2 shrink-0"
                    onClick={() => {
                      const updated = [...resources];
                      updated[idx] = { ...updated[idx], type: res.type === "primary" ? "secondary" : "primary" };
                      setResources(updated);
                    }}
                  >
                    {res.type === "primary" ? "Primary" : "Secondary"}
                  </Button>
                  <Checkbox
                    checked={res.enabled !== false}
                    onCheckedChange={(v) => {
                      const updated = [...resources];
                      updated[idx] = { ...updated[idx], enabled: !!v };
                      setResources(updated);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => setResources(resources.filter((_: any, i: number) => i !== idx))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {resources.length === 0 && (
                <p className="text-muted-foreground text-xs italic py-2">No resource buttons. Click "Add Button" to create one.</p>
              )}
            </div>
            {/* Template-Styled Preview */}
            {resources.filter((r: any) => r.enabled !== false).length > 0 && (() => {
              const styles = getTemplatePreviewStyles(selectedTemplate);
              const templateMeta = OUTREACH_TEMPLATES.find((t) => t.id === selectedTemplate);
              return (
                <div className="p-4 rounded-md border border-dashed border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preview — {templateMeta?.name || "Minimal"} Style</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{templateMeta?.style?.split(' • ')[0]}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-white border border-border">
                    <div className={styles.wrapper}>
                      {resources.filter((r: any) => r.enabled !== false).map((res: any) => {
                        const btnStyle = res.type === "primary" ? styles.primary : styles.secondary;
                        const isPrimary = res.type === "primary";
                        const themeHex = (themeColorOverride || (selectedBrand || brandInfo)?.primary_brand_color || "#7c3aed").replace("#", "");
                        const iconPath = res.icon && res.icon !== "none" ? resolveIconUrl(res.icon, "", isPrimary ? "ffffff" : themeHex) : null;
                        return (
                          <span key={res.id} style={btnStyle}>
                            {iconPath && (
                              <img
                                src={iconPath}
                                alt=""
                                style={{
                                  width: 14,
                                  height: 14,
                                  display: "inline-block",
                                  verticalAlign: "middle",
                                  marginRight: 6,
                                }}
                              />
                            )}
                            {res.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="flex gap-2">
              <Button size="sm" onClick={saveResources} disabled={savingResources}>
                {savingResources ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</> : "Save Resources"}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════ Step 7: Follow-Up Configuration ════════════════ */}
        {active === 7 && (
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">
              Configure automatic follow-ups for contacts who don&apos;t respond.
            </div>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div>
                <p className="text-sm font-medium">Enable Auto Follow-Ups</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically send follow-up emails to contacts who haven&apos;t replied
                </p>
              </div>
              <Checkbox
                checked={followupEnabled}
                onCheckedChange={(v) => setFollowupEnabled(!!v)}
              />
            </div>

            {followupEnabled && (
              <div className="space-y-4 pl-1">
                {/* Delay */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium">Days Before First Follow-Up</label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      className="mt-1"
                      value={followupDelayDays}
                      onChange={(e) => setFollowupDelayDays(Math.max(1, parseInt(e.target.value) || 3))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Wait this many days after sending before the first follow-up
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Maximum Follow-Ups</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="mt-1"
                      value={followupMaxCount}
                      onChange={(e) => setFollowupMaxCount(Math.max(1, parseInt(e.target.value) || 2))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Stop after this many follow-ups per contact
                    </p>
                  </div>
                </div>

                {/* Custom Follow-Up Prompt */}
                <div>
                  <label className="text-xs font-medium">Follow-Up Prompt (optional)</label>
                  <Textarea
                    className="mt-1"
                    rows={3}
                    value={followupPrompt}
                    onChange={(e) => setFollowupPrompt(e.target.value)}
                    placeholder="Leave empty to use the original campaign prompt with a follow-up context injection..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Customize how follow-up emails are generated. If empty, the AI will reference the original email.
                  </p>
                </div>

                {/* Summary */}
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  <span className="font-medium">Schedule:</span> Follow-ups will check <span className="font-semibold">every hour</span>, sending to contacts who haven&apos;t replied after{" "}
                  <span className="font-semibold">{followupDelayDays} day{followupDelayDays > 1 ? "s" : ""}</span>, up to{" "}
                  <span className="font-semibold">{followupMaxCount} time{followupMaxCount > 1 ? "s" : ""}</span> per contact.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ Step 8: Review & Send ════════════════ */}
        {active === 8 && (
          <div className="space-y-4">
            <div className="text-sm">Ready to send personalized outreach.</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-md bg-muted/30 border border-border">
                <div className="text-muted-foreground mb-1">Leads selected</div>
                <div className="text-lg font-bold">{leadIds.length}</div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 border border-border">
                <div className="text-muted-foreground mb-1">Channels</div>
                <div className="font-medium">{[useEmail && "Email", useSms && "SMS", useElevenLabs && "AI Voice"].filter(Boolean).join(", ") || "None"}</div>
              </div>
              {isMultiBrand && selectedBrand && (
                <div className="p-3 rounded-md bg-muted/30 border border-border col-span-2">
                  <div className="text-muted-foreground mb-1">Brand</div>
                  <div className="font-medium">{selectedBrand?.brand_label || selectedBrand?.company_name || "Default"}</div>
                </div>
              )}
            </div>

            {/* Sender Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide uppercase">Sending From</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSenderMode("company")}
                  className={`flex items-start gap-3 p-3 rounded-md border text-left transition-all ${
                    senderMode === "company"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background/60 hover:border-muted-foreground/40"
                  }`}
                >
                  <Building2 className={`w-5 h-5 mt-0.5 shrink-0 ${senderMode === "company" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-sm font-medium">Company Email</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {emailConfigs.find((c: any) => c.purpose === "OUTREACH" && c.verification_status === "VERIFIED")?.from_email
                        || emailConfigs.find((c: any) => c.purpose === "GENERAL" && c.verification_status === "VERIFIED")?.from_email
                        || "Team email config required"}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSenderMode("personal")}
                  className={`flex items-start gap-3 p-3 rounded-md border text-left transition-all ${
                    senderMode === "personal"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background/60 hover:border-muted-foreground/40"
                  }`}
                >
                  <User className={`w-5 h-5 mt-0.5 shrink-0 ${senderMode === "personal" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <div className="text-sm font-medium">Personal Email</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {session?.user?.email || "Your account email"}
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={testMode} onCheckedChange={(v) => setTestMode(!!v)} />
              Test mode (send to custom recipients instead of contacts)
            </label>
            {testMode && (
              <div className="space-y-2 pl-6 border-l-2 border-primary/30 ml-1">
                <label className="text-xs font-medium">Test Email Recipients</label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={testEmailRecipients}
                    onChange={(e) => setTestEmailRecipients(e.target.value)}
                    placeholder="email@example.com, another@example.com"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 text-xs h-9"
                    onClick={() => {
                      const myEmail = session?.user?.email || "";
                      if (!myEmail) { toast.error("No account email found"); return; }
                      const existing = testEmailRecipients.trim();
                      if (existing.includes(myEmail)) return;
                      setTestEmailRecipients(existing ? `${existing}, ${myEmail}` : myEmail);
                    }}
                  >
                    + Self
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Separate multiple emails with commas. Test emails will be sent to these addresses instead of the actual leads.</p>

                {/* Lead Reference Selector */}
                <div className="mt-3">
                  <label className="text-xs font-medium">Reference Lead</label>
                  <p className="text-[10px] text-muted-foreground mb-2">Select which lead to use as context for the AI-generated test email.</p>
                  <div className="max-h-[200px] overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {(leadData || []).filter((l: any) => l.email).length > 0 ? (leadData || []).filter((l: any) => l.email).slice(0, 50).map((lead: any) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setTestLeadId(lead.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                          testLeadId === lead.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {testLeadId === lead.id ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                        ) : (
                          <div className="w-4 h-4 shrink-0 rounded-full border border-muted-foreground/40" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {[lead.company, lead.email].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </button>
                    )) : (
                      // Fallback: show IDs if details not loaded
                      leadIds.slice(0, 20).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTestLeadId(id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                            testLeadId === id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          {testLeadId === id ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                          ) : (
                            <div className="w-4 h-4 shrink-0 rounded-full border border-muted-foreground/40" />
                          )}
                          <div className="text-xs font-mono truncate">{id}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        </div>{/* end scrollable wrapper */}

        <DialogFooter className="mt-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {active >= 2 && (
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={savingDraft} className="text-xs">
                {savingDraft ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FileTextIcon className="w-3 h-3 mr-1" />}
                Save Draft
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active > 1 && <Button variant="secondary" onClick={prev}>Back</Button>}
            {active < totalSteps && <Button onClick={next}>Next</Button>}
            {active === totalSteps && testMode && (
              <div className="flex items-center gap-3">
                {/* Test Send Progress Bar */}
                {testSending && (
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                        style={{ width: `${testProgress.total > 0 ? (testProgress.sent / testProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-amber-400 tabular-nums whitespace-nowrap">
                      {testProgress.sent}/{testProgress.total}
                    </span>
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={() => sendOutreach()}
                  disabled={!canSend || (testMode && !testEmailRecipients.trim()) || testSending}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                >
                  {testSending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending...</>
                  ) : "Send Test"}
                </Button>
              </div>
            )}
            {active === totalSteps && (
              <Button
                onClick={() => sendOutreach(false)}
                disabled={!canSend || launching}
                className={launching ? "bg-gradient-to-r from-emerald-600 to-teal-600 animate-pulse" : ""}
              >
                {launching ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching Campaign...</>
                ) : (
                  "Launch Campaign"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
