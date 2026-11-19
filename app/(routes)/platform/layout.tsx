import React from "react";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/security/authz";

export default async function PlatformAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const admin = await requirePlatformAdmin();
    if (!admin) {
        return redirect("/");
    }

    return <>{children}</>;
}

