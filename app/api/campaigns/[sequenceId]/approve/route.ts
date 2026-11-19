import { NextResponse } from "next/server";
import { prismadbCrm as prisma } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/campaigns/[sequenceId]/approve
 * Approves a sequence that is in PENDING_APPROVAL status
 * Admin only (within the campaign's tenant)
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
            return NextResponse.json(
                { message: "Only admins can approve sequences" },
                { status: 403 }
            );
        }

        const { sequenceId } = await params;

        // Get campaign and verify tenant ownership
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
        });

        if (!campaign) {
            return NextResponse.json(
                { message: "Sequence not found" },
                { status: 404 }
            );
        }

        if (!validateResourceOwnership(teamInfo!.teamId, campaign.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json(
                { message: "Forbidden" },
                { status: 403 }
            );
        }

        if (campaign.status !== "PENDING_APPROVAL") {
            return NextResponse.json(
                { message: "Sequence is not pending approval" },
                { status: 400 }
            );
        }

        // Approve campaign - set to ACTIVE
        const updated = await prisma.crm_Outreach_Campaigns.update({
            where: { id: sequenceId },
            data: {
                status: "ACTIVE",
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            id: updated.id,
            status: updated.status,
            message: "Sequence approved successfully",
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_APPROVE_POST]", error);
        return NextResponse.json(
            { message: error.message || "Failed to approve sequence" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/[sequenceId]/approve
 * Rejects a sequence that is in PENDING_APPROVAL status
 * Admin only (within the campaign's tenant)
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
            return NextResponse.json(
                { message: "Only admins can reject sequences" },
                { status: 403 }
            );
        }

        const { sequenceId } = await params;

        // Get campaign and verify tenant ownership
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
        });

        if (!campaign) {
            return NextResponse.json(
                { message: "Sequence not found" },
                { status: 404 }
            );
        }

        if (!validateResourceOwnership(teamInfo!.teamId, campaign.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json(
                { message: "Forbidden" },
                { status: 403 }
            );
        }

        if (campaign.status !== "PENDING_APPROVAL") {
            return NextResponse.json(
                { message: "Sequence is not pending approval" },
                { status: 400 }
            );
        }

        // Reject campaign - set back to DRAFT
        const updated = await prisma.crm_Outreach_Campaigns.update({
            where: { id: sequenceId },
            data: {
                status: "DRAFT",
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({
            id: updated.id,
            status: updated.status,
            message: "Sequence rejected and set back to draft",
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_REJECT_DELETE]", error);
        return NextResponse.json(
            { message: error.message || "Failed to reject sequence" },
            { status: 500 }
        );
    }
}
