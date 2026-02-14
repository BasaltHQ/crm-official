"use client";

import { useRouter } from "next/navigation";
import { NewAccountForm } from "../../components/NewAccountForm";

export function NewAccountFormWrapper({ industries, users }: { industries: any[], users: any[] }) {
    const router = useRouter();

    return (
        <NewAccountForm
            industries={industries}
            users={users}
            onFinish={() => router.push("/crm/accounts")}
        />
    );
}
