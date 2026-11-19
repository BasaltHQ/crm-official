"use server";

import { z } from "zod";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { encryptSecret, isMaskedSecret } from "@/lib/encryption";
import { requirePlatformAdmin } from "@/lib/security/authz";

export const updateSystemResendConfig = async (formData: FormData) => {
    const admin = await requirePlatformAdmin();
    if (!admin) return { error: "Forbidden" };

    const schema = z.object({
        id: z.string(),
        serviceKey: z.string(),
    });
    const parsed = schema.parse({
        id: formData.get("id") || "",
        serviceKey: formData.get("serviceKey") || "",
    });

    const trimmedKey = parsed.serviceKey.trim();
    if (!trimmedKey || isMaskedSecret(trimmedKey) || trimmedKey.includes("••••")) {
        return { error: "Valid API key is required" };
    }

    const encryptedKey = encryptSecret(trimmedKey);

    if (!parsed.id) {
        await prismadb.systemServices.create({
            data: {
                v: 0,
                name: "resend_smtp",
                serviceKey: encryptedKey,
            },
        });
    } else {
        await prismadb.systemServices.update({
            where: {
                id: parsed.id,
            },
            data: {
                serviceKey: encryptedKey,
            },
        });
    }

    // Revalidate checks
    revalidatePath("/admin/settings");
    revalidatePath("/partners"); // Revalidate broadly if needed
    return { success: true };
};
