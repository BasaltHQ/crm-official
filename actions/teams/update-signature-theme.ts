"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildUserContext, canUpdateSignatureTheme } from "@/lib/department-permissions";

export interface SignatureTheme {
    html: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    companyName?: string;
    socialLinks?: {
        linkedin?: string;
        twitter?: string;
        website?: string;
        instagram?: string;
    };
}

export interface UpdateSignatureThemeResult {
    success: boolean;
    error?: string;
}

/**
 * Update the organization-wide signature theme
 * Both SUPER_ADMIN and ADMIN can update (affects entire org)
 */
export async function updateSignatureTheme(theme: SignatureTheme): Promise<UpdateSignatureThemeResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            include: { assigned_team: true },
        });

        if (!user?.team_id) {
            return { success: false, error: "User is not part of a team" };
        }

        const userContext = buildUserContext(user as any);

        // Check permission
        if (!canUpdateSignatureTheme(userContext)) {
            return { success: false, error: "You don't have permission to update the signature theme" };
        }

        // Find the organization ID (if user is in a department, get the parent org)
        const orgId = user.assigned_team?.team_type === "ORGANIZATION"
            ? user.team_id
            : user.assigned_team?.parent_id;

        if (!orgId) {
            return { success: false, error: "Organization not found" };
        }

        // Update the organization's signature theme
        await prismadb.team.update({
            where: { id: orgId },
            data: {
                signature_theme: theme as any,
            },
        });

        revalidatePath("/settings/team");
        revalidatePath("/partners");

        return { success: true };
    } catch (error) {
        console.error("Error updating signature theme:", error);
        return { success: false, error: "Failed to update signature theme" };
    }
}

/**
 * Get the organization's signature theme
 */
export async function getSignatureTheme(): Promise<{ success: boolean; theme?: SignatureTheme | null; error?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            include: { assigned_team: true },
        });

        if (!user?.team_id) {
            return { success: false, error: "User is not part of a team" };
        }

        // Find the organization
        const orgId = user.assigned_team?.team_type === "ORGANIZATION"
            ? user.team_id
            : user.assigned_team?.parent_id;

        if (!orgId) {
            return { success: false, error: "Organization not found" };
        }

        const org = await prismadb.team.findUnique({
            where: { id: orgId },
            select: { signature_theme: true },
        });

        return {
            success: true,
            theme: org?.signature_theme as SignatureTheme | null,
        };
    } catch (error) {
        console.error("Error fetching signature theme:", error);
        return { success: false, error: "Failed to fetch signature theme" };
    }
}
