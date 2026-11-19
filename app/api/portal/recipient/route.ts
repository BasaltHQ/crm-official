/**
 * Portal Recipient Management API
 * Add, list, and manage portal recipients (from leads)
 */

import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import crypto from "crypto";
import { systemLogger } from "@/lib/logger";

// GET - List recipients for a portal
export async function GET(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const portalId = searchParams.get("portalId");

        if (!portalId) {
            return NextResponse.json({ error: "portalId is required" }, { status: 400 });
        }

        const portal = await prismadb.crm_Message_Portal.findUnique({
            where: { id: portalId },
            select: { id: true, team_id: true },
        });
        if (!portal) {
            return NextResponse.json({ error: "Portal not found" }, { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, portal.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const recipients = await (prismadb as any).crm_Portal_Recipient.findMany({
            where: { portal: portalId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ recipients });
    } catch (err: any) {
        systemLogger.error("[Portal Recipient API] GET Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST - Add recipients from leads
export async function POST(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const body = await req.json();
        const { portalId, leadIds, recipients: manualRecipients } = body;

        if (!portalId) {
            return NextResponse.json({ error: "portalId is required" }, { status: 400 });
        }

        const portal = await prismadb.crm_Message_Portal.findUnique({
            where: { id: portalId },
            select: { id: true, team_id: true },
        });
        if (!portal) {
            return NextResponse.json({ error: "Portal not found" }, { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, portal.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const results: { id: string; email: string; created: boolean; error?: string }[] = [];

        // Add recipients from lead IDs (strictly scoped to portal's team_id)
        if (leadIds?.length) {
            const targetTeamId = portal.team_id || teamInfo!.teamId;
            const leads = await prismadb.crm_Leads.findMany({
                where: {
                    id: { in: leadIds },
                    ...(targetTeamId ? { team_id: targetTeamId } : {}),
                },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    company: true,
                },
            });

            for (const lead of leads) {
                if (!lead.email) {
                    results.push({ id: lead.id, email: "", created: false, error: "No email" });
                    continue;
                }

                try {
                    const accessToken = crypto.randomBytes(16).toString("hex");

                    const recipient = await (prismadb as any).crm_Portal_Recipient.upsert({
                        where: {
                            portal_email: {
                                portal: portalId,
                                email: lead.email,
                            },
                        },
                        create: {
                            portal: portalId,
                            lead: lead.id,
                            email: lead.email,
                            phone: lead.phone,
                            access_token: accessToken,
                            first_name: lead.firstName,
                            last_name: lead.lastName,
                            company: lead.company,
                        },
                        update: {
                            phone: lead.phone,
                            first_name: lead.firstName,
                            last_name: lead.lastName,
                            company: lead.company,
                        },
                    });

                    results.push({ id: recipient.id, email: lead.email, created: true });
                } catch (err: any) {
                    results.push({ id: lead.id, email: lead.email, created: false, error: err.message });
                }
            }
        }

        // Add manual recipients
        if (manualRecipients?.length) {
            for (const r of manualRecipients) {
                if (!r.email) continue;

                try {
                    const accessToken = crypto.randomBytes(16).toString("hex");

                    const recipient = await (prismadb as any).crm_Portal_Recipient.upsert({
                        where: {
                            portal_email: {
                                portal: portalId,
                                email: r.email,
                            },
                        },
                        create: {
                            portal: portalId,
                            email: r.email,
                            phone: r.phone || null,
                            access_token: accessToken,
                            first_name: r.firstName || null,
                            last_name: r.lastName || null,
                            company: r.company || null,
                        },
                        update: {
                            phone: r.phone || undefined,
                            first_name: r.firstName || undefined,
                            last_name: r.lastName || undefined,
                            company: r.company || undefined,
                        },
                    });

                    results.push({ id: recipient.id, email: r.email, created: true });
                } catch (err: any) {
                    results.push({ id: "", email: r.email, created: false, error: err.message });
                }
            }
        }

        const created = results.filter(r => r.created).length;
        const failed = results.filter(r => !r.created).length;

        return NextResponse.json({
            success: true,
            created,
            failed,
            results,
        });
    } catch (err: any) {
        systemLogger.error("[Portal Recipient API] POST Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE - Remove a recipient (opt-out)
export async function DELETE(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const recipientId = searchParams.get("recipientId");

        if (!recipientId) {
            return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
        }

        const existingRecipient = await (prismadb as any).crm_Portal_Recipient.findUnique({
            where: { id: recipientId },
            select: { id: true, portal: true },
        });
        if (!existingRecipient) {
            return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }

        const portal = await prismadb.crm_Message_Portal.findUnique({
            where: { id: existingRecipient.portal },
            select: { id: true, team_id: true },
        });
        if (!portal || !validateResourceOwnership(teamInfo!.teamId, portal.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Soft delete - mark as opted out
        await (prismadb as any).crm_Portal_Recipient.update({
            where: { id: recipientId },
            data: {
                is_opted_out: true,
                opted_out_at: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        systemLogger.error("[Portal Recipient API] DELETE Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
