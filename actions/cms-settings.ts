"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password-utils";
import { logActivity } from "@/actions/audit";

export async function updateProfile(data: { name?: string; password?: string }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            throw new Error("Unauthorized");
        }

        if (session.user.userStatus && session.user.userStatus !== "ACTIVE") {
            throw new Error("Forbidden: Account is not active");
        }

        const updateData: Record<string, any> = {};
        const changes: string[] = [];

        if (typeof data?.name === "string" && data.name.trim()) {
            updateData.name = data.name.trim();
            changes.push("name");
        }

        if (typeof data?.password === "string" && data.password.length > 0) {
            if (data.password.length < 15 || data.password.length > 128) {
                throw new Error("Password must be between 15 and 128 characters");
            }
            updateData.password = await hashPassword(data.password);
            updateData.session_version = { increment: 1 };
            changes.push("password");
        }

        if (changes.length === 0) {
            return { success: true };
        }

        await prismadb.users.update({
            where: { id: session.user.id },
            data: updateData,
        });

        await logActivity(
            "Updated Profile",
            "User Settings",
            `Updated ${changes.join(", ")}`
        );

        return { success: true };
    } catch (error: any) {
        console.error("Profile update failed:", error);
        return { error: error.message || "Failed to update profile" };
    }
}
