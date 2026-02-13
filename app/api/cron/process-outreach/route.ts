import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { sendEmailSES } from "@/lib/aws/ses";
import { OutreachItemStatus } from "@prisma/client";
import { requireCronAuth } from "@/lib/api-auth-guard";

export const maxDuration = 60; // Allow 1 minute max for this cron execution

export async function GET(req: Request) {
    // ── Cron auth guard ──
    const cronAuth = requireCronAuth(req);
    if (cronAuth instanceof Response) return cronAuth;
    try {
        // 2. Fetch Pending Items (Limit 50 to avoid timeout)
        const pendingItems = await prismadb.crm_Outreach_Items.findMany({
            where: {
                status: "PENDING",
            },
            take: 50,
            include: {
                assigned_campaign: {
                    select: {
                        id: true,
                        name: true,
                        team_id: true,
                    }
                },
                assigned_lead: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        });

        if (pendingItems.length === 0) {
            return NextResponse.json({ message: "No pending emails to process", processed: 0 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // 3. Process Batch
        for (const item of pendingItems) {
            try {
                if (!item.assigned_lead?.email) {
                    throw new Error("Lead has no email");
                }

                // Determine Sender Identity
                let fromAddress = process.env.SES_FROM_ADDRESS; // Default System Address

                if (item.assigned_campaign?.team_id) {
                    // Check for Team Custom Email
                    const teamConfig = await prismadb.teamEmailConfig.findUnique({
                        where: { team_id: item.assigned_campaign.team_id }
                    });

                    // Only use if explicitly VERIFIED
                    if (teamConfig && teamConfig.verification_status === "VERIFIED") {
                        fromAddress = teamConfig.from_email;
                    }
                }

                if (!fromAddress) {
                    throw new Error("No valid sender address available");
                }

                // Prepare Content 
                // (In a real scenario, we might render dynamic content here if not already rendered)
                // Assuming body_html or body_text is ready in the item
                const subject = item.subject || "No Subject";
                const html = item.body_html || item.body_text || "";

                // Send via SES
                const sesResult = await sendEmailSES({
                    to: item.assigned_lead.email,
                    from: fromAddress,
                    subject: subject,
                    html: html,
                    text: item.body_text || undefined,
                    // replyTo: ... (could add reply threading later)
                });

                // Update Status: SENT
                await prismadb.crm_Outreach_Items.update({
                    where: { id: item.id },
                    data: {
                        status: "SENT",
                        sentAt: new Date(),
                        message_id: sesResult.messageId,
                        error_message: null
                    }
                });

                // Log Activity
                await prismadb.crm_Lead_Activities.create({
                    data: {
                        lead: item.assigned_lead.id,
                        type: "EMAIL_SENT",
                        metadata: {
                            campaignId: item.assigned_campaign?.id,
                            messageId: sesResult.messageId,
                            subject: subject
                        }
                    }
                });

                results.success++;

            } catch (error: any) {
                console.error(`Failed to send item ${item.id}:`, error);
                results.failed++;
                results.errors.push(error.message);

                // Update Status: FAILED (with retry count logic potentially)
                await prismadb.crm_Outreach_Items.update({
                    where: { id: item.id },
                    data: {
                        status: "FAILED", // Could use PENDING + retry_count increase
                        error_message: error.message
                    }
                });
            }
        }

        return NextResponse.json({
            message: "Batch processed",
            processed: pendingItems.length,
            ...results
        });

    } catch (error: any) {
        console.error("Critical error in outreach processor:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
