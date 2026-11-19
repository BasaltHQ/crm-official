import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { createSurgeCheckoutSession } from "@/lib/surge";
import { systemLogger } from "@/lib/logger";
import {
    SUBSCRIPTION_PLANS,
    SubscriptionPlanType,
    AI_TOKEN_TOPUP,
    SURGE_DISCOUNT_PERCENT,
    getMonthlyPrice,
    getAnnualPrice,
    getSurgePrice,
} from "@/config/subscriptions";
import { addMonths, addYears } from "date-fns";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { isSelfServicePlanSlug } from "@/lib/security/authz";

/**
 * POST /api/billing/surge/checkout
 *
 * Creates a BasaltSurge payment session for:
 * - Subscription plans (manual monthly payment with 5% discount)
 * - One-time AI token top-ups (5% discount)
 *
 * Returns { url: string } to redirect the user to Surge payment portal.
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

        const rawTeam = await prismadb.team.findUnique({
            where: { id: teamInfo.teamId },
            select: { id: true, parent_id: true, team_type: true },
        });

        if (!rawTeam) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const billingTeamId =
            rawTeam.team_type === "DEPARTMENT" && rawTeam.parent_id
                ? rawTeam.parent_id
                : rawTeam.id;

        const body = await req.json();
        const { planSlug, interval = "monthly", topUp = false } = body;
        const safeInterval: "monthly" | "annual" = interval === "annual" ? "annual" : "monthly";

        let amount: number;
        let description: string;
        let periodEnd: Date;
        const now = new Date();

        if (topUp) {
            // AI Token Top-Up with Surge discount
            amount = getSurgePrice(AI_TOKEN_TOPUP.price);
            description = `AI Token Top-Up: ${(AI_TOKEN_TOPUP.tokens / 1_000_000).toFixed(0)}M tokens (Surge — ${SURGE_DISCOUNT_PERCENT}% off)`;
            periodEnd = now;
        } else {
            // Subscription payment with Surge discount — strictly enforce self-service plans
            if (!planSlug || !isSelfServicePlanSlug(planSlug)) {
                return NextResponse.json({ error: "Invalid or restricted plan" }, { status: 400 });
            }

            const canonicalSlug = String(planSlug).trim().toUpperCase() as SubscriptionPlanType;
            const basePrice = safeInterval === "annual"
                ? getAnnualPrice(canonicalSlug)
                : getMonthlyPrice(canonicalSlug);

            amount = getSurgePrice(basePrice);
            const plan = SUBSCRIPTION_PLANS[canonicalSlug];
            description = `${plan.name} — ${safeInterval === "annual" ? "Annual" : "Monthly"} (Surge — ${SURGE_DISCOUNT_PERCENT}% off)`;
            periodEnd = safeInterval === "annual" ? addYears(now, 1) : addMonths(now, 1);
        }

        // Create an invoice in the DB
        const invoiceNumber = `INV-SURGE-${Date.now().toString(36).toUpperCase()}`;
        const invoice = await prismadb.invoices.create({
            data: {
                assigned_team: { connect: { id: billingTeamId } },
                users: { connect: { id: session.user.id } },
                invoice_number: invoiceNumber,
                invoice_amount: amount.toString(),
                invoice_currency: "USD",
                invoice_type: topUp ? "AI_TOPUP" : "SUBSCRIPTION",
                description,
                status: "UNPAID",
                payment_status: "UNPAID",
                invoice_file_mimeType: "application/pdf",
                invoice_file_url: "",
            },
        });

        // Create Surge checkout session using platform Surge keys
        const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/billing`;

        const surgeSession = await createSurgeCheckoutSession(
            billingTeamId,
            invoice,
            returnUrl,
            { forcePlatformKeys: true }
        );

        if (!surgeSession?.url) {
            return NextResponse.json(
                { error: "Failed to create Surge payment session. Check Surge integration settings." },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: surgeSession.url });
    } catch (error) {
        systemLogger.error("[SURGE_CHECKOUT_API]", error);
        return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
}
