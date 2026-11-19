import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { createStripeCheckoutSession, createStripeTopUpSession } from "@/lib/stripe";
import { systemLogger } from "@/lib/logger";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { isSelfServicePlanSlug } from "@/lib/security/authz";

/**
 * POST /api/billing/stripe/checkout
 * 
 * Creates a Stripe Checkout Session for:
 * - Subscription plans (planSlug + interval)
 * - One-time AI token top-ups (topUp: true)
 * 
 * Returns { url: string } to redirect the user to Stripe Checkout.
 */
export async function POST(req: Request) {
    try {
        const [session, teamInfo] = await Promise.all([
            getServerSession(authOptions),
            getCurrentUserTeamId(),
        ]);
        if (!session?.user?.id || !teamInfo?.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!teamInfo.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Team admin required" }, { status: 403 });
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { email: true },
        });

        const rawTeam = await prismadb.team.findUnique({
            where: { id: teamInfo.teamId },
            select: { id: true, name: true, parent_id: true, team_type: true },
        });

        if (!rawTeam || !user?.email) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const billingTeam =
            rawTeam.team_type === "DEPARTMENT" && rawTeam.parent_id
                ? await prismadb.team.findUnique({
                      where: { id: rawTeam.parent_id },
                      select: { id: true, name: true },
                  })
                : rawTeam;

        if (!billingTeam) {
            return NextResponse.json({ error: "Billing organization not found" }, { status: 400 });
        }

        const body = await req.json();
        const { planSlug, interval = "monthly", topUp = false, quantity = 1 } = body;
        const safeInterval: "monthly" | "annual" = interval === "annual" ? "annual" : "monthly";
        const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

        let checkoutSession;

        if (topUp) {
            // AI Token Top-Up (one-time payment)
            checkoutSession = await createStripeTopUpSession(
                billingTeam.id,
                user.email,
                billingTeam.name
            );
        } else {
            // Subscription checkout — restrict strictly to self-service plans
            if (!planSlug || !isSelfServicePlanSlug(planSlug)) {
                return NextResponse.json(
                    { error: "Invalid or restricted plan selected" },
                    { status: 400 }
                );
            }

            checkoutSession = await createStripeCheckoutSession(
                billingTeam.id,
                user.email,
                String(planSlug).trim().toUpperCase(),
                safeInterval,
                billingTeam.name,
                safeQuantity
            );
        }

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        systemLogger.error("[STRIPE_CHECKOUT_API]", error);
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
