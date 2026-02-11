import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import AdminDashboard from "./views/AdminDashboard";
import MemberDashboard from "./views/MemberDashboard";
import ViewerDashboard from "./views/ViewerDashboard";

// Data Fetching Actions
import { getDailyTasks } from "@/actions/dashboard/get-daily-tasks";
import { getNewLeads } from "@/actions/dashboard/get-new-leads";
import { getNewProjects } from "@/actions/dashboard/get-new-projects";
import { getUserMessages } from "@/actions/dashboard/get-user-messages";
import { getUnifiedSalesData } from "@/actions/crm/get-unified-sales-data";
import { getUsersTasksCount } from "@/actions/dashboard/get-tasks-count";
import { getSummaryCounts } from "@/actions/dashboard/get-summary-counts";
import { getModules } from "@/actions/get-modules";
import { getDashboardLayout } from "../_actions/get-dashboard-layout";
import { getTeamActivity } from "@/actions/dashboard/get-team-activity";
import { getRecentFiles } from "@/actions/dashboard/get-recent-files";
import { getRevenuePacing } from "@/actions/dashboard/get-revenue-pacing";
import { getOutreachStats } from "@/actions/dashboard/get-outreach-stats";
import { getLeadPoolsStats } from "@/actions/dashboard/get-lead-pools-stats";
import { getLeadGenStats } from "@/actions/dashboard/get-lead-gen-stats";
import { getIntelligenceStats } from "@/actions/dashboard/get-intelligence-stats";
import { getAIInsights } from "@/actions/dashboard/get-ai-insights";

import { Suspense } from "react";
import MyPipelineSection from "../../../dashboard/components/MyPipelineSection";
import TeamPipelineSection from "../../../dashboard/components/TeamPipelineSection";
import LoadingBox from "../../../dashboard/components/loading-box";

const DashboardRoleManager = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    const userId = session.user.id;

    // 1. Determine Role
    const user = await prismadb.users.findUnique({
        where: { id: userId },
        select: { team_role: true, email: true, is_admin: true } // Email might be needed for hardcoded super admins if any
    });

    const role = (user?.team_role || "VIEWER").trim().toUpperCase();

    // Platform Admin Check: Only specific team/users if requirement exists, otherwise maps to PLATFORM_ADMIN role
    // For now, treating PLATFORM_ADMIN and ADMIN similarly but with potential future separation.
    const isAdmin = (user as any)?.is_admin || role === "PLATFORM_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN" || role === "PLATFORM ADMIN" || role === "SYSADM" || role === "OWNER";
    const isMember = role === "MEMBER";

    // 2. Fetch Data Parallel
    // We fetch different data based on role to optimize performance
    // 2. Fetch Data Parallel
    // We fetch different data based on role to optimize performance
    if (isAdmin) {
        const [
            unifiedData,
            activeUsersCount,
            counts,
            modules,
            usersTasks,
            newLeads,
            newProjects,
            dailyTasks,
            messages,
            workflowCount,
            approvalCount,
            guardCount,
            caseCount,
            productCount,
            quoteCount,
            reportCount,
            initialLayout,
            teamActivity,
            recentFiles,
            revenuePacing,
            outreachStats,
            leadPools,
            leadGenStats,
            intelligenceStats,
            aiInsights,
        ] = await Promise.all([
            getUnifiedSalesData(),
            prismadb.users.count(),
            getSummaryCounts(),
            getModules(),
            getUsersTasksCount(userId),
            getNewLeads(),
            getNewProjects(),
            getDailyTasks(),
            getUserMessages(),
            prismadb.crm_Workflow.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).approvalProcess.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).validationRule.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).crm_Cases.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).crm_Products.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).crm_Quotes.count({ where: { team_id: (session.user as any).team_id } } as any),
            (prismadb as any).savedReport.count({ where: { teamId: (session.user as any).team_id } } as any),
            getDashboardLayout(),
            getTeamActivity(),
            getRecentFiles(),
            getRevenuePacing(),
            getOutreachStats(),
            getLeadPoolsStats(),
            getLeadGenStats(),
            getIntelligenceStats(),
            getAIInsights(),
        ]);

        const crmModule = modules.find((module: any) => module.name === "crm" || module.name === "CRM"); // Case handling
        const projectsModule = modules.find((module: any) => module.name === "projects" || module.name === "Projects");

        // Build CRM entities - Comprehensive list matching CrmSidebar order/labels
        const crmEntities: any[] = [];
        if (crmModule?.enabled) {
            crmEntities.push(
                // Core CRM (Match Sidebar Order)
                { id: "entity:accounts", name: "Accounts", value: counts.accounts, href: "/crm/accounts", iconName: "LandmarkIcon", color: "cyan" },
                { id: "entity:contacts", name: "Contacts", value: counts.contacts, href: "/crm/contacts", iconName: "Contact", color: "violet" },
                { id: "entity:contracts", name: "Contracts", value: counts.contracts, href: "/crm/contracts", iconName: "FilePenLine", color: "rose" },
                { id: "entity:dialer", name: "Dialer", value: 0, href: "/crm/dialer", iconName: "Phone", color: "blue" },
                { id: "entity:leads_manager", name: "Leads Manager", value: counts.leads, href: "/crm/leads", iconName: "Users2", color: "emerald" }
            );

            // Insert Projects here to match sidebar order
            if (projectsModule?.enabled) {
                crmEntities.push({ id: "entity:projects", name: "Projects", value: counts.boards, href: "/campaigns", iconName: "FolderKanban", color: "cyan" });
            }

            crmEntities.push(
                { id: "entity:opportunities", name: "Opportunities", value: counts.opportunities, href: "/crm/opportunities", iconName: "Target", color: "amber" },
                { id: "entity:sales_command", name: "Sales Command", value: 0, href: "/crm/sales-command", iconName: "Radio", color: "pink" },
                { id: "entity:service_console", name: "Service Console", value: caseCount, href: "/crm/cases", iconName: "Headset", color: "indigo" },

                // FlowState / Automation (Phase 3)
                { id: "entity:guard_rules", name: "Guard Rules", value: guardCount, href: "/crm/validation-rules", iconName: "Shield", color: "rose" },
                { id: "entity:approval_chains", name: "Approval Chains", value: approvalCount, href: "/crm/approvals", iconName: "CheckCircle2", color: "emerald" },
                { id: "entity:flowstate_builder", name: "FlowState Builder", value: workflowCount, href: "/crm/workflows", iconName: "Zap", color: "indigo" },

                // Outreach & Optimization (Phase 4)
                { id: "entity:lead_wizard", name: "Lead Wizard", value: 0, href: "/crm/lead-wizard", iconName: "Wand2", color: "cyan" },
                { id: "entity:lead_pools", name: "Lead Pools", value: 0, href: "/crm/lead-pools", iconName: "Target", color: "violet" },
                { id: "entity:outreach", name: "Outreach", value: 0, href: "/crm/outreach", iconName: "Megaphone", color: "orange" },

                // Tasks & Supplementary
                { id: "entity:my_tasks", name: "My Tasks", value: usersTasks, href: `/campaigns/tasks/${userId}`, iconName: "Target", color: "emerald" },
                { id: "entity:invoices", name: "Invoices", value: counts.invoices, href: "/invoice", iconName: "FileText", color: "blue" },
                { id: "entity:reports", name: "Reports", value: reportCount, href: "/reports", iconName: "BarChart3", color: "amber" },
                { id: "entity:products", name: "Products", value: productCount, href: "/crm/products", iconName: "Package", color: "teal" },
                { id: "entity:quotes", name: "Quotes", value: quoteCount, href: "/crm/quotes", iconName: "FileText", color: "blue" }
            );
        }

        // Alphabetize entities for consistent layout
        crmEntities.sort((a, b) => a.name.localeCompare(b.name));

        const projectEntities: any[] = [];

        return (
            <AdminDashboard
                userId={userId}
                userName={session.user.name || "User"}
                revenue={unifiedData?.summary?.revenue || 0}
                activePipelineCount={unifiedData?.summary?.activeDeals || 0}
                totalLeads={unifiedData?.summary?.leadsCount || 0}
                totalOpportunities={unifiedData?.summary?.opportunitiesCount || 0}
                activeUsersCount={activeUsersCount}
                crmEntities={crmEntities}
                projectEntities={projectEntities}
                newLeads={newLeads}
                newProjects={newProjects}
                dailyTasks={dailyTasks}
                messages={messages}
                teamActivity={teamActivity}
                recentFiles={recentFiles}
                revenuePacing={revenuePacing}
                outreachStats={outreachStats}
                leadPools={leadPools}
                leadGenStats={leadGenStats}
                intelligenceStats={intelligenceStats}
                aiInsights={aiInsights}
                newLeadsCount={Array.isArray(newLeads) ? newLeads.length : 0}
                newProjectsCount={Array.isArray(newProjects) ? newProjects.length : 0}
                allTasksCount={counts.tasks}
                messagesCount={Array.isArray(messages) ? messages.length : 0}
                myPipeline={
                    <Suspense key="personal-pipeline-suspense" fallback={<LoadingBox />}>
                        <MyPipelineSection userId={userId} />
                    </Suspense>
                }
                teamPipeline={
                    <Suspense key="team-pipeline-suspense" fallback={<LoadingBox />}>
                        <TeamPipelineSection />
                    </Suspense>
                }
                initialLayout={initialLayout as any}
            />
        );
    }

    if (isMember) {
        const [dailyTasks, newLeads, newProjects, messages, userTasksCount] = await Promise.all([
            getDailyTasks(),
            getNewLeads(),
            getNewProjects(),
            getUserMessages(),
            getUsersTasksCount(userId)
        ]);

        return (
            <MemberDashboard
                userId={userId}
                userName={session.user.name || "User"}
                dailyTasks={dailyTasks}
                newLeads={newLeads}
                newProjects={newProjects}
                messages={messages}
                userTasksCount={userTasksCount}
            />
        );
    }

    // Fallback: Viewer
    // Viewers might just need simple stats
    const unifiedData = await getUnifiedSalesData();

    return (
        <ViewerDashboard
            revenue={unifiedData?.summary?.revenue || 0}
            activePipelineCount={unifiedData?.summary?.activeDeals || 0}
        />
    );
};

export default DashboardRoleManager;
