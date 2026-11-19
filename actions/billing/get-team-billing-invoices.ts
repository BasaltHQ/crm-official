"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { systemLogger } from "@/lib/logger";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";

/**
 * Get billing invoices for a specific team.
 * Used by platform admins on /partners or team members for their own team.
 */
export async function getTeamBillingInvoices(teamId: string) {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId) return [];

        if (teamInfo.teamId !== teamId && !teamInfo.isPlatformAdmin) {
            const admin = await requirePlatformAdmin();
            if (!admin) return [];
        }

        // diverse-safety-check: ensure the model exists on the runtime client (handling dev-mode stale client)
        if (!(prismadb as any).crm_BillingInvoice) {
            console.warn("Prisma Client is stale. crm_BillingInvoice model not found. Please restart the server.");
            return [];
        }

        const invoices = await (prismadb as any).crm_BillingInvoice.findMany({
            where: { tenant_id: teamId },
            include: {
                subscription: {
                    select: {
                        plan_name: true,
                        interval: true,
                        customer_wallet: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return invoices;
    } catch (error) {
        systemLogger.error("[GET_TEAM_BILLING_INVOICES]", error);
        return [];
    }
}

/**
 * Get billing invoices for the current user's team.
 * Used by team admins on /admin billing tab.
 */
export async function getMyTeamBillingInvoices() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return [];

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { team_id: true }
        });

        if (!user?.team_id) return [];

        // diverse-safety-check: ensure the model exists on the runtime client (handling dev-mode stale client)
        if (!(prismadb as any).crm_BillingInvoice) {
            console.warn("Prisma Client is stale. crm_BillingInvoice model not found. Please restart the server.");
            return [];
        }

        const invoices = await (prismadb as any).crm_BillingInvoice.findMany({
            where: { tenant_id: user.team_id },
            include: {
                subscription: {
                    select: {
                        plan_name: true,
                        interval: true,
                        customer_wallet: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return invoices;
    } catch (error) {
        systemLogger.error("[GET_MY_TEAM_BILLING_INVOICES]", error);
        return [];
    }
}

/**
 * Get all billing invoices across all teams.
 * Used by platform admins on /partners billing history.
 */
export async function getAllBillingInvoices() {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) return [];

        // diverse-safety-check: ensure the model exists on the runtime client (handling dev-mode stale client)
        if (!(prismadb as any).crm_BillingInvoice) {
            console.warn("Prisma Client is stale. crm_BillingInvoice model not found. Please restart the server.");
            return [];
        }

        const invoices = await (prismadb as any).crm_BillingInvoice.findMany({
            include: {
                team: {
                    select: {
                        name: true,
                        slug: true,
                    }
                },
                subscription: {
                    select: {
                        plan_name: true,
                        interval: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return invoices;
    } catch (error) {
        systemLogger.error("[GET_ALL_BILLING_INVOICES]", error);
        return [];
    }
}
