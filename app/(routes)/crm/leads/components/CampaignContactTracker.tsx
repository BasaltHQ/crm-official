"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Eye,
  MessageSquare,
  Target,
  FileText,
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
  Ban,
  RotateCcw,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutreachItemWithActions {
  id: string;
  lead: string | null;
  status: string;
  subject: string | null;
  candidate_email: string | null;
  candidate_name: string | null;
  candidate_company: string | null;
  candidate_job_title: string | null;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  reply_sentiment: string | null;
  reply_snippet: string | null;
  followup_count: number;
  unsubscribed_at: string | null;
  account_id: string | null;
  contact_id: string | null;
  // Joined data
  opportunity?: { id: string; name: string; status: string } | null;
  pendingActions?: Array<{
    id: string;
    action_type: string;
    status: string;
    reasoning: string;
    requires_human: boolean;
    payload: any;
    createdAt: string;
  }>;
}

interface CampaignContactTrackerProps {
  campaignId: string;
  onRefresh?: () => void;
}

// ─── Pipeline Stage Config ───────────────────────────────────────────────────

const STAGES = [
  { key: "pool", label: "Pool", icon: Target, color: "#6b7280" },
  { key: "sent", label: "Sent", icon: Mail, color: "#3b82f6" },
  { key: "opened", label: "Opened", icon: Eye, color: "#8b5cf6" },
  { key: "replied", label: "Replied", icon: MessageSquare, color: "#f59e0b" },
  { key: "opportunity", label: "Opportunity", icon: Sparkles, color: "#10b981" },
  { key: "quote", label: "Quote", icon: FileText, color: "#06b6d4" },
  { key: "contract", label: "Contract", icon: FileSignature, color: "#ec4899" },
  { key: "closed", label: "Closed", icon: CheckCircle2, color: "#22c55e" },
];

function getStageIndex(item: OutreachItemWithActions): number {
  if (item.unsubscribed_at) return -1; // Unsubscribed — show red
  if (item.opportunity) {
    // Check for quote/contract actions
    const hasQuote = item.pendingActions?.some(
      (a) => a.action_type === "SEND_QUOTE" && a.status === "EXECUTED"
    );
    const hasContract = item.pendingActions?.some(
      (a) => a.action_type === "GENERATE_CONTRACT" && a.status === "EXECUTED"
    );
    if (hasContract) return 6;
    if (hasQuote) return 5;
    return 4;
  }
  if (item.repliedAt) return 3;
  if (item.openedAt) return 2;
  if (item.sentAt) return 1;
  return 0;
}

function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case "POSITIVE":
      return "#22c55e";
    case "NEGATIVE":
      return "#ef4444";
    case "NEUTRAL":
      return "#eab308";
    default:
      return "#9ca3af";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CampaignContactTracker({
  campaignId,
  onRefresh,
}: CampaignContactTrackerProps) {
  const [items, setItems] = useState<OutreachItemWithActions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [previewFullscreenId, setPreviewFullscreenId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/crm/campaigns/${campaignId}/contacts`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      toast.error("Failed to load campaign contacts");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleApprove(actionId: string) {
    try {
      const res = await fetch("/api/agents/deal/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision: "approve" }),
      });
      if (res.ok) {
        toast.success("Action approved and executed");
        loadItems();
      } else {
        toast.error("Approval failed");
      }
    } catch {
      toast.error("Approval failed");
    }
  }

  async function handleReject(actionId: string) {
    try {
      const res = await fetch("/api/agents/deal/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision: "reject", reason: "Rejected by user" }),
      });
      if (res.ok) {
        toast.success("Action rejected");
        loadItems();
      }
    } catch {
      toast.error("Rejection failed");
    }
  }

  const filteredItems =
    filter === "all"
      ? items
      : filter === "pending_approval"
        ? items.filter(
            (i) => i.pendingActions?.some((a) => a.status === "PROPOSED")
          )
        : items.filter((i) => {
            // Filter by raw DB status
            if (filter === "pending") return i.status === "PENDING" || i.status === "RESEARCHING" || i.status === "READY";
            if (filter === "failed") return i.status === "FAILED" || i.status === "BOUNCED";
            return i.status.toLowerCase() === filter.toLowerCase();
          });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Contact Progress</h3>
          <Badge variant="outline">{items.length} contacts</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter badges */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "all", label: "All" },
              { key: "pending_approval", label: "⚠️ Pending Approval" },
              { key: "pending", label: `Pending (${items.filter(i => ["PENDING","RESEARCHING","READY"].includes(i.status)).length})` },
              { key: "sent", label: `Sent (${items.filter(i => i.status === "SENT" || i.status === "DELIVERED").length})` },
              { key: "opened", label: `Opened (${items.filter(i => i.status === "OPENED" || i.status === "CLICKED").length})` },
              { key: "replied", label: `Replied (${items.filter(i => i.status === "REPLIED").length})` },
              { key: "failed", label: `Failed (${items.filter(i => i.status === "FAILED" || i.status === "BOUNCED").length})` },
            ].map(
              (f) => (
                <Badge
                  key={f.key}
                  variant={filter === f.key ? "default" : "outline"}
                  className={`cursor-pointer text-xs ${
                    f.key === "failed" && items.some(i => i.status === "FAILED" || i.status === "BOUNCED")
                      ? "border-red-500/30 text-red-400"
                      : ""
                  }`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Badge>
              )
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              loadItems();
              onRefresh?.();
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact Cards */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading contacts...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No contacts match this filter
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const stageIdx = getStageIndex(item);
            const hasPending = item.pendingActions?.some(
              (a) => a.status === "PROPOSED"
            );
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-all ${
                  hasPending
                    ? "border-amber-500/50 bg-amber-500/5"
                    : item.unsubscribed_at
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-border"
                }`}
              >
                {/* Contact Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">
                        {item.candidate_name || (item as any).account_name || item.candidate_email || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.candidate_company && (
                          <span>{item.candidate_company} · </span>
                        )}
                        {item.candidate_email}
                        {item.candidate_job_title && (
                          <span> · {item.candidate_job_title}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.reply_sentiment && (
                      <Badge
                        style={{
                          backgroundColor: getSentimentColor(item.reply_sentiment) + "20",
                          color: getSentimentColor(item.reply_sentiment),
                          borderColor: getSentimentColor(item.reply_sentiment) + "40",
                        }}
                        className="text-xs"
                      >
                        {item.reply_sentiment}
                      </Badge>
                    )}
                    {item.unsubscribed_at && (
                      <Badge variant="destructive" className="text-xs">
                        <Ban className="h-3 w-3 mr-1" /> Unsubscribed
                      </Badge>
                    )}
                    {hasPending && (
                      <Badge className="bg-amber-500 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" /> Approval
                      </Badge>
                    )}
                    {(item.status === "FAILED" || item.status === "BOUNCED") && (
                      <Badge variant="destructive" className="text-xs">
                        {item.status}
                      </Badge>
                    )}
                    {item.status === "PENDING" && (
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                        <Clock className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    {STAGES.map((stage, idx) => {
                      const isActive = idx <= stageIdx;
                      const isCurrent = idx === stageIdx;
                      const StageIcon = stage.icon;

                      return (
                        <Tooltip key={stage.key}>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <div
                                className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                                  isCurrent
                                    ? "ring-2 ring-offset-1"
                                    : ""
                                }`}
                                style={{
                                  backgroundColor: isActive
                                    ? stage.color + "20"
                                    : "transparent",
                                  color: isActive
                                    ? stage.color
                                    : "#d1d5db",
                                  borderColor: stage.color,
                                }}
                              >
                                <StageIcon className="h-3.5 w-3.5" />
                              </div>
                              {idx < STAGES.length - 1 && (
                                <div
                                  className="w-4 h-0.5 mx-0.5"
                                  style={{
                                    backgroundColor: isActive
                                      ? stage.color + "60"
                                      : "#e5e7eb",
                                  }}
                                />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{stage.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>

                  {/* Follow-up indicator */}
                  {item.followup_count > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {item.followup_count} follow-up{item.followup_count > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t pt-3">
                    {/* Email Subject */}
                    {item.subject && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                        <p className="text-sm font-semibold">{item.subject}</p>
                      </div>
                    )}

                    {/* Email Body */}
                    {((item as any).body_text || (item as any).body_html) && (
                      <div className="rounded-md overflow-hidden border border-border/50" style={{ position: 'relative' }}>
                        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                          <p className="text-xs font-medium" style={{ color: '#64748b' }}>Email Content</p>
                          {(item as any).body_html && (
                            <button
                              onClick={() => setPreviewFullscreenId(item.id)}
                              title="View fullscreen"
                              style={{
                                background: 'rgba(0,0,0,0.6)', color: 'white',
                                border: 'none', borderRadius: 4, padding: '3px 8px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: '0.65rem', fontWeight: 600,
                              }}
                            >
                              <Maximize2 size={10} /> Fullscreen
                            </button>
                          )}
                        </div>
                        {(item as any).body_html ? (
                          <iframe
                            srcDoc={`<!DOCTYPE html><html><head><meta name="color-scheme" content="light only"><style>:root{color-scheme:light only!important}html,body{background:#ffffff!important;color:#1f2937!important;margin:0;padding:0}</style></head><body>${(item as any).body_html}</body></html>`}
                            title="Email Preview"
                            sandbox="allow-same-origin"
                            style={{ width: '100%', height: 700, border: 'none', display: 'block', background: '#ffffff' }}
                          />
                        ) : (
                          <div style={{ background: '#ffffff', padding: '12px', maxHeight: 400, overflowY: 'auto' }}>
                            <p className="text-sm whitespace-pre-wrap" style={{ color: '#374151' }}>{(item as any).body_text}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fullscreen Email Modal */}
                    {previewFullscreenId === item.id && (item as any).body_html && (
                      <div style={{
                        position: 'fixed', inset: 0, zIndex: 99999,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '2rem',
                      }}>
                        <div style={{
                          position: 'relative', width: '100%', maxWidth: 720,
                          height: '90vh', borderRadius: 12, overflow: 'hidden',
                          boxShadow: '0 25px 60px rgba(0,0,0,0.5)', background: '#fff',
                          display: 'flex', flexDirection: 'column',
                        }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc', flexShrink: 0,
                          }}>
                            <div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Email Preview</span>
                              {item.subject && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 8 }}>— {item.subject}</span>
                              )}
                            </div>
                            <button
                              onClick={() => setPreviewFullscreenId(null)}
                              style={{
                                background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6,
                                cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: '0.75rem', fontWeight: 600, color: '#64748b',
                              }}
                            >
                              <X size={14} /> Close
                            </button>
                          </div>
                          <iframe
                            srcDoc={`<!DOCTYPE html><html><head><meta name="color-scheme" content="light only"><style>:root{color-scheme:light only!important}html,body{background:#ffffff!important;color:#1f2937!important;margin:0;padding:0}</style></head><body>${(item as any).body_html}</body></html>`}
                            title="Fullscreen Email Preview"
                            sandbox="allow-same-origin"
                            style={{ flex: 1, width: '100%', border: 'none', background: '#ffffff' }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Message (for FAILED/BOUNCED) */}
                    {(item as any).error_message && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                        <p className="text-sm text-red-300">{(item as any).error_message}</p>
                      </div>
                    )}

                    {/* Reply Snippet */}
                    {item.reply_snippet && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Latest Reply
                        </p>
                        <p className="text-sm italic">
                          &quot;{item.reply_snippet}&quot;
                        </p>
                      </div>
                    )}

                    {/* Pending Actions */}
                    {item.pendingActions && item.pendingActions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          AI Agent Actions
                        </p>
                        {item.pendingActions.map((action) => (
                          <div
                            key={action.id}
                            className={`border rounded-md p-3 ${
                              action.status === "PROPOSED"
                                ? "border-amber-500/40 bg-amber-500/5"
                                : action.status === "EXECUTED"
                                  ? "border-green-500/40 bg-green-500/5"
                                  : "border-red-500/40 bg-red-500/5"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {action.action_type.replace(/_/g, " ")}
                                </Badge>
                                <Badge
                                  variant={
                                    action.status === "PROPOSED"
                                      ? "default"
                                      : action.status === "EXECUTED"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                  className="text-xs"
                                >
                                  {action.status}
                                </Badge>
                              </div>
                              {action.status === "PROPOSED" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-green-500/50 text-green-600 hover:bg-green-500/10"
                                    onClick={() => handleApprove(action.id)}
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-500/50 text-red-600 hover:bg-red-500/10"
                                    onClick={() => handleReject(action.id)}
                                  >
                                    <ThumbsDown className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              <Sparkles className="h-3 w-3 inline mr-1" />
                              {action.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {item.sentAt && (
                        <span>Sent: {new Date(item.sentAt).toLocaleDateString()}</span>
                      )}
                      {item.openedAt && (
                        <span>Opened: {new Date(item.openedAt).toLocaleDateString()}</span>
                      )}
                      {item.repliedAt && (
                        <span>Replied: {new Date(item.repliedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CampaignContactTracker;
