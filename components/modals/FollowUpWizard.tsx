"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";

export type FollowUpWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  poolId?: string;
};

export default function FollowUpWizard({ isOpen, onClose, leadId, poolId }: FollowUpWizardProps) {
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [promptOverride, setPromptOverride] = useState<string>("");
  const [meetingLinkOverride, setMeetingLinkOverride] = useState<string>("");
  const [testMode, setTestMode] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !leadId) return;
    setLoading(true);
    (async () => {
      try {
        // Fetch lead basic data
        const leadRes = await fetch(`/api/leads/${encodeURIComponent(leadId)}`);
        const leadJson = await leadRes.json().catch(() => null);
        setLead(leadJson?.lead || null);
      } catch {}
      try {
        const actRes = await fetch(`/api/leads/activities/${encodeURIComponent(leadId)}`);
        const actJson = await actRes.json().catch(() => null);
        setActivities(Array.isArray(actJson?.activities) ? actJson.activities : []);
      } catch {}
      setLoading(false);
    })();
  }, [isOpen, leadId]);

  const lastEmail = useMemo(() => {
    return activities.find((a: any) => a.type === "email_sent");
  }, [activities]);

  const lastResponse = useMemo(() => {
    return activities.find((a: any) => a.type === "email_replied");
  }, [activities]);

  useEffect(() => {
    if (!isOpen) return;
    // Build a lightweight analysis text to guide follow-up generation
    const lines: string[] = [];
    lines.push(`Lead: ${lead?.firstName ?? ""} ${lead?.lastName ?? ""} · ${lead?.company ?? ""} · ${lead?.jobTitle ?? ""}`.trim());
    if (lastEmail) {
      lines.push(`Last email subject: ${lastEmail?.metadata?.subject ?? "(unknown)"}`);
    }
    if (lastResponse) {
      lines.push(`Response detected: yes`);
    } else {
      lines.push(`Response detected: no`);
    }
    setAnalysis(lines.join("\n"));
  }, [isOpen, lead, lastEmail, lastResponse]);

  async function sendFollowUp() {
    if (!leadId) return;
    try {
      const res = await fetch(`/api/outreach/followup/${encodeURIComponent(leadId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptOverride: promptOverride?.trim() || undefined,
          meetingLinkOverride: meetingLinkOverride?.trim() || undefined,
          test: !!testMode,
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success("Follow-up queued");
        onClose();
      } else {
        toast.error(typeof json === "string" ? json : (json?.message || "Failed to send follow-up"));
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send follow-up");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prepare Follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading context…</div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{analysis || "No prior activity found."}</div>
              <div>
                <label className="text-xs font-medium">Batch Prompt Override</label>
                <Textarea className="mt-1" rows={8} value={promptOverride} onChange={(e) => setPromptOverride(e.target.value)} placeholder="Optional: provide guidance for the follow-up email generation" />
              </div>
              <div>
                <label className="text-xs font-medium">Meeting Link Override</label>
                <Input className="mt-1" value={meetingLinkOverride} onChange={(e) => setMeetingLinkOverride(e.target.value)} placeholder="Optional: https://calendar.link/..." />
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} /> Test mode</label>
            </>
          )}
        </div>
        <DialogFooter className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={sendFollowUp} disabled={!leadId}>Send Follow-up</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
