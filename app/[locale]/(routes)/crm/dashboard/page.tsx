import React from "react";
import Container from "../../components/ui/Container";
import DashboardNavGrid from "./_components/DashboardNavGrid";
import WelcomeMessage from "./_components/WelcomeMessage";
import JumpBackIn from "./_components/JumpBackIn";
import DailyTasksWidget from "./_components/DailyTasksWidget";
import MyLeadsWidget from "./_components/MyLeadsWidget";
import { getDailyTasks } from "@/actions/dashboard/get-daily-tasks";
import { getNewLeads } from "@/actions/dashboard/get-new-leads";

const CrmDashboardPage = async () => {
  const dailyTasks = await getDailyTasks();
  const newLeads = await getNewLeads();

  return (
    <Container>
      <div className="flex flex-col space-y-2 mt-4">
        {/* Welcome Section & Active Widgets */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
          <WelcomeMessage />
          <div className="mt-2 md:mt-0 flex items-center gap-2">
            <MyLeadsWidget leads={newLeads} />
            <DailyTasksWidget tasks={dailyTasks} />
          </div>
        </div>

        {/* Recent Activity / Jump Back In */}
        <JumpBackIn />

        {/* Main Navigation Grid */}
        <DashboardNavGrid />
      </div>
    </Container>
  );
};

export default CrmDashboardPage;
