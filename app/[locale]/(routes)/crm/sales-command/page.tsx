import { Suspense } from "react";
import { getUnifiedSalesData } from "@/actions/crm/get-unified-sales-data";
import { getLeads } from "@/actions/crm/get-leads";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getBoards } from "@/actions/projects/get-boards";
import { getUserTasks } from "@/actions/projects/get-user-tasks";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SalesCommandProvider } from "./_components/SalesCommandProvider";
import SalesCommandDashboard from "./_components/SalesCommandDashboard";
import LoadingBox from "../../dashboard/components/loading-box"; // Reuse loading state

export default async function SalesCommandPage() {
    const session = await getServerSession(authOptions);
    const [unifiedData, leads, crmData, boards, tasks] = await Promise.all([
        getUnifiedSalesData(),
        getLeads(),
        getAllCrmData(),
        session?.user?.id ? getBoards(session.user.id) : Promise.resolve([]),
        session?.user?.id ? getUserTasks(session.user.id) : Promise.resolve([])
    ]);

    if (!unifiedData) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Please sign in to view Sales Command.
            </div>
        );
    }

    return (
        <Suspense fallback={<LoadingBox />}>
            <SalesCommandProvider
                initialData={unifiedData}
                initialLeads={leads}
                initialCrmData={crmData}
                initialBoards={boards}
                initialTasks={tasks}
            >
                <SalesCommandDashboard />
            </SalesCommandProvider>
        </Suspense>
    );
}

