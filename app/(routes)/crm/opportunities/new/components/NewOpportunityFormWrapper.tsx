"use client";

import { useRouter } from "next/navigation";
import { NewOpportunityForm } from "../../components/NewOpportunityForm";

export function NewOpportunityFormWrapper(props: any) {
    const router = useRouter();

    return (
        <NewOpportunityForm
            {...props}
            onDialogClose={() => router.push("/crm/opportunities")}
        />
    );
}
