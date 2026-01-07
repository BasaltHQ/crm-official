import { Suspense } from "react";

import SuspenseLoading from "@/components/loadings/suspense";

import Container from "../../components/ui/Container";

import TabsContainer from "./components/TabsContainer";
import LeadGenWizardPage from "./autogen/page";
import LeadPoolsPage from "./pools/page";
import SettingsTabs from "./components/SettingsTabs";
import LeadsManagerTabs from "./components/LeadsManagerTabs";
import CampaignsView from "./components/CampaignsView";

import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getLeads } from "@/actions/crm/get-leads";

export const dynamic = "force-dynamic";

type LeadsPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const LeadsPage = async ({ searchParams }: LeadsPageProps) => {
  const sp = searchParams ? await searchParams : undefined;
  const tabParam = sp?.tab;
  const tab = typeof tabParam === "string" ? tabParam : Array.isArray(tabParam) ? tabParam[0] ?? "manager" : "manager";

  // Only load heavy data when needed for the active tab (Client-side fetch optimization)
  const crmData = tab === "manager" ? await getAllCrmData() : null;
  // const leads = tab === "manager" ? await getLeads() : null;
  const leads = null;

  const getTabInfo = (currentTab: string) => {
    switch (currentTab) {
      case "wizard":
        return {
          title: "Leads Wizard",
          description: "Generate and manage leads using AI-powered tools"
        };
      case "pools":
        return {
          title: "Leads Pools",
          description: "Manage and organize your lead pools efficiently"
        };
      case "campaigns":
        return {
          title: "Campaigns",
          description: "Track and manage your marketing campaigns"
        };
      case "settings":
        return {
          title: "Settings",
          description: "Configure your lead management preferences"
        };
      case "manager":
      default:
        return {
          title: "Leads Manager",
          description: "Everything you need to know about your leads"
        };
    }
  };

  const { title, description } = getTabInfo(tab);

  return (
    <div className="h-full w-full">
      <TabsContainer
        title={title}
        description={description}
        managerSlot={
          tab === "manager" ? (
            <Suspense fallback={<SuspenseLoading />}>
              <LeadsManagerTabs leads={leads as any} crmData={crmData} />
            </Suspense>
          ) : null
        }
        wizardSlot={tab === "wizard" ? <LeadGenWizardPage /> : null}
        poolsSlot={tab === "pools" ? <LeadPoolsPage /> : null}
        campaignsSlot={tab === "campaigns" ? <CampaignsView /> : null}
        settingsSlot={tab === "settings" ? (
          <SettingsTabs />
        ) : null}
      />
    </div>
  );
};

export default LeadsPage;
