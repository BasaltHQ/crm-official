'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { STAGE_BADGE_CLASS, formatStageLabel, type PipelineStage } from '@/components/stageStyles';
import OutreachCampaignWizard from './OutreachCampaignWizard';
import StageProgressBar, { type StageDatum } from '@/components/StageProgressBar';
import FollowUpWizard from '@/components/modals/FollowUpWizard';
import { ViewToggle, type ViewMode } from '@/components/ViewToggle';
import { ExternalLink, Mail, TrendingUp, Target, X, User, Phone, FileText, Info, Activity, Calendar, Building2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Lead = {
  id: string;
  firstName?: string | null;
  lastName: string;
  company?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  lead_source?: string | null;
  status?: string | null;
  type?: string | null;
  outreach_status?: string | null;
  outreach_sent_at?: string | Date | null;
  outreach_opened_at?: string | Date | null;
  outreach_meeting_booked_at?: string | Date | null;
  outreach_meeting_link?: string | null;
  outreach_notes?: string | null;
  pipeline_stage?: string | null;
  sms_status?: string | null;
  call_status?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type Props = {
  crmData: any; // unused placeholder for future enrichment
  data: Lead[];
};

// Ordered pipeline for coloring/activation
const STAGES: PipelineStage[] = [
  "Identify",
  "Engage_AI",
  "Engage_Human",
  "Offering",
  "Finalizing",
  "Closed",
];

const STATUS_ORDER: Record<string, number> = {
  IDLE: 0,
  PENDING: 10,
  SENT: 30,
  OPENED: 60,
  MEETING_LINK_CLICKED: 80,
  MEETING_BOOKED: 100,
  CLOSED: 100,
};

function statusProgress(status?: string | null) {
  if (!status) return STATUS_ORDER['IDLE'];
  return STATUS_ORDER[status] ?? 0;
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = status || 'IDLE';
  const color =
    s === 'CLOSED'
      ? 'bg-gray-200 text-gray-800'
      : s === 'MEETING_BOOKED'
        ? 'bg-green-200 text-green-800'
        : s === 'OPENED'
          ? 'bg-blue-200 text-blue-800'
          : s === 'SENT'
            ? 'bg-orange-200 text-orange-800'
            : 'bg-slate-200 text-slate-800';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{s}</span>;
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full h-2 rounded bg-muted">
      <div
        className="h-2 rounded bg-primary"
        style={{ width: `${v}%`, transition: 'width 200ms ease-in-out' }}
      />
    </div>
  );
}

export default function LeadsView({ data }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [testMode, setTestMode] = useState(false);
  const [meetingLinkOverride, setMeetingLinkOverride] = useState('');
  const [promptOverride, setPromptOverride] = useState('');
  const [firstContactOpen, setFirstContactOpen] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string>("");
  const [wizardInitialPrompt, setWizardInitialPrompt] = useState<string>("");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [expandedLeadId, setExpandedLeadId] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Follow-up wizard state
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);

  // View mode toggle: table (default list), compact (grid), card (large cards)
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);

  // Optimize data fetching with SWR
  const { data: poolsResponse, error: poolsError } = useSWR('/api/leads/pools', fetcher);
  const pools = useMemo(() => Array.isArray(poolsResponse?.pools) ? poolsResponse.pools : [], [poolsResponse]);

  useEffect(() => {
    if (poolsError) {
      toast.error("Failed to load pools: " + (poolsError.message || "Unknown error"));
    }
  }, [poolsError]);

  // Outreach eligibility: only when a pool is selected AND that pool has an assigned project
  const projectAssignedForSelectedPool = useMemo(() => {
    if (!selectedPoolId) return undefined;
    const p = pools.find((x: any) => x.id === selectedPoolId);
    return p?.icpConfig?.assignedProjectId;
  }, [selectedPoolId, pools]);
  const canBatchSelect = Boolean(selectedPoolId && projectAssignedForSelectedPool);



  // Only fetch leads for the SELECTED pool to avoid request storm
  const { data: selectedPoolLeadsResponse } = useSWR(
    selectedPoolId ? `/api/leads/pools/${encodeURIComponent(selectedPoolId)}/leads` : null,
    fetcher
  );

  // Build the set of lead IDs for the selected pool
  const selectedPoolLeadIds = useMemo(() => {
    if (!selectedPoolId || !selectedPoolLeadsResponse?.leads) return new Set<string>();
    return new Set(selectedPoolLeadsResponse.leads.map((l: any) => l.id));
  }, [selectedPoolId, selectedPoolLeadsResponse]);

  // Fetch brand logo only for the selected pool's project if needed
  const selectedPoolProject = useMemo(() => {
    if (!selectedPoolId) return null;
    const p = pools.find((x: any) => x.id === selectedPoolId);
    return p?.icpConfig?.assignedProjectId;
  }, [selectedPoolId, pools]);

  const { data: brandResponse } = useSWR(
    selectedPoolProject ? `/api/projects/${encodeURIComponent(selectedPoolProject)}/brand` : null,
    fetcher
  );

  useEffect(() => {
    if (!selectedPoolId) { setWizardInitialPrompt(""); setBrandLogoUrl(""); return; }
    const p = pools.find((x: any) => x.id === selectedPoolId);
    const tpl = (p?.latestJob?.queryTemplates?.[0]) || (p?.icpConfig?.prompt) || "";
    setWizardInitialPrompt(tpl || "");

    if (brandResponse?.brand_logo_url) {
      setBrandLogoUrl(brandResponse.brand_logo_url);
    } else {
      setBrandLogoUrl("");
    }
  }, [selectedPoolId, pools, brandResponse]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const visibleLeads = useMemo(() => {
    if (selectedPoolId && selectedPoolLeadsResponse?.leads) {
      // API now returns full objects
      return selectedPoolLeadsResponse.leads as Lead[];
    }
    return data;
  }, [data, selectedPoolId, selectedPoolLeadsResponse]);

  // Reset page when pool or limit changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPoolId, itemsPerPage]);

  const totalItems = visibleLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visibleLeads.slice(start, start + itemsPerPage);
  }, [visibleLeads, currentPage, itemsPerPage]);

  // Group by company for company view
  const companies = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of visibleLeads) {
      const key = (l.company && l.company.trim()) ? l.company.trim() : 'Unassigned Company';
      const arr = map.get(key) || [];
      arr.push(l);
      map.set(key, arr);
    }
    return map;
  }, [visibleLeads]);

  function buildCompanyStageData(leadsArr: Lead[]): { stageData: StageDatum[]; total: number; activeStageKey: PipelineStage; isClosed: boolean } {
    const counts: Record<PipelineStage, number> = {
      Identify: 0,
      Engage_AI: 0,
      Engage_Human: 0,
      Offering: 0,
      Finalizing: 0,
      Closed: 0,
    };
    let allClosed = leadsArr.length > 0;
    let maxIdx = 0;
    for (const l of leadsArr) {
      const s = ((l as any).pipeline_stage as PipelineStage) || 'Identify';
      counts[s as PipelineStage] = (counts[s as PipelineStage] || 0) + 1;
      if (s !== 'Closed') allClosed = false;
      const idx = STAGES.indexOf(s as PipelineStage);
      if (idx > maxIdx) maxIdx = idx;
    }
    const stageData: StageDatum[] = STAGES.map((k) => ({ key: k, label: k.replace('_', ' '), count: counts[k] || 0 }));
    const total = Math.max(1, leadsArr.length);
    const activeStageKey = allClosed ? 'Closed' : (STAGES[maxIdx] || 'Identify');
    return { stageData, total, activeStageKey, isClosed: allClosed };
  }

  const selectedInPoolIds = useMemo(
    () => selectedIds.filter((id) => {
      if (!selectedPoolId) return true;
      return selectedPoolLeadIds.has(id);
    }),
    [selectedIds, selectedPoolId, selectedPoolLeadIds]
  );

  // Batch select logic - now applies to PAGINATED leads for "select current page" behavior
  // heavily simplifying for now to just select visible items on current page
  const selectedInCurrentPage = useMemo(() => {
    return paginatedLeads.filter(l => selected[l.id]).map(l => l.id);
  }, [paginatedLeads, selected]);

  const allSelected = selectedInCurrentPage.length === paginatedLeads.length && paginatedLeads.length > 0;
  const someSelected = selectedIds.length > 0; // Global selection count for actions

  const toggleAll = () => {
    if (!canBatchSelect) return;
    if (allSelected) {
      // Deselect current page
      const next = { ...selected };
      paginatedLeads.forEach(l => delete next[l.id]);
      setSelected(next);
    } else {
      // Select all on current page
      const next = { ...selected };
      paginatedLeads.forEach(l => next[l.id] = true);
      setSelected(next);
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

  async function pushToOutreachBatch() {
    if (!someSelected) {
      toast.error('Select at least one lead');
      return;
    }
    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedInPoolIds,
          test: testMode,
          promptOverride: promptOverride || undefined,
          meetingLinkOverride: meetingLinkOverride || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        toast.success(`Outreach queued: sent=${json?.sent ?? 0}, skipped=${json?.skipped ?? 0}, errors=${json?.errors ?? 0}`);
      } else {
        toast.error(`Failed: ${typeof json === 'string' ? json : res.statusText}`);
      }
    } catch (e: any) {
      toast.error(`Failed to push outreach: ${e?.message || e}`);
    }
  }

  function composeEmail(to?: string | null) {
    const email = (to || '').trim();
    if (!email) { toast.error('No email address for this lead'); return; }
    const subject = '';
    const body = '';
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { window.location.href = url; } catch { window.open(url, '_blank'); }
  }

  async function sendFollowup(leadId: string) {
    try {
      const res = await fetch(`/api/outreach/followup/${encodeURIComponent(leadId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptOverride: promptOverride || undefined,
          meetingLinkOverride: meetingLinkOverride || undefined,
          test: testMode,
        }),
      });
      if (res.ok) {
        toast.success('Follow-up sent');
      } else {
        const txt = await res.text();
        toast.error(`Follow-up failed: ${txt}`);
      }
    } catch (e: any) {
      toast.error(`Follow-up failed: ${e?.message || e}`);
    }
  }

  async function closeLead(leadId: string) {
    const reason = prompt('Reason for closing (optional)') || '';
    try {
      const res = await fetch(`/api/outreach/close/${encodeURIComponent(leadId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        toast.success('Lead closed');
      } else {
        const txt = await res.text();
        toast.error(`Close failed: ${txt}`);
      }
    } catch (e: any) {
      toast.error(`Close failed: ${e?.message || e}`);
    }
  }

  function openMeeting(leadId: string) {
    window.open(`/api/outreach/meeting/${encodeURIComponent(leadId)}`, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Bulk toolbar */}
      <div className="rounded-md border bg-card p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allSelected}
                  onCheckedChange={(c) => toggleAll()}
                  disabled={!canBatchSelect}
                  title={!canBatchSelect ? "Select a pool with an assigned project to enable batch selection" : undefined}
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Select All</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Selected: {selectedInPoolIds.length}</span>
                <select
                  className="h-8 rounded border px-2 text-[10px] uppercase tracking-wider font-semibold bg-background"
                  value={selectedPoolId}
                  onChange={(e) => setSelectedPoolId(e.target.value)}
                >
                  <option value="">{pools.length ? "All pools" : "No pools"}</option>
                  {pools.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} {p.candidatesCount > 0 ? `(${p.candidatesCount})` : ''}</option>
                  ))}
                </select>
                {selectedPoolId && (
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 border border-amber-600 dark:bg-amber-400 dark:text-black transition-colors"
                    onClick={async () => {
                      try {
                        const ids = selectedInPoolIds.filter((id) => selectedPoolLeadIds.has(id));
                        if (!ids.length) { toast.error('Select at least one lead in this pool to reset'); return; }
                        const res = await fetch(`/api/outreach/reset-pool/${encodeURIComponent(selectedPoolId)}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadIds: ids }),
                        });
                        const j = await res.json().catch(() => null);
                        if (res.ok) {
                          toast.success(`Pool reset: ${j?.reset ?? 0} lead(s)`);
                        } else {
                          toast.error(typeof j === 'string' ? j : (j?.message || 'Failed to reset pool'));
                        }
                      } catch (e: any) {
                        toast.error(e?.message || 'Failed to reset pool');
                      }
                    }}
                  >Reset Pool</button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={testMode}
                  onCheckedChange={(c) => setTestMode(c)}
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Test Mode</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Rows:</span>
                <select
                  className="h-8 rounded border px-2 text-[10px] uppercase tracking-wider font-semibold bg-background"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>

            <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:justify-end">
              <Input
                className="h-8 text-xs"
                placeholder="Meeting link override (optional)"
                value={meetingLinkOverride}
                onChange={(e) => setMeetingLinkOverride(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 text-[10px] uppercase tracking-wider font-semibold"
                onClick={() => setFirstContactOpen(true)}
                disabled={!canBatchSelect || selectedInPoolIds.length === 0}
                title={!canBatchSelect ? "Select a pool with an assigned project to enable outreach" : (selectedInPoolIds.length === 0 ? "Select at least one lead in the chosen pool" : undefined)}
              >
                Push to Outreach
              </Button>
            </div>
          </div>

          {!canBatchSelect && (
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-right">
              Select a pool with an assigned project to enable outreach
            </div>
          )}

          <div className="mt-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Prompt override (optional)</label>
            <Textarea
              className="mt-1 text-xs"
              rows={2}
              placeholder="Override the default outreach prompt for this batch..."
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
            />
          </div>
        </div>
      </div>
      {firstContactOpen && (
        <OutreachCampaignWizard

          selectedLeads={visibleLeads.filter(l => selectedIds.includes(l.id)) as any}
          poolId={selectedPoolId}
          projectId={projectAssignedForSelectedPool}
          onClose={() => setFirstContactOpen(false)}
        />
      )}
      <FollowUpWizard
        isOpen={followUpOpen}
        onClose={() => { setFollowUpOpen(false); setFollowUpLeadId(null); }}
        leadId={followUpLeadId}
        poolId={selectedPoolId}
      />
      {/* Leads table */}
      {viewMode === 'table' && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 w-[40px]">
                    <Switch checked={allSelected} onCheckedChange={toggleAll} disabled={!canBatchSelect} />
                  </th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Lead</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Email</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Company</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Title</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Stage</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Progress</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  <th className="p-2 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Project</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads?.map((lead) => {
                  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
                  const canSend =
                    !lead.outreach_status || lead.outreach_status === 'IDLE' || lead.outreach_status === 'PENDING';
                  const canFollowup =
                    (lead.outreach_status === 'SENT' || lead.outreach_status === 'OPENED') &&
                    !lead.outreach_meeting_booked_at;
                  const stageKey = (lead as any).pipeline_stage as PipelineStage | undefined;

                  return (
                    <React.Fragment key={lead.id}>
                      <tr className="border-t hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { if (canBatchSelect) { toggleOne(lead.id, !selected[lead.id]); } setExpandedLeadId(expandedLeadId === lead.id ? "" : lead.id); }}>
                        <td className="p-2">
                          <Switch
                            checked={!!selected[lead.id]}
                            onCheckedChange={(c) => toggleOne(lead.id, c)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={!canBatchSelect}
                          />
                        </td>
                        <td className="p-2">
                          <div className="font-medium">{name || (lead.company && lead.company.trim()) || lead.email || 'Lead'}</div>
                        </td>
                        <td className="p-2 text-muted-foreground">{lead.email || '-'}</td>
                        <td className="p-2 text-muted-foreground">{lead.company || '-'}</td>
                        <td className="p-2 text-muted-foreground">{lead.jobTitle || '-'}</td>
                        <td className="p-2">
                          <span className={
                            stageKey
                              ? STAGE_BADGE_CLASS[stageKey]
                              : 'px-2 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }>
                            {formatStageLabel(stageKey)}
                          </span>
                        </td>
                        <td className="p-2">
                          <StatusBadge status={lead.outreach_status} />
                        </td>
                        <td className="p-2 w-48 align-top">
                          <StageProgressBar
                            stages={((): StageDatum[] => {
                              const cur: PipelineStage = stageKey || 'Identify';
                              return STAGES.map((s) => ({ key: s, label: s.replace('_', ' '), count: s === cur ? 1 : 0 }));
                            })()}
                            total={1}
                            orientation="horizontal"
                            nodeSize={8}
                            showLabelsAndCounts={false}
                            coloringMode="activated"
                            activeStageKey={stageKey || 'Identify'}
                            isClosed={stageKey === 'Closed'}
                            showMicroStatus
                            microStatusText={stageKey === 'Closed' ? 'Complete' : 'In Progress'}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setDetailsLead(lead); }} title="View Details">
                              <Info className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openMeeting(lead.id); }} title="Meeting Link">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); composeEmail(lead.email); }} disabled={!canSend} title="Send Email">
                              <Mail className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFollowUpLeadId(lead.id); setFollowUpOpen(true); }} disabled={!canFollowup} title="Follow-up">
                              <TrendingUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-500 hover:text-amber-600" onClick={async (e) => { e.stopPropagation(); try { const res = await fetch(`/api/outreach/reset/${encodeURIComponent(lead.id)}`, { method: 'POST' }); if (res.ok) { toast.success('Lead reset'); } else { const t = await res.text(); toast.error(t || 'Failed to reset'); } } catch (err: any) { toast.error(err?.message || 'Failed to reset'); } }} title="Reset Lead">
                              <Target className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); closeLead(lead.id); }} title="Close">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-2 w-24 text-right">
                          {(() => {
                            let url = brandLogoUrl;
                            let projectId: string | undefined;
                            if (selectedPoolId) {
                              // Use the one we fetched
                              const p = pools.find((x: any) => x.id === selectedPoolId);
                              projectId = p?.icpConfig?.assignedProjectId;
                            }
                            // Note: In "All Leads" view, we no longer aggressively search all pools for every lead to show a logo.
                            // This is a trade-off to stop the massive API request storm.

                            if (!url) return null;
                            const img = (
                              <img src={url} alt="Project" className="h-8 w-auto rounded object-contain inline-block hover:opacity-90 transition-opacity" />
                            );
                            return projectId ? (
                              <Link href={`/projects/boards/${projectId}`} prefetch={false}>{img}</Link>
                            ) : img;
                          })()}
                        </td>
                      </tr>
                      {expandedLeadId === lead.id && (
                        <tr>
                          <td colSpan={10} className="p-3 bg-muted/30">
                            {/* Lead progress detail */}
                            {(() => {
                              const cur: PipelineStage = stageKey || 'Identify';
                              const stageData: StageDatum[] = STAGES.map((s) => ({ key: s, label: s.replace('_', ' '), count: s === cur ? 1 : 0 }));
                              return (
                                <div className="flex items-start gap-4">
                                  <div className="w-full">
                                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Lead Progress</div>
                                    <StageProgressBar
                                      stages={stageData}
                                      total={1}
                                      orientation="horizontal"
                                      nodeSize={12}
                                      showLabelsAndCounts={true}
                                      coloringMode="activated"
                                      activeStageKey={cur}
                                      isClosed={cur === 'Closed'}
                                      showMicroStatus
                                      microStatusText={cur === 'Closed' ? 'Complete' : 'In Progress'}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {(!data || data.length === 0) && (
                  <tr>
                    <td className="p-4 text-center text-slate-500" colSpan={10}>
                      No leads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {paginatedLeads?.map((lead) => {
              const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
              const canSend = !lead.outreach_status || lead.outreach_status === 'IDLE' || lead.outreach_status === 'PENDING';
              const canFollowup = (lead.outreach_status === 'SENT' || lead.outreach_status === 'OPENED') && !lead.outreach_meeting_booked_at;
              const stageKey = (lead as any).pipeline_stage as PipelineStage | undefined;

              return (
                <div key={lead.id} className="border rounded-lg bg-card p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={!!selected[lead.id]}
                        onCheckedChange={(c) => toggleOne(lead.id, c)}
                        disabled={!canBatchSelect}
                      />
                      <div>
                        <div className="font-semibold">{name || (lead.company && lead.company.trim()) || lead.email || 'Lead'}</div>
                        <div className="text-xs text-muted-foreground">{lead.company || 'No Company'}</div>
                      </div>
                    </div>
                    <StatusBadge status={lead.outreach_status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.jobTitle && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">{lead.jobTitle}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Stage</div>
                    <span className={stageKey ? STAGE_BADGE_CLASS[stageKey] : 'px-2 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}>
                      {formatStageLabel(stageKey)}
                    </span>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailsLead(lead)} title="View Details">
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openMeeting(lead.id)} title="Meeting Link">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => composeEmail(lead.email)} disabled={!canSend} title="Send Email">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setFollowUpLeadId(lead.id); setFollowUpOpen(true); }} disabled={!canFollowup} title="Follow-up">
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500" onClick={async () => { try { const res = await fetch(`/api/outreach/reset/${encodeURIComponent(lead.id)}`, { method: 'POST' }); if (res.ok) { toast.success('Lead reset'); } } catch (err: any) { toast.error(err?.message); } }} title="Reset Lead">
                        <Target className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => closeLead(lead.id)} title="Close">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {(() => {
                      let url = brandLogoUrl;
                      let projectId: string | undefined;
                      if (selectedPoolId) {
                        const p = pools.find((x: any) => x.id === selectedPoolId);
                        projectId = p?.icpConfig?.assignedProjectId;
                      }
                      if (!url) return null;
                      const img = <img src={url} alt="Project" className="h-8 w-auto rounded object-contain" />;
                      return projectId ? <Link href={`/projects/boards/${projectId}`} prefetch={false}>{img}</Link> : img;
                    })()}
                  </div>
                </div>
              );
            })}
            {(!data || data.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">No leads found.</div>
            )}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {(viewMode === 'table' || viewMode === 'compact' || viewMode === 'card') && totalItems > 0 && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium">{Math.min(itemsPerPage * (currentPage - 1) + 1, totalItems)}</span> to <span className="font-medium">{Math.min(itemsPerPage * currentPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span> leads
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-20 text-[10px] uppercase tracking-wider disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-xs font-medium px-2">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-20 text-[10px] uppercase tracking-wider disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Compact Grid View */}
      {viewMode === 'compact' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginatedLeads?.map((lead) => {
            const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
            const stageKey = (lead as any).pipeline_stage as PipelineStage | undefined;
            return (
              <div
                key={lead.id}
                onClick={() => setDetailsLead(lead)}
                className="group border rounded-lg bg-card p-3 cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground truncate">{lead.company || '—'}</div>
                  </div>
                  <Switch
                    checked={!!selected[lead.id]}
                    onCheckedChange={(c) => toggleOne(lead.id, c)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!canBatchSelect}
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={
                    stageKey
                      ? STAGE_BADGE_CLASS[stageKey]
                      : 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }>
                    {formatStageLabel(stageKey)}
                  </span>
                  <StatusBadge status={lead.outreach_status} />
                </div>
              </div>
            );
          })}
          {(!paginatedLeads || paginatedLeads.length === 0) && (
            <div className="col-span-full text-center py-8 text-muted-foreground">No leads found.</div>
          )}
        </div>
      )}

      {/* Card Grid View */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLeads?.map((lead) => {
            const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
            const stageKey = (lead as any).pipeline_stage as PipelineStage | undefined;
            const canSend = !lead.outreach_status || lead.outreach_status === 'IDLE' || lead.outreach_status === 'PENDING';
            const canFollowup = (lead.outreach_status === 'SENT' || lead.outreach_status === 'OPENED') && !lead.outreach_meeting_booked_at;

            return (
              <div key={lead.id} className="border rounded-xl bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all">
                {/* Card Header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{name || (lead.company && lead.company.trim()) || lead.email || 'Lead'}</div>
                      {lead.jobTitle && <div className="text-sm text-muted-foreground truncate">{lead.jobTitle}</div>}
                    </div>
                    <Switch
                      checked={!!selected[lead.id]}
                      onCheckedChange={(c) => toggleOne(lead.id, c)}
                      disabled={!canBatchSelect}
                    />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Company & Email */}
                  <div className="space-y-2">
                    {lead.company && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{lead.company}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Stage & Status */}
                  <div className="flex items-center justify-between pt-2">
                    <span className={
                      stageKey
                        ? STAGE_BADGE_CLASS[stageKey]
                        : 'px-2 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }>
                      {formatStageLabel(stageKey)}
                    </span>
                    <StatusBadge status={lead.outreach_status} />
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <StageProgressBar
                      stages={STAGES.map((s) => ({ key: s, label: s.replace('_', ' '), count: s === (stageKey || 'Identify') ? 1 : 0 }))}
                      total={1}
                      orientation="horizontal"
                      nodeSize={8}
                      showLabelsAndCounts={false}
                      coloringMode="activated"
                      activeStageKey={stageKey || 'Identify'}
                      isClosed={stageKey === 'Closed'}
                    />
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailsLead(lead)} title="View Details">
                      <Info className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openMeeting(lead.id)} title="Meeting Link">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => composeEmail(lead.email)} disabled={!canSend} title="Send Email">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setFollowUpLeadId(lead.id); setFollowUpOpen(true); }} disabled={!canFollowup} title="Follow-up">
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500" onClick={async () => { try { const res = await fetch(`/api/outreach/reset/${encodeURIComponent(lead.id)}`, { method: 'POST' }); if (res.ok) { toast.success('Lead reset'); } } catch (err: any) { toast.error(err?.message); } }} title="Reset Lead">
                      <Target className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => closeLead(lead.id)} title="Close">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {(!paginatedLeads || paginatedLeads.length === 0) && (
            <div className="col-span-full text-center py-8 text-muted-foreground">No leads found.</div>
          )}
        </div>
      )}


      {/* Lead Details Modal */}
      <Dialog open={!!detailsLead} onOpenChange={(open) => !open && setDetailsLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              {detailsLead?.firstName} {detailsLead?.lastName}
            </DialogDescription>
          </DialogHeader>

          {detailsLead && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</label>
                  <div className="font-medium">{detailsLead.company || "—"}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Title</label>
                  <div className="font-medium">{detailsLead.jobTitle || "—"}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{detailsLead.email || "—"}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{detailsLead.phone || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Status & Stage */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline Stage</label>
                    <div>
                      <span className={detailsLead.pipeline_stage ? STAGE_BADGE_CLASS[detailsLead.pipeline_stage as PipelineStage] : 'px-2 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800'}>
                        {formatStageLabel(detailsLead.pipeline_stage as PipelineStage)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outreach Status</label>
                    <div><StatusBadge status={detailsLead.outreach_status} /></div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {detailsLead.outreach_sent_at && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Sent: {new Date(detailsLead.outreach_sent_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {detailsLead.outreach_opened_at && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Opened: {new Date(detailsLead.outreach_opened_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description / Notes */}
              {(detailsLead.description || detailsLead.outreach_notes) && (
                <div className="space-y-4">
                  {detailsLead.description && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Description
                      </label>
                      <div className="text-sm bg-muted/20 p-3 rounded-md border">{detailsLead.description}</div>
                    </div>
                  )}
                  {detailsLead.outreach_notes && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Outreach Notes
                      </label>
                      <div className="text-sm bg-muted/20 p-3 rounded-md border">{detailsLead.outreach_notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* System Info */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</label>
                  <div className="text-sm">{detailsLead.lead_source || "—"}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</label>
                  <div className="text-sm">{detailsLead.createdAt ? new Date(detailsLead.createdAt).toLocaleDateString() : "—"}</div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
