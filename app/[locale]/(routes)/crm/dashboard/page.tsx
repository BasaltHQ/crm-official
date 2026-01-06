import React from "react";
import Container from "../../components/ui/Container";
import DashboardNavGrid from "./_components/DashboardNavGrid";
import WelcomeMessage from "./_components/WelcomeMessage";
import JumpBackIn from "./_components/JumpBackIn";

const CrmDashboardPage = async () => {
  return (
    <Container>
      <div className="flex flex-col space-y-2 mt-4">
        {/* Welcome Section */}
        <WelcomeMessage />

        {/* Recent Activity / Jump Back In */}
        <JumpBackIn />

        {/* Main Navigation Grid */}
        <DashboardNavGrid />
      </div>
    </Container>
  );
};

export default CrmDashboardPage;
