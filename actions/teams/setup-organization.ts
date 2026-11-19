"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isReservedTeamSlug, normalizeTeamSlug } from "@/lib/security/authz";

export async function setupOrganization(companyName: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return { error: "Unauthorized" };
        }

        const trimmedName = String(companyName || "").trim();
        if (!trimmedName || trimmedName.length < 2) {
            return { error: "A valid organization name is required." };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id }
        });

        if (!user || user.userStatus === "INACTIVE") {
            return { error: "User not found or inactive" };
        }

        // Prevent an existing team member (e.g. VIEWER/MEMBER) from spawning a new org to become OWNER
        if (user.team_id) {
            return { error: "Forbidden: You already belong to an organization." };
        }

        // Normalize and validate company slug
        const baseSlug = normalizeTeamSlug(trimmedName);
        if (!baseSlug) {
            return { error: "Invalid organization name." };
        }

        if (isReservedTeamSlug(trimmedName) || isReservedTeamSlug(baseSlug)) {
            return { error: "This organization name is reserved. Please choose another." };
        }

        let slug = baseSlug;
        let existing = await prismadb.team.findFirst({
            where: { slug: { equals: slug, mode: "insensitive" } },
        });
        let counter = 1;

        // Try to generate unique slug if colliding
        while (existing && counter < 10) {
            slug = `${baseSlug}-${counter}`;
            existing = await prismadb.team.findFirst({
                where: { slug: { equals: slug, mode: "insensitive" } },
            });
            counter++;
        }

        if (existing) {
            return { error: "Company name already taken (slug collision). Please choose another." };
        }

        // Default to STARTER (fallback FREE) plan
        const starterPlan =
            (await prismadb.plan.findFirst({ where: { slug: "STARTER" } })) ||
            (await prismadb.plan.findFirst({ where: { slug: "FREE" } }));
        if (!starterPlan) {
            return { error: "System configuration error: Starter plan not found." };
        }

        // Create the team and associate the owner
        const team = await prismadb.team.create({
            data: {
                name: trimmedName,
                slug,
                plan_id: starterPlan.id,
                subscription_plan: (starterPlan.slug || "STARTER") as any,
                owner_id: user.id,
                status: "ACTIVE",
                members: {
                    connect: { id: user.id }
                }
            }
        });

        // Update the user's team ID and role
        await prismadb.users.update({
            where: { id: user.id },
            data: {
                team_id: team.id,
                team_role: "OWNER"
            }
        });

        // Handle email verification based on whether user has a workspace or freemail address
        const { isFreemailDomain } = await import("@/lib/freemail");
        const isFreemail = isFreemailDomain(user.email);

        if (isFreemail) {
            // Freemail: auto-verify but flag the account so the UI shows a warning
            await prismadb.users.update({
                where: { id: user.id },
                data: { sesEmailVerified: true, isFreemailAccount: true }
            });
        } else {
            // Workspace email: trigger SES verification (ignore failures)
            try {
                const { verifyEmailIdentity } = await import("@/lib/aws/ses-verify");
                await prismadb.teamEmailConfig.create({
                    data: {
                        team_id: team.id,
                        purpose: "GENERAL",
                        provider: "PLATFORM_SES",
                        from_email: user.email,
                        from_name: companyName,
                        verification_status: "PENDING",
                    }
                });
                await verifyEmailIdentity(user.email);
            } catch (err) {
                // Non-blocking
            }
        }

        // Revalidate roots to pick up the new team
        revalidatePath("/");
        revalidatePath("/setup");

        // Force a session refresh event by sending a success flag to the client
        return { success: true, newTeamId: team.id };
    } catch (error) {
        console.error("[SETUP_ORGANIZATION]", error);
        return { error: "An unexpected error occurred while setting up your organization." };
    }
}
