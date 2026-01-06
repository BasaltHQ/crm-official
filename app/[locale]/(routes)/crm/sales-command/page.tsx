import { Suspense } from "react";
import { getUnifiedSalesData } from "@/actions/crm/get-unified-sales-data";
import { getLeads } from "@/actions/crm/get-leads";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { SalesCommandProvider } from "./_components/SalesCommandProvider";
import SalesCommandDashboard from "./_components/SalesCommandDashboard";
import LoadingBox from "../../dashboard/components/loading-box"; // Reuse loading state

export default async function SalesCommandPage() {
    const [unifiedData, leads, crmData] = await Promise.all([
        getUnifiedSalesData(),
        getLeads(),
        getAllCrmData()
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
            >
                <SalesCommandDashboard />
            </SalesCommandProvider>
        </Suspense>
    );
}
