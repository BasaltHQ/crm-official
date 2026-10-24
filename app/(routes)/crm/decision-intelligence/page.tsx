import { redirect } from "next/navigation";
import DecisionIntelligenceReport from "@/components/DecisionIntelligenceReport";
import { DecisionAccessError, getDecisionReport } from "@/lib/ai/decision-report";

export const dynamic = "force-dynamic";

export default async function DecisionIntelligencePage({ searchParams }: {
  searchParams: Promise<{ days?: string; cursor?: string }>;
}) {
  const report = await getDecisionReport({ ...await searchParams, scope: "team" }).catch(error => {
    if (error instanceof DecisionAccessError) redirect("/crm/dashboard");
    throw error;
  });
  return <DecisionIntelligenceReport report={report} />;
}
