import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DecisionReport } from "@/lib/ai/decision-report";

const usd = (cost: number) => `$${cost.toFixed(6)}`;
const label = (value: string) => value.replaceAll("_", " ");

export default function DecisionIntelligenceReport({ report }: { report: DecisionReport }) {
  const base = report.platform ? "/platform/decision-intelligence" : "/crm/decision-intelligence";
  const params = new URLSearchParams({ days: report.days });
  if (report.teamId && report.platform) params.set("teamId", report.teamId);
  const next = new URLSearchParams(params);
  if (report.nextCursor) next.set("cursor", report.nextCursor);
  const cards = [
    ["Decisions", report.totals.decisions], ["Failures / fallback", report.totals.failures],
    ["Unavailable / fallback", report.totals.unavailable], ["Cache reuse", report.totals.cached],
    ["Input tokens", report.totals.tokensIn.toLocaleString()], ["Output tokens", report.totals.tokensOut.toLocaleString()],
    ["Recorded provider cost", usd(report.totals.cost)],
  ];
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Decision Intelligence</h1>
        <Badge>Powered by Jev</Badge><Badge variant="secondary">Included for every team</Badge>
      </div>
      <p className="text-muted-foreground max-w-3xl">
        Understand outreach replies with buying intent, meeting and pricing signals, referrals, and stop-contact detection.
        Inspect the decisions and usage behind your CRM actions.
      </p>
      <div className="rounded-xl border p-4 text-sm">
        {report.configured ? "Jev is the primary classifier for SES and Gmail outreach replies." :
          report.platform ? "Setup required: add the platform TYPESAFE_API_KEY. Replies currently use the fallback classifier." :
            "Decision Intelligence is awaiting platform setup. Replies currently use the fallback classifier."}
        <p className="text-muted-foreground mt-1">Evaluations are included and do not deduct AI credits. Cost shows recorded provider spend;
          failed requests without token usage have unknown cost. Output tokens are free. Uncertain decisions go to review.</p>
      </div>
      <form action={base} className="flex flex-wrap items-end gap-4">
        <label className="text-sm space-y-1">Period
          <select name="days" defaultValue={report.days} className="block rounded-md border bg-background p-2">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option><option value="all">All time</option>
          </select>
        </label>
        {report.platform && <label className="text-sm space-y-1">Team
          <select name="teamId" defaultValue={report.teamId || ""} className="block rounded-md border bg-background p-2">
            <option value="">All teams</option>{report.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>}
        <button className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm">Apply / refresh</button>
      </form>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([title, value]) => <Card key={title}><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold mt-1">{value}</p>
        </CardContent></Card>)}
      </div>
      <Card>
        <CardHeader><CardTitle>Decision activity</CardTitle>
          <p className="text-sm text-muted-foreground">Totals cover the entire selected period. Showing up to 50 events per page.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {report.recent.length === 0 ? <p className="py-8 text-muted-foreground">No decision activity in this period. New matched SES and Gmail replies will appear here.</p> :
            <table className="w-full text-sm text-left"><thead><tr className="border-b">
              {["Time / team", "Outcome", "Decision", "Tokens / cost", "Latency / attempts", "Details"].map(heading => <th key={heading} className="p-3">{heading}</th>)}
            </tr></thead><tbody>{report.recent.map(log => {
              const metadata = (log.metadata || {}) as Record<string, any>;
              const decision = metadata.decision;
              return <tr key={log.id} className="border-b align-top">
                <td className="p-3 whitespace-nowrap"><time>{log.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</time>
                  <p className="text-muted-foreground">{log.team.name} · {log.user?.name || "System"}</p></td>
                <td className="p-3"><Badge variant={metadata.status === "failed" || metadata.status === "unavailable" ? "destructive" : "secondary"}>
                  {metadata.status || metadata.mode || "recorded"}</Badge>
                  {metadata.errorCode && <p className="mt-1 text-xs">{label(metadata.errorCode)}</p>}
                  {metadata.fallbackUsed && <p className="text-xs text-muted-foreground">Fallback classifier</p>}</td>
                <td className="p-3">{decision ? <><p className="font-medium">{label(decision.primaryIntent)}</p>
                  <p className="text-muted-foreground">{Math.round(decision.probability * 100)}% probability · buying intent {decision.buyingIntent.toFixed(2)}/3</p>
                  {decision.requiresReview && <Badge variant="outline">Review</Badge>}</> : "—"}</td>
                <td className="p-3 whitespace-nowrap">{log.tokens_in.toLocaleString()} in / {log.tokens_out.toLocaleString()} out
                  <p className="text-muted-foreground">{metadata.costKnown === false ? "Unknown cost" : usd(log.cost)}</p></td>
                <td className="p-3 whitespace-nowrap">{metadata.latencyMs ?? "—"} ms<p className="text-muted-foreground">{metadata.attemptCount ?? "—"} attempts</p></td>
                <td className="p-3"><details><summary className="cursor-pointer text-primary">Inspect</summary>
                  <p className="mt-2 font-mono text-xs">{log.model_used} · {metadata.questionVersion}</p>
                  <pre className="mt-2 text-xs max-w-lg max-h-80 overflow-auto">{JSON.stringify({
                    source: metadata.source, policyVersion: metadata.policyVersion, inputTruncated: metadata.inputTruncated,
                    decision, answers: metadata.response?.answers || metadata.answers, attempts: metadata.attempts,
                    evaluationKey: metadata.evaluationKey, usageKnown: metadata.usageKnown,
                  }, null, 2)}</pre>
                </details></td>
              </tr>;
            })}</tbody></table>}
          <div className="flex gap-4 mt-4">
            <Link className="text-primary" href={`${base}?${params}`}>Latest</Link>
            {report.nextCursor && <Link className="text-primary" href={`${base}?${next}`}>Older activity →</Link>}
          </div>
          {report.totals.shadow > 0 && <p className="mt-3 text-xs text-muted-foreground">Includes {report.totals.shadow} historical shadow evaluations in recorded usage.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
