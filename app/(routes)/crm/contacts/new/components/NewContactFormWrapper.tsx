"use client";

import { useRouter } from "next/navigation";
import { NewContactForm } from "../../components/NewContactForm";

export function NewContactFormWrapper({ accounts, users }: { accounts: any[], users: any[] }) {
    const router = useRouter();

    return (
        <NewContactForm
            accounts={accounts}
            users={users}
            onFinish={() => router.push("/crm/contacts")}
        />
    );
}
