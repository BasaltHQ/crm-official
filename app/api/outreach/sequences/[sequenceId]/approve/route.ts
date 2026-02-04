import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm as prisma } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/outreach/sequences/[sequenceId]/approve
 * Approves a sequence that is in PENDING_APPROVAL status
 * Admin only
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { sequenceId } = await params;

        // Check if user is admin
        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: {
                is_admin: true,
                is_account_admin: true,
                assigned_role: { select: { name: true } },
            },
        });

        const isSuperAdmin = user?.assigned_role?.name === "SuperAdmin";
        const isAdmin = user?.is_admin || user?.is_account_admin;

        if (!isSuperAdmin && !isAdmin) {
            return NextResponse.json(
                { message: "Only admins can approve sequences" },
                { status: 403 }
            );
        }

        // Get campaign
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
        });

        if (!campaign) {
            return NextResponse.json(
                { message: "Sequence not found" },
                { status: 404 }
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
        console.error("[CAMPAIGN_APPROVE_POST]", error);
        return NextResponse.json(
            { message: error.message || "Failed to approve sequence" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/outreach/sequences/[sequenceId]/approve
 * Rejects a sequence that is in PENDING_APPROVAL status
 * Admin only
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { sequenceId } = await params;

        // Check if user is admin
        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: {
                is_admin: true,
                is_account_admin: true,
                assigned_role: { select: { name: true } },
            },
        });

        const isSuperAdmin = user?.assigned_role?.name === "SuperAdmin";
        const isAdmin = user?.is_admin || user?.is_account_admin;

        if (!isSuperAdmin && !isAdmin) {
            return NextResponse.json(
                { message: "Only admins can reject sequences" },
                { status: 403 }
            );
        }

        // Get campaign
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
        });

        if (!campaign) {
            return NextResponse.json(
                { message: "Sequence not found" },
                { status: 404 }
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
        console.error("[CAMPAIGN_REJECT_DELETE]", error);
        return NextResponse.json(
            { message: error.message || "Failed to reject sequence" },
            { status: 500 }
        );
    }
}
