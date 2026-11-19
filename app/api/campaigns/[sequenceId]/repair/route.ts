import { NextResponse } from "next/server";
import { prismadbCrm as prisma } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { sequenceId } = await params;

        // 1. Fetch the campaign
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
            include: {
                outreach_items: {
                    select: { lead: true, candidate_email: true, status: true },
                },
            },
        });

        if (!campaign) {
            return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, campaign.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && campaign.user !== session!.user.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        if (!campaign.pool) {
            return NextResponse.json({ message: "Campaign has no assigned pool to repair from" }, { status: 400 });
        }

        // 2. Fetch all leads from the pool using trusted base URL (never untrusted Host header)
        const baseAppUrl = (
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXTAUTH_URL ||
            "http://localhost:3000"
        ).replace(/\/$/, "");
        const poolUrl = `${baseAppUrl}/api/crm/leads/pools/${encodeURIComponent(campaign.pool)}/leads?mine=false`;
        
        const cookie = req.headers.get("cookie") || "";

        const poolRes = await fetch(poolUrl, {
            headers: { cookie },
        });

        if (!poolRes.ok) {
            return NextResponse.json({ message: "Failed to fetch pool leads for repair" }, { status: 500 });
        }

        const poolData = await poolRes.json();
        const poolLeads = Array.isArray(poolData?.leads) ? poolData.leads : [];

        // 3. Resolve the best available email for every pool lead
        const validPoolLeads = poolLeads.map((l: any) => {
            if (l.email) return l;
            const fallback = l.accountEmail || (l.accountAdditionalEmails && l.accountAdditionalEmails.length > 0 ? l.accountAdditionalEmails[0] : null);
            if (fallback) return { ...l, email: fallback };
            return l;
        }).filter((l: any) => !!l.email);

        // 4. Identify which leads are missing from the campaign
        const existingLeadIds = new Set(campaign.outreach_items.map((i: any) => i.lead));
        const missingLeads = validPoolLeads.filter((l: any) => !existingLeadIds.has(l.id));

        if (missingLeads.length === 0) {
            return NextResponse.json({ message: "No missing leads found. Campaign is already up to date.", count: 0 }, { status: 200 });
        }

        // 5. Build payload and trigger the send route
        // We need to trigger `/api/outreach/send` with the missing leads.
        const sendPayload = {
            leadIds: missingLeads.map((l: any) => l.id),
            // Need inline lead data so the send route can use the resolved fallback emails
            leadData: missingLeads.map((l: any) => ({
                id: l.id,
                firstName: l.firstName,
                lastName: l.lastName,
                company: l.company,
                jobTitle: l.jobTitle,
                email: l.email,
                additional_emails: l.additional_emails || l.accountAdditionalEmails || [],
            })),
            campaignId: campaign.id,
            poolId: campaign.pool,
            promptOverride: campaign.prompt_override || undefined,
            brandId: campaign.campaign_branding?.id || undefined,
            templateId: "minimal", // Default to minimal since template isn't stored in DB
            senderMode: "company",
            signatureSource: "brand",
        };

        const sendUrl = `${baseAppUrl}/api/outreach/send`;
        const sendRes = await fetch(sendUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                cookie,
            },
            body: JSON.stringify(sendPayload),
        });

        if (!sendRes.ok) {
            const err = await sendRes.text();
            systemLogger.error("[CAMPAIGN_REPAIR] Send failed:", err);
            return NextResponse.json({ message: "Failed to dispatch repair emails" }, { status: 500 });
        }

        return NextResponse.json({
            message: `Successfully repaired campaign. Dispatching ${missingLeads.length} missed leads.`,
            count: missingLeads.length,
        }, { status: 200 });

    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_REPAIR]", error);
        return NextResponse.json(
            { message: error.message || "Failed to repair campaign" },
            { status: 500 }
        );
    }
}
