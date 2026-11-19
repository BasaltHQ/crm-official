/**
 * Portal SMS Notification API
 * Sends "You have a new message" SMS with magic link to portal
 * Integrated with 10DLC-compliant SMS sending
 */

import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { sendSmsEum } from "@/lib/aws/eum-sms";
import crypto from "crypto";
import { systemLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const body = await req.json();
        const { portalId, messageId, recipientIds } = body;

        if (!portalId || !messageId) {
            return NextResponse.json({ error: "Missing portalId or messageId" }, { status: 400 });
        }

        // Get the portal
        const portal = await prismadb.crm_Message_Portal.findUnique({
            where: { id: portalId },
        });

        if (!portal) {
            return NextResponse.json({ error: "Portal not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, portal.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Get the message and verify it belongs to this portal
        const message = await prismadb.crm_Portal_Message.findUnique({
            where: { id: messageId },
        });

        if (!message || message.portal !== portal.id) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        // Get recipients - either specified or all portal recipients
        let recipients;
        if (recipientIds?.length) {
            recipients = await prismadb.crm_Portal_Recipient.findMany({
                where: {
                    id: { in: recipientIds },
                    portal: portalId,
                    is_opted_out: false,
                },
            });
        } else {
            recipients = await prismadb.crm_Portal_Recipient.findMany({
                where: {
                    portal: portalId,
                    is_opted_out: false,
                },
            });
        }

        const results: { recipientId: string; success: boolean; error?: string }[] = [];
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.basalt.ai";

        for (const recipient of recipients) {
            if (!recipient.phone) {
                results.push({ recipientId: recipient.id, success: false, error: "No phone number" });
                continue;
            }

            // Create the message-recipient link
            const messageLink = await prismadb.crm_Portal_Message_Recipient.upsert({
                where: {
                    message_recipient: {
                        message: messageId,
                        recipient: recipient.id,
                    },
                },
                create: {
                    message: messageId,
                    recipient: recipient.id,
                },
                update: {},
            });

            // Build the portal link
            const portalLink = `${baseUrl}/portal/${portal.portal_slug}/m/${recipient.access_token}`;

            // Build the SMS message
            const smsText = buildNotificationSms(
                recipient.first_name,
                message.sender_name || portal.portal_name || "BasaltCRM",
                portalLink
            );

            // Send the SMS
            try {
                const smsRes = await sendSmsEum({ to: recipient.phone, body: smsText });
                const smsResult = Object.values(smsRes.results)[0];

                // Update the message-recipient link with SMS status
                await prismadb.crm_Portal_Message_Recipient.update({
                    where: { id: messageLink.id },
                    data: {
                        sms_sent: true,
                        sms_sent_at: new Date(),
                        sms_message_id: smsResult?.messageId,
                        sms_status: smsResult?.messageId ? "sent" : "failed",
                    },
                });

                results.push({
                    recipientId: recipient.id,
                    success: !!smsResult?.messageId,
                    error: smsResult?.messageId ? undefined : "SMS send failed"
                });
            } catch (err: any) {
                results.push({
                    recipientId: recipient.id,
                    success: false,
                    error: err.message
                });
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            sent: successful,
            failed,
            results,
        });
    } catch (err: any) {
        systemLogger.error("[Portal SMS] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function buildNotificationSms(
    firstName: string | null,
    senderName: string,
    portalLink: string
): string {
    const greeting = firstName ? `${firstName}, you` : "You";
    return `${greeting} have a new message from ${senderName}. View it here: ${portalLink} Reply STOP to unsubscribe.`;
}

/**
 * Create a new portal recipient and get their access token
 */
async function createPortalRecipient(
    portalId: string,
    leadId: string | null,
    email: string,
    phone: string | null,
    firstName: string | null,
    lastName: string | null,
    company: string | null
): Promise<string> {
    // Generate a unique access token
    const accessToken = crypto.randomBytes(16).toString("hex");

    const recipient = await prismadb.crm_Portal_Recipient.upsert({
        where: {
            portal_email: {
                portal: portalId,
                email: email,
            },
        },
        create: {
            portal: portalId,
            lead: leadId,
            email,
            phone,
            access_token: accessToken,
            first_name: firstName,
            last_name: lastName,
            company,
        },
        update: {
            phone,
            first_name: firstName,
            last_name: lastName,
            company,
        },
    });

    return recipient.access_token;
}
