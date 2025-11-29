import React from "react";
import Container from "../../components/ui/Container";
import { getSaleStages } from "@/actions/crm/get-sales-stage";
import CRMKanban from "./_components/CRMKanban";
import TeamAnalytics from "./_components/TeamAnalytics";
import TeamGamificationDocs from "./_components/TeamGamificationDocs";
import { getOpportunities } from "@/actions/crm/get-opportunities";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getTeamAnalytics } from "@/actions/dashboard/get-team-analytics";
import ProjectOpportunitiesPanel from "./_components/ProjectOpportunitiesPanel";



const CrmDashboardPage = async () => {
  const salesStages = await getSaleStages();
  const opportunities = await getOpportunities();
  const crmData = await getAllCrmData();
  const teamAnalytics = await getTeamAnalytics();

  return (
    <Container
      title="CRM Dashboard"
      description="Company-wide sales analytics, leaderboard, and opportunities overview."
    >
      <div className="space-y-8">
        <TeamAnalytics
          team={teamAnalytics.team}
          leaderboard={teamAnalytics.leaderboard}
          weights={teamAnalytics.weights}
        />

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Documentation & Formulas</h2>
          <TeamGamificationDocs />
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Project Opportunities</h2>
          <p className="text-sm text-muted-foreground mb-3">Sales can post feature buildouts or commissioned work tied to a specific project. These can be referenced from project tasks.</p>
          {/* Inline client panel for posting & listing opportunities by project */}
          <div className="mt-2">
            <ProjectOpportunitiesPanel />
          </div>
        </div>


      </div>

      {/*     <CRMKanbanServer
        salesStages={salesStages}
        opportunities={opportunities}
      /> */}
    </Container>
  );
};

export default CrmDashboardPage;
