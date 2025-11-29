import { Suspense } from "react";

import SuspenseLoading from "@/components/loadings/suspense";

import Container from "../../components/ui/Container";

import TabsContainer from "./components/TabsContainer";
import LeadGenWizardPage from "./autogen/page";
import LeadPoolsPage from "./pools/page";
import SettingsTabs from "./components/SettingsTabs";
import LeadsManagerTabs from "./components/LeadsManagerTabs";

import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getLeads } from "@/actions/crm/get-leads";

export const dynamic = "force-dynamic";

type LeadsPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const LeadsPage = async ({ searchParams }: LeadsPageProps) => {
  const sp = searchParams ? await searchParams : undefined;
  const tabParam = sp?.tab;
  const tab = typeof tabParam === "string" ? tabParam : Array.isArray(tabParam) ? tabParam[0] ?? "manager" : "manager";

  // Only load heavy data when needed for the active tab
  const crmData = tab === "manager" ? await getAllCrmData() : null;
  const leads = tab === "manager" ? await getLeads() : null;

  return (
    <Container
      title="Leads Manager"
      description={"Everything you need to know about your leads"}
    >
      <TabsContainer
        managerSlot={
          tab === "manager" ? (
            <Suspense fallback={<SuspenseLoading />}>
              <LeadsManagerTabs leads={leads as any} crmData={crmData} />
            </Suspense>
          ) : null
        }
        wizardSlot={tab === "wizard" ? <LeadGenWizardPage /> : null}
        poolsSlot={tab === "pools" ? <LeadPoolsPage /> : null}
        settingsSlot={tab === "settings" ? (
          <SettingsTabs />
        ) : null}
      />
    </Container>
  );
};

export default LeadsPage;
