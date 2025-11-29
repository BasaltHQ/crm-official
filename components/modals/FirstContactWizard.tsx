"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";

// Simple stepper header
function StepHeader({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div>Step {step} / {total}</div>
      <div className="flex items-center gap-2">
        <span className="h-1 w-24 rounded bg-secondary overflow-hidden">
          <span className="block h-1 bg-primary" style={{ width: `${(step/total)*100}%` }} />
        </span>
      </div>
    </div>
  );
}

export type FirstContactWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[]; // selected leads from manager table
  initialPrompt?: string; // optional: prefill batch prompt (e.g., per-pool)
  poolId?: string; // optional: current pool context
};

export default function FirstContactWizard({ isOpen, onClose, leadIds, initialPrompt, poolId }: FirstContactWizardProps) {
  const [active, setActive] = useState(1);
  const totalSteps = 4;

  // Step 1: Channels selection
  const [useEmail, setUseEmail] = useState(true);
  const [usePhone, setUsePhone] = useState(false);
  const [useSms, setUseSms] = useState(false);

  // Step 2: AI prep
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [promptOverride, setPromptOverride] = useState("");
  const [meetingLinkOverride, setMeetingLinkOverride] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Step 3: Signature & resources
  const [signatureHtml, setSignatureHtml] = useState("");
  const [resources, setResources] = useState<any[]>([]);
  const [savingSignature, setSavingSignature] = useState(false);
  const [savingResources, setSavingResources] = useState(false);

  // Step 4: Review & Send
  const [testMode, setTestMode] = useState(false);
  const canSend = useMemo(() => {
    return isOpen && leadIds && leadIds.length > 0 && (useEmail || useSms || usePhone);
  }, [isOpen, leadIds, useEmail, useSms, usePhone]);

  useEffect(() => {
    if (!isOpen) return;
    // Load defaults once when opening
    (async () => {
      try {
        const p = await fetch("/api/profile/outreach-prompt");
        if (p.ok) {
          const j = await p.json();
          setDefaultPrompt(j?.promptText || "");
        }
      } catch {}
      try {
        const s = await fetch("/api/profile/signature");
        if (s.ok) {
          const j = await s.json();
          setSignatureHtml(j?.signature_html || "");
        }
      } catch {}
      try {
        const r = await fetch("/api/profile/resources");
        if (r.ok) {
          const j = await r.json();
          setResources(j?.resources || []);
        }
      } catch {}
    })();
    // Prefill per-pool prompt if provided
    if (initialPrompt && initialPrompt.trim().length) {
      setPromptOverride(initialPrompt);
    }
    setActive(1);
  }, [isOpen, initialPrompt]);

  function next() { setActive((a) => Math.min(totalSteps, a + 1)); }
  function prev() { setActive((a) => Math.max(1, a - 1)); }

  async function generateBatchPrompt() {
    try {
      setLoadingPrompt(true);
      // Reference vcrun.py persona and requirements, enriched with pool context
      const base = defaultPrompt?.trim().length ? defaultPrompt.trim() : `\nPersona:\nYou are Krishna Patel — Founder of The Utility Company (TUC) and creator of PortalPay. Write entirely in first person (I/me).\n\nGoal:\nCraft a personalized VC outreach email about PortalPay tailored to the recipients (batch).\n\nRequirements:\n- Return JSON with keys \"subject\" and \"body\".\n- Body plain text (no HTML), 250–300 words.\n- Narrative, insight-driven; no section headings.\n- End with confident CTA (remote meetings; Santa Fe based).\n`;
      const summary = `\nBatch Context:\n- Pool: ${poolId || "(n/a)"}\n- Leads selected: ${leadIds.length}\n- IDs: ${leadIds.slice(0, 12).join(", ")} ${leadIds.length>12?"…":""}\n- Use stored resources & signature; include tracking pixel.\n`;
      setPromptOverride([base, summary].join("\n"));
      toast.success("Batch prompt initialized. You can edit it before sending.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to build batch prompt");
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function saveSignature() {
    try {
      setSavingSignature(true);
      const res = await fetch("/api/profile/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureHtml, meta: { wizardSaved: true } })
      });
      if (res.ok) toast.success("Signature saved"); else toast.error(await res.text());
    } catch (e: any) {
      toast.error(e?.message || "Failed to save signature");
    } finally { setSavingSignature(false); }
  }

  async function saveResources() {
    try {
      setSavingResources(true);
      const res = await fetch("/api/profile/resources", {
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

  async function sendOutreach() {
    if (!canSend) {
      toast.error("Select at least one lead and channel (Email/SMS/Phone)");
      return;
    }
    try {
      const emailReq = useEmail ? fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds,
          test: testMode,
          promptOverride: promptOverride?.trim() || undefined,
          meetingLinkOverride: meetingLinkOverride?.trim() || undefined,
        })
      }) : null;

      const smsReq = useSms ? fetch("/api/outreach/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds,
          test: testMode,
          promptOverride: promptOverride?.trim() || undefined,
        })
      }) : null;

      // Initiate phone calls one-by-one (non-blocking). We do not auto-dial; calls are initiated via Amazon Connect.
      const phoneReqs: Promise<Response | null>[] = [];
      if (usePhone) {
        for (const id of leadIds) {
          phoneReqs.push(
            fetch("/api/outreach/call/initiate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ leadId: id })
            }).catch(() => null as any)
          );
        }
      }

      const responses = await Promise.all([
        emailReq,
        smsReq,
        ...(phoneReqs.length ? phoneReqs : [])
      ].filter(Boolean) as Promise<Response>[]);

      const payloads = await Promise.all(responses.map((r) => r.json().catch(() => null)));

      const emailSummary = responses[0] && useEmail ? `Email sent=${payloads[0]?.sent ?? 0}, skipped=${payloads[0]?.skipped ?? 0}, errors=${payloads[0]?.errors ?? 0}` : null;
      const smsIdx = useEmail ? 1 : 0;
      const smsSummary = responses[smsIdx] && useSms ? `SMS sent=${payloads[smsIdx]?.sent ?? 0}, skipped=${payloads[smsIdx]?.skipped ?? 0}, errors=${payloads[smsIdx]?.errors ?? 0}` : null;

      const phoneStartIdx = (useEmail ? 1 : 0) + (useSms ? 1 : 0);
      let callsInitiated = 0;
      let callsErrors = 0;
      if (usePhone) {
        for (let i = phoneStartIdx; i < responses.length; i++) {
          const res = responses[i];
          if (res && res.ok) callsInitiated += 1; else callsErrors += 1;
        }
      }
      const phoneSummary = usePhone ? `Calls initiated=${callsInitiated}${callsErrors ? ", errors=" + callsErrors : ""}` : null;

      const okAll = responses.every((r) => r && r.ok);
      if (okAll || (emailSummary || smsSummary || phoneSummary)) {
        toast.success([emailSummary, smsSummary, phoneSummary].filter(Boolean).join("; "));
        onClose();
      } else {
        const firstError = responses.find((r) => !r || !r.ok);
        const idx = firstError ? responses.indexOf(firstError) : -1;
        const errPayload = idx >= 0 ? payloads[idx] : null;
        toast.error(typeof errPayload === "string" ? errPayload : (errPayload?.message || "Failed to send"));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send outreach");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Initiate First Contact</DialogTitle>
          <StepHeader step={active} total={totalSteps} />
        </DialogHeader>

        {active === 1 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Select channels to use for this batch. Email and SMS send immediately; Phone is ready to initiate from the Leads Workspace and will not auto-dial.</div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2"><Checkbox checked={useEmail} onCheckedChange={(v) => setUseEmail(!!v)} /> Email</label>
              <label className="flex items-center gap-2"><Checkbox checked={usePhone} onCheckedChange={(v) => setUsePhone(!!v)} /> Phone <span className="ml-2 text-[10px]">calls will be initiated</span></label>
              <label className="flex items-center gap-2"><Checkbox checked={useSms} onCheckedChange={(v) => setUseSms(!!v)} /> SMS</label>
            </div>
          </div>
        )}

        {active === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Initialize AI to prepare a batch prompt. Start from your saved default and enrich with the selected leads/project context.</div>
            <div>
              <label className="text-xs font-medium">Default Prompt</label>
              <Textarea className="mt-1" rows={6} value={defaultPrompt} onChange={(e) => setDefaultPrompt(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={generateBatchPrompt} disabled={loadingPrompt}>Generate Batch Prompt</Button>
              <span className="text-xs text-muted-foreground">We will compose a simple batch prompt referencing your selection.</span>
            </div>
            <div>
              <label className="text-xs font-medium">Batch Prompt Override</label>
              <Textarea className="mt-1" rows={8} value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} placeholder="Optional: override prompt used when generating emails for this batch" />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => savePoolPrompt()} disabled={!poolId || !(promptOverride?.trim()?.length)}>
                  Save as Pool Prompt
                </Button>
                <span className="text-[11px] text-muted-foreground">Saves this override as the pool-level AI prompt/strategy.</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Meeting Link Override</label>
              <Input className="mt-1" value={meetingLinkOverride} onChange={(e) => setMeetingLinkOverride(e.target.value)} placeholder="Optional: e.g., https://calendar.link/..." />
            </div>
          </div>
        )}

        {active === 3 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Select your signature and resource buttons to include. Saving updates your profile settings.</div>
            <div>
              <label className="text-xs font-medium">Signature HTML</label>
              <Textarea className="mt-1" rows={6} value={signatureHtml} onChange={(e) => setSignatureHtml(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={saveSignature} disabled={savingSignature}>Save Signature</Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Resources JSON</label>
              <Textarea className="mt-1" rows={6} value={JSON.stringify(resources, null, 2)} onChange={(e) => {
                try { setResources(JSON.parse(e.target.value)); } catch {}
              }} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={saveResources} disabled={savingResources}>Save Resources</Button>
              </div>
            </div>
          </div>
        )}

        {active === 4 && (
          <div className="space-y-4">
            <div className="text-sm">Ready to send personalized emails.</div>
            <div className="text-xs text-muted-foreground">Leads selected: {leadIds.length}</div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={testMode} onCheckedChange={(v) => setTestMode(!!v)} /> Test mode (send to founders@theutilitycompany.co)</label>
            <div>
              <label className="text-xs font-medium">Batch Prompt Override</label>
              <Textarea className="mt-1" rows={6} value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Meeting Link Override</label>
              <Input className="mt-1" value={meetingLinkOverride} onChange={(e) => setMeetingLinkOverride(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
          <div className="flex items-center gap-2">
            {active > 1 && <Button variant="secondary" onClick={prev}>Back</Button>}
            {active < totalSteps && <Button onClick={next}>Next</Button>}
            {active === totalSteps && <Button onClick={sendOutreach} disabled={!canSend}>Send</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
