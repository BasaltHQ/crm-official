"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Building2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Layers,
  FileText,
  RefreshCcw,
  X,
  ChevronRight,
  Database,
  ArrowUpRight,
  Sparkles,
  Link2,
  Shield,
  Zap,
  ChevronDown,
  UserCircle,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PoolSummary = {
  id: string;
  name: string;
  description?: string;
};

type DetectedMapping = {
  csvHeader: string;
  crmField: string | null;
  crmFieldLabel: string | null;
  fieldGroup: "account" | "contact" | null;
  confidence: number;
  sampleValues: string[];
};

type CrmFieldDef = {
  key: string;
  label: string;
  required?: boolean;
};

type ScanResponse = {
  headers: string[];
  mappings: DetectedMapping[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  crmFields: {
    account: CrmFieldDef[];
    contact: CrmFieldDef[];
  };
};

type PreviewStats = {
  totalRows: number;
  validCandidates: number;
  validContacts: number;
  corruptRows: number;
  duplicates: { candidate: number; contact: number };
  creates: { candidate: number; contact: number };
  updates: { candidate: number; contact: number };
};

type PreviewResponse = {
  poolId: string | null;
  poolName?: string;
  poolMode: "new" | "existing";
  mapping?: { usedColumns?: string[]; unmappedColumns?: string[] };
  stats: PreviewStats;
  creates: { candidates: any[]; contacts: any[] };
  updates: { candidates: any[]; contacts: any[] };
  corruptRows: { index: number; errors: string[] }[];
  preview?: any[];
  fullPreview?: any[];
};

type CommitResponse = {
  created: { candidates: number; contacts: number };
  updated: { candidates: number; contacts: number };
};

type WizardStep = "destination" | "upload" | "mapping" | "preview" | "complete";

type Props = {
  pools: PoolSummary[];
  onCommitted?: () => void;
  controlledOpen?: boolean;
  setControlledOpen?: (open: boolean) => void;
  preselectedFile?: File | null;
  customTrigger?: React.ReactNode;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportLeadsDialog({ pools, onCommitted, controlledOpen, setControlledOpen, preselectedFile, customTrigger }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  
  const handleOpenChange = (v: boolean) => {
    if (setControlledOpen) setControlledOpen(v);
    else setInternalOpen(v);
    
    if (v && preselectedFile) {
        setFile(preselectedFile);
        if (pools.length > 0) {
            setStep("upload");
        }
    }
  };

  const [step, setStep] = useState<WizardStep>("destination");

  // Step 1: Destination
  const [poolId, setPoolId] = useState<string>(pools[0]?.id ?? "");
  const [createNewPool, setCreateNewPool] = useState<boolean>(true);
  const [newPoolName, setNewPoolName] = useState<string>("");
  const [newPoolDescription, setNewPoolDescription] = useState<string>("");

  // Step 2: Upload
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preselected file
  useEffect(() => {
      if (preselectedFile && open) {
          setFile(preselectedFile);
          if (step === "destination" && poolId) {
             // Don't auto advance past destination, user must pick pool
          }
      }
  }, [preselectedFile, open]);

  // Step 3: Mapping
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [mappings, setMappings] = useState<DetectedMapping[]>([]);

  // Step 4: Preview
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  // Step 5: Complete
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  // Shared
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optInWarningAccepted, setOptInWarningAccepted] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const accountMappings = useMemo(() => mappings.filter(m => m.fieldGroup === "account"), [mappings]);
  const contactMappings = useMemo(() => mappings.filter(m => m.fieldGroup === "contact"), [mappings]);
  const unmappedColumns = useMemo(() => mappings.filter(m => !m.crmField), [mappings]);
  const mappedCount = useMemo(() => mappings.filter(m => m.crmField).length, [mappings]);
  const hasContactFields = useMemo(() => contactMappings.length > 0, [contactMappings]);
  
  const hasEmailMapped = useMemo(() => mappings.some(m => m.crmField === "email"), [mappings]);
  const hasOptInMapped = useMemo(() => mappings.some(m => m.crmField === "optInBoolean"), [mappings]);
  const showOptInWarning = hasEmailMapped && !hasOptInMapped;
  const canProceedToPreview = mappedCount > 0 && (!showOptInWarning || optInWarningAccepted);

  const confidenceColor = (c: number) => {
    if (c >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (c >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  // ─── Actions ─────────────────────────────────────────────────────────────

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setScanData(null);
    setMappings([]);
    setPreview(null);
    setCommitResult(null);
    setError(null);
  };

  const scanFile = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/crm/leads/pools/import/scan", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ScanResponse;
      setScanData(data);
      setMappings(data.mappings);
      setStep("mapping");
    } catch (e: any) {
      setError(e?.message || "Failed to scan file");
    } finally {
      setSubmitting(false);
    }
  };

  const updateMapping = (csvHeader: string, newCrmField: string | null) => {
    setMappings(prev => prev.map(m => {
      if (m.csvHeader !== csvHeader) return m;

      if (!newCrmField) {
        return { ...m, crmField: null, crmFieldLabel: null, fieldGroup: null, confidence: 0 };
      }

      // Determine the group and label
      const allFields = [...(scanData?.crmFields.account || []), ...(scanData?.crmFields.contact || [])];
      const field = allFields.find(f => f.key === newCrmField);
      const group = scanData?.crmFields.account.some(f => f.key === newCrmField) ? "account" as const :
                    scanData?.crmFields.contact.some(f => f.key === newCrmField) ? "contact" as const : null;

      return {
        ...m,
        crmField: newCrmField,
        crmFieldLabel: field?.label || newCrmField,
        fieldGroup: group,
        confidence: 100, // Manual override = 100% confidence
      };
    }));
  };

  const runPreview = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      // Build the column mapping object
      const columnMap: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.crmField) columnMap[m.csvHeader] = m.crmField;
      });

      const form = new FormData();
      form.append("file", file);
      form.append("columnMap", JSON.stringify(columnMap));
      if (createNewPool) {
        form.append("newPoolName", newPoolName);
        if (newPoolDescription.trim()) form.append("newPoolDescription", newPoolDescription);
      } else {
        form.append("poolId", poolId);
      }

      const res = await fetch("/api/crm/leads/pools/import/preview", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      setStep("preview");
    } catch (e: any) {
      setError(e?.message || "Failed to preview import");
    } finally {
      setSubmitting(false);
    }
  };

  const commitImport = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError(null);

    const allCreateCandidates = preview.creates?.candidates || [];
    const allCreateContacts = preview.creates?.contacts || [];
    const allUpdateCandidates = preview.updates?.candidates || [];
    const allUpdateContacts = preview.updates?.contacts || [];

    const BATCH_SIZE = 200;

    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    const ccChunks = chunk(allCreateCandidates, BATCH_SIZE);
    const ctChunks = chunk(allCreateContacts, BATCH_SIZE);
    const ucChunks = chunk(allUpdateCandidates, BATCH_SIZE);
    const utChunks = chunk(allUpdateContacts, BATCH_SIZE);

    const maxChunks = Math.max(ccChunks.length, ctChunks.length, ucChunks.length, utChunks.length, 1);
    let resolvedPoolId = preview.poolId ?? undefined;
    let lastResult: CommitResponse | null = null;

    try {
      for (let i = 0; i < maxChunks; i++) {
        const payload: any = {
          creates: { candidates: ccChunks[i] || [], contacts: ctChunks[i] || [] },
          updates: { candidates: ucChunks[i] || [], contacts: utChunks[i] || [] },
        };

        if (i === 0) {
          if (resolvedPoolId) {
            payload.poolId = resolvedPoolId;
          } else {
            payload.poolName = preview.poolMode === "new" ? (preview.poolName || newPoolName) : undefined;
            payload.poolDescription = preview.poolMode === "new" ? (newPoolDescription || undefined) : undefined;
          }
        } else {
          payload.poolId = resolvedPoolId;
        }

        const res = await fetch("/api/crm/leads/pools/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          let errorMsg = `Batch ${i + 1}/${maxChunks} failed (HTTP ${res.status})`;
          if (contentType.includes("application/json")) {
            try { errorMsg = (await res.json()).message || errorMsg; } catch {}
          } else {
            const text = await res.text();
            if (text.includes("Gateway time-out") || text.includes("504")) {
              errorMsg = `Server timeout on batch ${i + 1}/${maxChunks}. Try again — already committed records are saved.`;
            }
          }
          throw new Error(errorMsg);
        }

        const result = await res.json();
        lastResult = result;
        if (result.poolId) resolvedPoolId = result.poolId;
      }

      setCommitResult(lastResult as CommitResponse);
      setStep("complete");
      if (onCommitted) onCommitted();
    } catch (e: any) {
      setError(e?.message || "Failed to commit import");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setScanData(null);
    setMappings([]);
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setOptInWarningAccepted(false);
    setStep("destination");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeDialog = () => {
    if (setControlledOpen) setControlledOpen(false);
    else setInternalOpen(false);
    setTimeout(reset, 300);
  };

  // ─── Step Indicators ─────────────────────────────────────────────────────

  const STEPS: { key: WizardStep; label: string; icon: any }[] = [
    { key: "destination", label: "Destination", icon: Database },
    { key: "upload", label: "Upload", icon: FileUp },
    { key: "mapping", label: "Map Fields", icon: Link2 },
    { key: "preview", label: "Review", icon: Shield },
  ];

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((s, i) => {
        const isActive = i === stepIndex;
        const isComplete = i < stepIndex || step === "complete";
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
              isActive && "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/10",
              isComplete && !isActive && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
              !isActive && !isComplete && "bg-zinc-900 text-zinc-600 border border-zinc-800"
            )}>
              {isComplete && !isActive ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <s.icon className="w-3 h-3" />
              )}
              <span className="hidden md:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={cn("w-3 h-3 mx-0.5", isComplete ? "text-emerald-500/50" : "text-zinc-800")} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Step 1: Destination ─────────────────────────────────────────────────

  const renderDestination = () => (
    <motion.div
      key="step-destination"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-1">Where should we store this data?</h3>
        <p className="text-zinc-500 text-sm">Choose an existing list or create a new intelligence pipeline.</p>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
          <div className="flex items-center gap-3">
            <Plus className={cn("w-4 h-4 transition-colors", createNewPool ? "text-indigo-400" : "text-zinc-600")} />
            <label htmlFor="createNewPool" className="text-sm font-medium text-zinc-300 cursor-pointer">Create a new list</label>
          </div>
          <Switch
            id="createNewPool"
            checked={createNewPool}
            onCheckedChange={setCreateNewPool}
            className="data-[state=checked]:bg-indigo-600"
          />
        </div>

        <AnimatePresence mode="wait">
          {createNewPool ? (
            <motion.div
              key="new-pool"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-1.5 block">List Name *</label>
                <input
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-colors placeholder:text-zinc-700"
                  placeholder="e.g. Q1 SaaS Growth Targets"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-1.5 block">Description</label>
                <textarea
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-colors resize-none h-20 placeholder:text-zinc-700"
                  placeholder="Internal context and notes for your team..."
                  value={newPoolDescription}
                  onChange={(e) => setNewPoolDescription(e.target.value)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="existing-pool"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <select
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-zinc-300 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-colors appearance-none cursor-pointer"
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
              >
                <option value="" disabled>Select target list...</option>
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {pools.length === 0 && (
                <p className="text-[10px] text-amber-500/80 mt-2 flex items-center gap-1 italic">
                  <AlertTriangle className="w-3 h-3" /> No existing lists found. Toggle "Create a new list" above.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => setStep("upload")}
          disabled={createNewPool ? !newPoolName.trim() : !poolId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-xl shadow-indigo-600/20 group disabled:opacity-50"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </motion.div>
  );

  // ─── Step 2: Upload ──────────────────────────────────────────────────────

  const renderUpload = () => (
    <motion.div
      key="step-upload"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-1">Upload Your Source Data</h3>
        <p className="text-zinc-500 text-sm">CSV or Excel files supported. Our AI will auto-detect your columns.</p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group relative rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-12 cursor-pointer overflow-hidden",
          file
            ? "bg-emerald-500/5 border-emerald-500/30"
            : "bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-900/80"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,.xlsx"
          className="hidden"
          onChange={onFileChange}
        />

        {file ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-3"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-400 font-bold text-lg">{file.name}</p>
              <p className="text-zinc-600 text-xs font-medium">{(file.size / 1024).toFixed(1)} KB · Ready for intelligent scan</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-zinc-500 h-6 hover:text-red-400 hover:bg-red-500/5"
              onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            >
              Replace File
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <FileText className="w-14 h-14 text-zinc-600 mb-4 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300" />
            <p className="text-zinc-400 font-medium text-center text-lg">
              Drop your <span className="text-white font-bold">CSV</span> or <span className="text-white font-bold">Excel</span> file here
            </p>
            <p className="text-zinc-600 text-xs mt-2">or click to browse</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={() => setStep("destination")} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button
          onClick={scanFile}
          disabled={submitting || !file}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-xl shadow-indigo-600/20 group disabled:opacity-50"
        >
          {submitting ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning Columns...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Detect Fields
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Button>
      </div>
    </motion.div>
  );

  // ─── Step 3: Field Mapping ───────────────────────────────────────────────

  const allCrmOptions = useMemo(() => {
    if (!scanData) return [];
    return [
      { group: "Account Fields", options: scanData.crmFields.account },
      { group: "Contact Fields", options: scanData.crmFields.contact },
    ];
  }, [scanData]);

  const renderMapping = () => (
    <motion.div
      key="step-mapping"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Confirm Column Mapping</h3>
        <p className="text-zinc-500 text-sm">
          We detected <span className="text-indigo-400 font-bold">{scanData?.totalRows || 0}</span> rows and auto-mapped <span className="text-emerald-400 font-bold">{mappedCount}</span> of <span className="text-white font-bold">{mappings.length}</span> columns. Review and adjust below.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <Building2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-emerald-400">{accountMappings.length}</p>
          <p className="text-[9px] uppercase tracking-widest text-emerald-500/60 font-bold">Account Fields</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 text-center">
          <UserCircle className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-blue-400">{contactMappings.length}</p>
          <p className="text-[9px] uppercase tracking-widest text-blue-500/60 font-bold">Contact Fields</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-4 text-center">
          <X className="w-5 h-5 text-zinc-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-zinc-400">{unmappedColumns.length}</p>
          <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Unmapped</p>
        </div>
      </div>

      {!hasContactFields && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 text-xs font-bold">Account-Only Import Detected</p>
            <p className="text-amber-500/70 text-[10px]">No human contact fields were found. This import will create account records only (organizations without named individuals).</p>
          </div>
        </div>
      )}

      {/* Mapping Table */}
      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-10">
              <tr>
                <th className="p-3 text-left font-bold text-zinc-400 w-[30%]">CSV Column</th>
                <th className="p-3 text-left font-bold text-zinc-400 w-[25%]">Mapped To</th>
                <th className="p-3 text-left font-bold text-zinc-400 w-[10%]">Type</th>
                <th className="p-3 text-left font-bold text-zinc-400 w-[10%]">Confidence</th>
                <th className="p-3 text-left font-bold text-zinc-400 w-[25%]">Sample</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {mappings.map((m) => (
                <tr key={m.csvHeader} className="hover:bg-zinc-800/20 transition-colors group">
                  <td className="p-3">
                    <span className="font-mono text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                      {m.csvHeader}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-zinc-300 text-[11px] focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-colors appearance-none cursor-pointer"
                      value={m.crmField || ""}
                      onChange={(e) => updateMapping(m.csvHeader, e.target.value || null)}
                    >
                      <option value="">— Skip —</option>
                      {allCrmOptions.map(group => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? " *" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    {m.fieldGroup === "account" && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Org</span>
                    )}
                    {m.fieldGroup === "contact" && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Human</span>
                    )}
                    {!m.fieldGroup && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {m.crmField ? (
                      <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", confidenceColor(m.confidence))}>
                        {m.confidence}%
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-[9px]">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {m.sampleValues.slice(0, 2).map((v, i) => (
                        <span key={i} className="text-[10px] text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 truncate max-w-[100px]">
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {showOptInWarning && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mt-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <h4 className="text-amber-500 font-bold text-sm">Compliance Warning: Missing Opt-In Data</h4>
            <p className="text-amber-500/80 text-xs leading-relaxed">
              You are importing email addresses, but no column is mapped to the <strong className="text-amber-400">Opt-In Confirmation</strong> field. 
              To comply with Amazon SES and anti-spam regulations (like GDPR/CAN-SPAM), you should include double opt-in verification data (opt-in boolean, IP, and timestamp).
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Switch 
                checked={optInWarningAccepted} 
                onCheckedChange={setOptInWarningAccepted}
                className="data-[state=checked]:bg-amber-500"
              />
              <span className="text-xs font-medium text-amber-500/90 cursor-pointer" onClick={() => setOptInWarningAccepted(!optInWarningAccepted)}>
                I understand. Proceed at my own risk (emails will be blocked for these leads unless the opt-in process is completed).
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={() => setStep("upload")} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button
          onClick={runPreview}
          disabled={submitting || !canProceedToPreview}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold shadow-xl shadow-indigo-600/20 group disabled:opacity-50"
        >
          {submitting ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing Intelligence...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Process & Review
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Button>
      </div>
    </motion.div>
  );

  // ─── Step 4: Preview & Commit ────────────────────────────────────────────

  const renderPreview = () => (
    <motion.div
      key="step-preview"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Intelligence Report</h3>
        <p className="text-zinc-500 text-sm">Review the processed data before committing to your pipeline.</p>
      </div>

      {preview && (
        <>
          {/* Bento Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-1 group hover:border-indigo-500/30 transition-colors">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Total Rows</p>
              <p className="text-3xl font-extrabold text-white leading-none">{preview.stats.totalRows}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-1 group hover:border-emerald-500/30 transition-colors">
              <Building2 className="w-3.5 h-3.5 text-emerald-400 mb-1" />
              <p className="text-3xl font-extrabold text-emerald-400 leading-none">{preview.stats.validCandidates}</p>
              <p className="text-[9px] text-zinc-600 font-bold">Organizations</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-1 group hover:border-blue-500/30 transition-colors">
              <Users className="w-3.5 h-3.5 text-blue-400 mb-1" />
              <p className="text-3xl font-extrabold text-blue-400 leading-none">{preview.stats.validContacts}</p>
              <p className="text-[9px] text-zinc-600 font-bold">Contacts</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-1 group hover:border-amber-500/30 transition-colors">
              <p className="text-3xl font-extrabold text-amber-500 leading-none">{preview.stats.corruptRows}</p>
              <p className="text-[9px] text-zinc-600 font-bold">Anomalies</p>
            </div>
          </div>

          {/* Action Log */}
          <div className="p-4 rounded-2xl bg-indigo-600/5 border border-indigo-500/20 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <span className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-tighter block mb-0.5">New Records</span>
              <div className="flex gap-3">
                <span className="text-xs text-zinc-400"><span className="text-emerald-400 font-bold">+{preview.stats.creates.candidate}</span> Accounts</span>
                <span className="text-xs text-zinc-400"><span className="text-blue-400 font-bold">+{preview.stats.creates.contact}</span> Contacts</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-tighter block mb-0.5">Updates</span>
              <div className="flex gap-3">
                <span className="text-xs text-zinc-400"><span className="text-amber-400 font-bold">{preview.stats.updates.candidate}</span> Accounts</span>
                <span className="text-xs text-zinc-400"><span className="text-amber-400 font-bold">{preview.stats.updates.contact}</span> Contacts</span>
              </div>
            </div>
          </div>

          {/* Data Preview Table */}
          {preview.preview && preview.preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">Sample Preview</p>
              <div className="border border-zinc-800 rounded-2xl overflow-hidden text-xs bg-zinc-900/30">
                <table className="w-full">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800">
                    <tr>
                      <th className="p-3 text-left font-bold text-zinc-400">Account</th>
                      <th className="p-3 text-left font-bold text-zinc-400">Contact</th>
                      <th className="p-3 text-left font-bold text-zinc-400">Email</th>
                      <th className="p-3 text-left font-bold text-zinc-400">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {preview.preview.slice(0, 5).map((r: any, i: number) => {
                      const accName = r.account?.companyName || r.account?.name || "—";
                      const contacts = r.contacts || [];
                      const firstContact = contacts[0] || {};
                      const contactName = firstContact.fullName || "—";
                      const emails = contacts.map((c: any) => c.email).filter(Boolean);
                      const phones = contacts.map((c: any) => c.phone).filter(Boolean);
                      return (
                        <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-3 text-zinc-300 font-medium">{accName}</td>
                          <td className="p-3 text-zinc-400">{contactName}</td>
                          <td className="p-3 text-zinc-400">
                            {emails.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[140px]">{emails[0]}</span>
                                {emails.length > 1 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    +{emails.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-zinc-500 font-mono text-[10px]">{phones[0] || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={() => setStep("mapping")} disabled={submitting} className="text-zinc-500 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> Adjust Mapping
        </Button>
        <Button
          onClick={commitImport}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 h-12 rounded-xl font-bold shadow-xl shadow-emerald-600/20 group disabled:opacity-50"
        >
          {submitting ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Committing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              Commit to Pipeline
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          )}
        </Button>
      </div>
    </motion.div>
  );

  // ─── Step 5: Complete ────────────────────────────────────────────────────

  const renderComplete = () => (
    <motion.div
      key="step-complete"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-12 space-y-8 text-center"
    >
      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <div className="relative z-10 w-24 h-24 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
          Import Complete
        </h3>
        <p className="text-zinc-500 max-w-md mx-auto">Your intelligence dataset has been committed to the pipeline.</p>
      </div>

      {commitResult && (
        <div className="flex justify-center gap-8 max-w-sm mx-auto">
          <div className="text-center">
            <p className="text-2xl font-black text-white">{commitResult.created.candidates + commitResult.created.contacts}</p>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Created</p>
          </div>
          <div className="w-px h-8 bg-zinc-800 self-center" />
          <div className="text-center">
            <p className="text-2xl font-black text-white">{commitResult.updated.candidates + commitResult.updated.contacts}</p>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Enriched</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 pt-4">
        <Button variant="outline" onClick={reset} className="border-zinc-800 text-zinc-400 hover:text-white rounded-xl h-12 px-8">
          Start Another Import
        </Button>
        <Button onClick={closeDialog} className="bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl h-12 px-10 font-black">
          FINISH
        </Button>
      </div>
    </motion.div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const closeDialogWithProps = () => {
    if (setControlledOpen) setControlledOpen(false);
    else setInternalOpen(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {customTrigger ? (
          <DialogTrigger asChild>
            {customTrigger}
          </DialogTrigger>
      ) : (
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 group transition-all duration-300 transform hover:scale-[1.02]">
              <FileUp className="w-4 h-4 mr-2 group-hover:animate-bounce" />
              Import Intelligence
            </Button>
          </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl bg-zinc-950/95 backdrop-blur-xl border-zinc-800 shadow-2xl overflow-hidden p-0 gap-0 rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />

        <div className="p-8 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                  Import Intelligence
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-sm mt-0.5">AI-powered field detection, normalization, and pipeline syndication.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {step !== "complete" && renderStepIndicator()}

          <AnimatePresence mode="wait">
            {step === "destination" && renderDestination()}
            {step === "upload" && renderUpload()}
            {step === "mapping" && renderMapping()}
            {step === "preview" && renderPreview()}
            {step === "complete" && renderComplete()}
          </AnimatePresence>
        </div>

        <div className="bg-zinc-900/40 p-3 flex justify-center border-t border-zinc-800/50">
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em] flex items-center gap-2 italic">
            <Layers className="w-3 h-3" /> Basalt CRM Intelligence Core v3.0
            <span className="w-1 h-3 bg-zinc-800" />
            Status: <span className="text-emerald-500/60">Operational</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
