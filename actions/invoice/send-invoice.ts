
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { sendEmailSES } from "@/lib/aws/ses";
import crypto from "crypto";
import { systemLogger } from "@/lib/logger";

export async function sendInvoice(invoiceId: string, email: string) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session || !teamInfo) return { error: "Unauthorized" };

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) return { error: "Invoice not found" };

        if (!validateResourceOwnership(teamInfo.teamId, invoice.team_id, teamInfo.isPlatformAdmin)) {
            return { error: "Forbidden" };
        }

        const paymentLink = invoice.surge_payment_link;
        if (!paymentLink) return { error: "No payment link generated. Enable Crypto Payments first." };

        const userId = session.user.id;
        const targetTeamId = invoice.team_id || teamInfo.teamId;
        const trackingToken = crypto.randomBytes(16).toString("hex");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // CTR Tracking for the payment link
        const trackedPaymentLink = `${baseUrl}/api/email/track/click?token=${trackingToken}&url=${encodeURIComponent(paymentLink)}`;

        // Open Tracking Pixel
        const trackingPixel = `<img src="${baseUrl}/api/email/track/open?token=${trackingToken}" width="1" height="1" style="display:none;" />`;

        // Log Activity to CRM if we can link to a lead within the same tenant
        let targetLeadId = null;
        if (invoice.assigned_account_id) {
            const lead = await prismadb.crm_Leads.findFirst({
                where: {
                    accountsIDs: invoice.assigned_account_id,
                    ...(targetTeamId ? { team_id: targetTeamId } : {}),
                }
            });
            if (lead) targetLeadId = lead.id;
        }

        if (targetLeadId) {
            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: targetLeadId,
                    user: userId,
                    type: "EMAIL",
                    metadata: {
                        subject: `Invoice #${invoice.invoice_number} Payment Link`,
                        trackingToken,
                        recipient: email,
                        invoiceId: invoice.id
                    }
                }
            });

            // Create an Outreach Item for tracking
            let adhocCampaign = await prismadb.crm_Outreach_Campaigns.findFirst({
                where: {
                    name: "Ad-hoc Emails",
                    user: userId,
                    ...(targetTeamId ? { team_id: targetTeamId } : {}),
                }
            });

            if (!adhocCampaign) {
                adhocCampaign = await prismadb.crm_Outreach_Campaigns.create({
                    data: {
                        name: "Ad-hoc Emails",
                        user: userId,
                        team_id: targetTeamId || undefined,
                        status: "ACTIVE",
                        v: 0,
                    }
                });
            }

            await prismadb.crm_Outreach_Items.create({
                data: {
                    campaign: adhocCampaign.id,
                    lead: targetLeadId,
                    channel: "EMAIL",
                    status: "SENT",
                    subject: `Invoice #${invoice.invoice_number} Payment Link`,
                    body_text: `Here is your payment link for Invoice #${invoice.invoice_number}: ${paymentLink}`,
                    body_html: `<p>Here is your payment link for Invoice <strong>#${escapeHtml(invoice.invoice_number)}</strong>:</p><p><a href="${escapeHtml(trackedPaymentLink)}">${escapeHtml(paymentLink)}</a></p>${trackingPixel}`,
                    tracking_token: trackingToken,
                    sentAt: new Date(),
                    v: 0
                }
            });
        }

        // Build rich email HTML with escaped invoice details
        const invoiceNumber = escapeHtml(invoice.invoice_number || invoiceId);
        const invoiceAmount = escapeHtml(invoice.invoice_amount || "0.00");
        const invoiceCurrency = escapeHtml(invoice.invoice_currency || "USD");
        const dueDate = escapeHtml(invoice.date_due ? new Date(invoice.date_due).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Upon Receipt");
        const invoiceStatus = escapeHtml(invoice.payment_status || invoice.status || "UNPAID");
        const partnerName = escapeHtml(invoice.partner || "Valued Client");
        const appName = escapeHtml(process.env.NEXT_PUBLIC_APP_NAME || "BasaltCRM");

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#1e1b4b 0%,#0c0a1a 100%);padding:32px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <p style="margin:0;font-size:11px;letter-spacing:3px;color:#6366f1;font-weight:700;text-transform:uppercase;">INVOICE</p>
                                        <h1 style="margin:8px 0 0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">#${invoiceNumber}</h1>
                                    </td>
                                    <td align="right" valign="top">
                                        <div style="background:${invoiceStatus === 'PAID' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)'};border:1px solid ${invoiceStatus === 'PAID' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'};border-radius:8px;padding:6px 14px;display:inline-block;">
                                            <span style="font-size:11px;font-weight:700;color:${invoiceStatus === 'PAID' ? '#22c55e' : '#eab308'};letter-spacing:1px;text-transform:uppercase;">${invoiceStatus}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Amount Section -->
                    <tr>
                        <td style="padding:32px 40px 24px;">
                            <p style="margin:0 0 4px;font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Amount Due</p>
                            <p style="margin:0;font-size:42px;font-weight:800;color:#ffffff;letter-spacing:-1px;font-family:'Courier New',monospace;">${invoiceAmount} <span style="font-size:18px;color:#71717a;font-weight:600;">${invoiceCurrency}</span></p>
                        </td>
                    </tr>

                    <!-- Details Grid -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:12px;overflow:hidden;">
                                <tr>
                                    <td style="padding:16px 20px;border-bottom:1px solid #27272a;" width="50%">
                                        <p style="margin:0 0 2px;font-size:10px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Billed To</p>
                                        <p style="margin:0;font-size:14px;color:#e4e4e7;font-weight:600;">${partnerName}</p>
                                    </td>
                                    <td style="padding:16px 20px;border-bottom:1px solid #27272a;" width="50%">
                                        <p style="margin:0 0 2px;font-size:10px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Due Date</p>
                                        <p style="margin:0;font-size:14px;color:#e4e4e7;font-weight:600;">${dueDate}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px 20px;" width="50%">
                                        <p style="margin:0 0 2px;font-size:10px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Invoice #</p>
                                        <p style="margin:0;font-size:14px;color:#e4e4e7;font-weight:600;">${invoiceNumber}</p>
                                    </td>
                                    <td style="padding:16px 20px;" width="50%">
                                        <p style="margin:0 0 2px;font-size:10px;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Settlement</p>
                                        <p style="margin:0;font-size:14px;color:#e4e4e7;font-weight:600;">Basalt Surge</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Button -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            <a href="${trackedPaymentLink}" target="_blank" style="display:block;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);color:#ffffff;text-decoration:none;text-align:center;padding:18px 32px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                                Pay ${invoiceAmount} ${invoiceCurrency} Now →
                            </a>
                            <p style="margin:12px 0 0;text-align:center;font-size:11px;color:#52525b;">Secure payment via encrypted settlement layer</p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#0c0c0e;padding:24px 40px;border-top:1px solid #1c1c1f;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <p style="margin:0;font-size:10px;color:#3f3f46;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Powered by ${appName} × Basalt Surge</p>
                                    </td>
                                    <td align="right">
                                        <p style="margin:0;font-size:10px;color:#3f3f46;">SAQ-A Compliant</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    ${trackingPixel}
</body>
</html>`;

        const emailText = `Invoice #${invoiceNumber}\n\nAmount Due: ${invoiceAmount} ${invoiceCurrency}\nBilled To: ${partnerName}\nDue: ${dueDate}\nStatus: ${invoiceStatus}\n\nPay now: ${paymentLink}\n\nSecure payment powered by Basalt Surge.`;

        // Send Email via AWS SES
        try {
            await sendEmailSES({
                to: email,
                subject: `Invoice #${invoiceNumber} — ${invoiceAmount} ${invoiceCurrency} Due`,
                text: emailText,
                html: emailHtml,
            });

            import("@/actions/quests/add-raw-xp")
                .then((m) => m.addRawXP({ userId, xpAmount: 5, reason: "Invoice Sent" }))
                .catch((e) => systemLogger.warn(`[INVOICE_GAMIFICATION] Failed to award XP: ${e?.message}`));

            systemLogger.error(`[SendInvoice] Email sent to ${email} via SES (Tracked)`);
            return { success: true, message: "Email sent with tracking" };
        } catch (sesError: any) {
            systemLogger.error("[SendInvoice] SES Error:", sesError.message);
            return { error: "Failed to send email: " + sesError.message };
        }

    } catch (error) {
        console.error("Send Invoice Error:", error);
        return { error: "Failed to send invoice" };
    }
}
