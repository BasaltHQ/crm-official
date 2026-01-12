"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CustomCCP from "@/components/voice/CustomCCP";

/**
 * AzureSalesAgentPanel (Prompt Generator)
 * Simplified panel to craft a voice agent prompt that you can feed to your external
 * Azure OpenAI Realtime app. No WebRTC, no gateway calls.
 *
 * Features:
 * - Editable prompt textarea with a sensible default template
 * - Generate-from-lead helper to prefill context
 * - Copy to clipboard
 * - Emit a window event ("agent-prompt-generated") for integrations
 * - Optionally save the prompt to CRM notes for the lead
 */
export default function AzureSalesAgentPanel({ leadId, contactId }: { leadId?: string; contactId?: string }) {
  const [prompt, setPrompt] = useState<string>(`
You are a senior SDR on a live sales call for BasaltCRM.
- Keep conversations concise and persuasive.
- Follow discovery: intro, needs, value mapping, objections, next steps.
- Ask for the meeting or next step explicitly.
- Speak in English; keep responses under 10 seconds each.
`);
  const [copied, setCopied] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Power Prompt generator settings
  const [roleKey, setRoleKey] = useState<"sales_agent" | "solutions_architect" | "account_manager" | "support_specialist" | "custom">("sales_agent");
  const [customRoleName, setCustomRoleName] = useState<string>("");
  const [roleNotes, setRoleNotes] = useState<string>("");
  const [language, setLanguage] = useState<string>("English");
  const [generating, setGenerating] = useState<boolean>(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e: any) {
      setError(e?.message || "Failed to copy");
      setTimeout(() => setError(null), 2000);
    }
  }

  function emitPromptEvent() {
    try {
      const evt = new CustomEvent("agent-prompt-generated", { detail: { prompt, leadId, contactId } } as any);
      window.dispatchEvent(evt);
    } catch (e: any) {
      setError(e?.message || "Failed to emit prompt event");
      setTimeout(() => setError(null), 2000);
    }
  }

  async function savePromptAsNote() {
    if (!leadId) { setError("No leadId to save note"); setTimeout(() => setError(null), 2000); return; }
    try {
      setSaving(true);
      const mentions = Array.from(prompt.matchAll(/@([\w.-]{2,64})/g)).map((m) => m[1]);
      const res = await fetch(`/api/leads/notes/${encodeURIComponent(leadId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, mentions })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e: any) {
      setError(e?.message || "Failed to save note");
      setTimeout(() => setError(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function generateFromLead() {
    try {
      // Lightweight prefill using known IDs; in future, fetch more context (company, last activity, etc.)
      const base = `You are a BasaltCRM voice agent.`;
      const leadLine = leadId ? ` Focus on lead ${leadId}.` : ``;
      const contactLine = contactId ? ` Contact reference: ${contactId}.` : ``;
      const guidance = ` Keep responses concise (<=10s). Ask open questions, confirm understanding, propose next step.`;
      setPrompt(`${base}${leadLine}${contactLine}\n- Intro politely; confirm name and role.\n- Explore needs; map value to pain points.\n- Handle objections briefly; offer options.\n- Close with clear next step (date/time).` + guidance);
    } catch { }
  }

  // Powerhouse Prompt (Azure OpenAI + auto context from Lead/Project/Activities)
  async function generatePowerPrompt() {
    if (!leadId) { setError("No leadId for context"); setTimeout(() => setError(null), 2500); return; }
    try {
      setGenerating(true);
      const res = await fetch("/api/crm/prompt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          roleKey,
          customRoleName,
          roleNotes,
          language,
          flow: "Engage_AI"
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "error");
        throw new Error(txt || `Prompt generation failed (${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      const text = String((data as any)?.prompt || "");
      if (!text) throw new Error("Empty prompt returned from generator");
      setPrompt(text);
    } catch (e: any) {
      setError(e?.message || "Failed to generate prompt");
      setTimeout(() => setError(null), 3000);
    } finally {
      setGenerating(false);
    }
  }

  // VoiceHub connection status for Engage AI panel
  const [connLoading, setConnLoading] = useState<boolean>(false);
  const [voicehubConnected, setVoicehubConnected] = useState<boolean>(false);
  const [voicehubWallet, setVoicehubWallet] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        setConnLoading(true);
        const res = await fetch("/api/integration/status");
        const j: any = await res.json().catch(() => ({}));
        if (!cancelled) {
          setVoicehubConnected(!!j?.voicehub_connected);
          setVoicehubWallet((j?.voicehub_wallet || null) as any);
        }
      } catch {
      } finally {
        if (!cancelled) setConnLoading(false);
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, []);

  async function pushToVoiceHub() {
    try {
      const w = String(voicehubWallet || "").trim().toLowerCase();
      if (!w) { setError("No connected VoiceHub wallet"); setTimeout(() => setError(null), 2500); return; }
      const meta = { roleKey, customRoleName, roleNotes, language, leadId, contactId, source: "AzureSalesAgentPanel" };
      const res = await fetch("/api/crm/prompt/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-wallet": w },
        body: JSON.stringify({ prompt, meta })
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Push failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to push prompt");
      setTimeout(() => setError(null), 3000);
    }
  }

  // CRM→VoiceHub control actions
  async function applyToVoiceHub() {
    try {
      const w = String(voicehubWallet || "").trim().toLowerCase();
      if (!w) {
        setError("No connected VoiceHub wallet");
        setTimeout(() => setError(null), 2500);
        return;
      }
      const payload: any = {
        prompt,
        settings: {
          language,
        },
        context: {
          roleKey,
          customRoleName,
          roleNotes,
        },
        leadId,
        contactId,
        source: "AzureSalesAgentPanel",
      };
      const res = await fetch("/api/voicehub/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "apply", payload, walletOverride: w }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Apply failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to apply settings");
      setTimeout(() => setError(null), 3000);
    }
  }

  async function startVoiceHub() {
    try {
      const w = String(voicehubWallet || "").trim().toLowerCase();
      if (!w) {
        setError("No connected VoiceHub wallet");
        setTimeout(() => setError(null), 2500);
        return;
      }
      const payload: any = {
        settings: {
          language,
        },
        leadId,
        contactId,
        source: "AzureSalesAgentPanel",
      };
      // Silent credit check prior to start
      try {
        const credRes = await fetch("/api/voicehub/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletOverride: w }),
        });
        const cred = await credRes.json().catch(() => ({}));
        if (!credRes.ok) {
          console.warn("Credit check failed:", (cred as any)?.error || credRes.status);
        }
      } catch (e: any) {
        console.warn("Credit check error:", e?.message || String(e));
      }

      const res = await fetch("/api/voicehub/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "start", payload, walletOverride: w }),
      });

      // Open VoiceHub Console to surface credit approval modal on user gesture (Start Listening)
      try {
        const vhBase = String(process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || "").trim();
        if (vhBase) {
          const win = window.open(`${vhBase}/console`, "_blank", "noopener,noreferrer");
          if (!win) {
            setError("Popup blocked for VoiceHub Console; allow popups to approve credits");
            setTimeout(() => setError(null), 3000);
          }
        } else {
          // Env not set, log hint for configuration
          console.warn("NEXT_PUBLIC_VOICEHUB_BASE_URL not set; cannot open Console for credit approval");
        }
      } catch (openErr: any) {
        console.warn("Failed to open VoiceHub Console:", openErr?.message || String(openErr));
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Start failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to start VoiceHub");
      setTimeout(() => setError(null), 3000);
    }
  }

  async function stopVoiceHub() {
    try {
      const w = String(voicehubWallet || "").trim().toLowerCase();
      if (!w) {
        setError("No connected VoiceHub wallet");
        setTimeout(() => setError(null), 2500);
        return;
      }
      const res = await fetch("/api/voicehub/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "stop", walletOverride: w }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Stop failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to stop VoiceHub");
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div className="rounded border bg-card p-2">
      <CustomCCP
        title="Engage AI Softphone"
        subtitle="Dialer left; agent settings right"
        dialerLeft
        leadId={leadId}
        contactId={contactId}
        autoStartVoiceHub
      />
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold">Agent Prompt (for external Azure Realtime)</div>
        <div className="text-[11px]">
          {connLoading ? (
            <span className="text-muted-foreground">Checking VoiceHub…</span>
          ) : voicehubConnected ? (
            <span className="text-green-600">VoiceHub Connected · Wallet {voicehubWallet ? `${voicehubWallet.slice(0, 6)}...${voicehubWallet.slice(-4)}` : "-"}</span>
          ) : (
            <span className="text-red-600">VoiceHub Not Connected</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <div className="text-[11px] font-semibold mb-1">Prompt Text</div>
          <Textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role preset selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px]">Role</span>
            <select
              className="text-xs h-7 px-2 border rounded"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value as any)}
            >
              <option value="sales_agent">Sales Agent</option>
              <option value="solutions_architect">Solutions Architect</option>
              <option value="account_manager">Account Manager</option>
              <option value="support_specialist">Support Specialist</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {roleKey === "custom" ? (
            <>
              <input
                className="text-xs h-7 px-2 border rounded"
                placeholder="Custom Role Name"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
              />
              <input
                className="text-xs h-7 px-2 border rounded w-48"
                placeholder="Custom Role Notes"
                value={roleNotes}
                onChange={(e) => setRoleNotes(e.target.value)}
              />
            </>
          ) : null}

          {/* Language */}
          <div className="flex items-center gap-1">
            <span className="text-[11px]">Lang</span>
            <input
              className="text-xs h-7 px-2 border rounded w-24"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </div>

          {/* Actions */}
          <Button size="sm" onClick={generateFromLead}>Generate from Lead</Button>
          <Button size="sm" variant="default" onClick={generatePowerPrompt} disabled={generating || !leadId}>
            {generating ? "Generating..." : "Generate Power Prompt"}
          </Button>
          <Button size="sm" variant="secondary" onClick={copyToClipboard}>{copied ? "Copied" : "Copy to Clipboard"}</Button>
          <Button size="sm" variant="default" onClick={pushToVoiceHub} disabled={!voicehubConnected}>Push to VoiceHub</Button>
          <Button size="sm" variant="default" onClick={applyToVoiceHub} disabled={!voicehubConnected}>Apply to VoiceHub</Button>
          <Button size="sm" variant="default" onClick={startVoiceHub} disabled={!voicehubConnected}>Start on VoiceHub</Button>
          <Button size="sm" variant="outline" onClick={stopVoiceHub} disabled={!voicehubConnected}>Stop on VoiceHub</Button>
          <Button size="sm" variant="outline" onClick={emitPromptEvent}>Emit Prompt Event</Button>
          <Button size="sm" variant="outline" onClick={savePromptAsNote} disabled={saving || !leadId}>{saving ? "Saving..." : "Save to CRM Notes"}</Button>
          {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Use Copy to paste into your Azure OpenAI Realtime app. Emit Prompt Event triggers a browser event
          (agent-prompt-generated) that your app can listen for. Save to CRM Notes stores the current prompt
          for this lead.
        </div>
      </div>
    </div>
  );
}
