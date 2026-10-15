'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'react-hot-toast';
import { STAGE_BADGE_CLASS, formatStageLabel, type PipelineStage } from '@/components/stageStyles';
import StageProgressBar, { type StageDatum } from '@/components/StageProgressBar';
import { ViewToggle, type ViewMode } from '@/components/ViewToggle';
import { ExternalLink, Mail, TrendingUp, Target, X, User, Info, ArrowRightCircle } from 'lucide-react';
import { convertLeadToOpportunity } from "@/actions/crm/convert-lead";
import { SmartEmailModal } from '@/components/modals/SmartEmailModal';
import { EnhancedDateFilter } from '@/components/date-filter/EnhancedDateFilter';
import { isWithinInterval } from 'date-fns';

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
  crmData: any;
  data: Lead[];
  isMember?: boolean;
};

const STAGES: PipelineStage[] = [
  "Identify",
  "Engage_AI",
  "Engage_Human",
  "Offering",
  "Finalizing",
  "Converted",
];

function StatusBadge({ status }: { status?: string | null }) {
  const s = status || 'IDLE';
  const color =
    s === 'CLOSED'
      ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
      : s === 'MEETING_BOOKED'
        ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
        : s === 'OPENED'
          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
          : s === 'SENT'
            ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700';
  return <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{s}</span>;
}

import { LeadsKanbanBoard } from './LeadsKanbanBoard';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, List as ListIcon } from "lucide-react";

export default function LeadsView({ data, crmData }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return "kanban";
    return "table";
  });
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedEmailLead, setSelectedEmailLead] = useState<Lead | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>({
    key: 'createdAt',
    direction: 'desc'
  });

  const handleSort = (key: keyof Lead) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const visibleLeads = useMemo(() => {
    let filtered = data;
    if (dateRange.from || dateRange.to) {
      filtered = data.filter((lead) => {
        if (!lead.createdAt) return true;
        const createdAt = new Date(lead.createdAt);

        if (dateRange.from && dateRange.to) {
          return createdAt >= dateRange.from && createdAt <= dateRange.to;
        }
        if (dateRange.from) {
          return createdAt >= dateRange.from;
        }
        if (dateRange.to) {
          return createdAt <= dateRange.to;
        }
        return true;
      });
    }

    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [data, dateRange, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const totalItems = visibleLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return visibleLeads.slice(start, start + itemsPerPage);
  }, [visibleLeads, currentPage, itemsPerPage]);

  const selectedInCurrentPage = useMemo(() => {
    return paginatedLeads.filter(l => selected[l.id]).map(l => l.id);
  }, [paginatedLeads, selected]);

  const allSelected = selectedInCurrentPage.length === paginatedLeads.length && paginatedLeads.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      const next = { ...selected };
      paginatedLeads.forEach(l => delete next[l.id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      paginatedLeads.forEach(l => next[l.id] = true);
      setSelected(next);
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

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

  function openMeeting(lead: Lead) {
    window.open(`/api/outreach/meeting/${encodeURIComponent(lead.id)}`, '_blank');
  }

  return (
    <div className="space-y-4">
      <SmartEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        recipientEmail={selectedEmailLead?.email || ""}
        recipientName={`${selectedEmailLead?.firstName || ""} ${selectedEmailLead?.lastName || ""}`}
        leadId={selectedEmailLead?.id}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <EnhancedDateFilter
            onFilterChange={setDateRange}
            storageKey="crm-leads-view-date-filter"
            initialType="all-time"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden sm:inline">Rows per page:</span>
            <select
              className="h-8 rounded border px-2 text-[10px] uppercase tracking-wider font-semibold bg-[#0a0a0a] border-white/10 text-white"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto sm:w-[200px]">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 border border-white/10">
              <TabsTrigger value="table" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <ListIcon className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <LayoutGrid className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          <div className="rounded-md border bg-[#0a0a0a]/50 border-white/5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('lastName')}>
                    <div className="flex items-center gap-1">
                      Lead
                      {sortConfig?.key === 'lastName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">
                      Email
                      {sortConfig?.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('company')}>
                    <div className="flex items-center gap-1">
                      Company
                      {sortConfig?.key === 'company' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('pipeline_stage' as any)}>
                    <div className="flex items-center gap-1">
                      Stage
                      {sortConfig?.key === 'pipeline_stage' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('outreach_status' as any)}>
                    <div className="flex items-center gap-1">
                      Status
                      {sortConfig?.key === 'outreach_status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                  </th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">Progress</th>
                  <th className="p-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedLeads.map((lead) => {
                  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
                  const stageKey = (lead as any).pipeline_stage as PipelineStage | undefined;
                  return (
                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-3">
                        <div className="font-medium text-white">{name || 'Lead'}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{lead.jobTitle || 'No Title'}</div>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{lead.email || '-'}</td>
                      <td className="p-3 text-muted-foreground">{lead.company || '-'}</td>
                      <td className="p-3">
                        <span className={stageKey ? STAGE_BADGE_CLASS[stageKey] : 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400'}>
                          {formatStageLabel(stageKey)}
                        </span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={lead.outreach_status} />
                      </td>
                      <td className="p-3">
                        <StageProgressBar
                          stages={STAGES.map((s) => ({ key: s, label: s.replace('_', ' '), count: s === (stageKey || 'Identify') ? 1 : 0 }))}
                          total={1}
                          orientation="horizontal"
                          nodeSize={6}
                          showLabelsAndCounts={false}
                          coloringMode="activated"
                          activeStageKey={stageKey || 'Identify'}
                          isClosed={stageKey === 'Converted' || (stageKey as any) === 'Closed'}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-400 hover:text-indigo-300 hover:bg-white/5" onClick={() => openMeeting(lead)} title="Meeting Link">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-white/5"
                            onClick={() => {
                              setSelectedEmailLead(lead);
                              setEmailModalOpen(true);
                            }}
                            title="Send Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-white/5" onClick={async () => {
                            try {
                              const res = await convertLeadToOpportunity(lead.id);
                              if (res.success && res.data?.opportunityId) {
                                toast.success("Converted!");
                                router.push(`/crm/opportunities/${res.data.opportunityId}`);
                              } else {
                                toast.error(res.error || "Failed");
                              }
                            } catch { toast.error("Error"); }
                          }} title="Convert">
                            <ArrowRightCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-white/5" onClick={() => closeLead(lead.id)} title="Close">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="flex items-center justify-between px-2 py-4 border-t border-white/5">
              <div className="text-xs text-muted-foreground italic">
                Showing <span className="text-white">{Math.min(itemsPerPage * (currentPage - 1) + 1, totalItems)}</span>-{Math.min(itemsPerPage * currentPage, totalItems)} of <span className="text-white">{totalItems}</span> leads
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-black/20 border-white/10 text-[10px] uppercase hover:bg-white/5"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                    <Button
                      key={i}
                      variant={currentPage === i + 1 ? "default" : "outline"}
                      size="sm"
                      className={`h-8 w-8 text-[10px] ${currentPage === i + 1 ? 'bg-indigo-600' : 'bg-black/20 border-white/10'}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 bg-black/20 border-white/10 text-[10px] uppercase hover:bg-white/5"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <LeadsKanbanBoard leads={visibleLeads as any} />
      )}
    </div>
  );
}
