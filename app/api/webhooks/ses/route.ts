import { NextResponse } from 'next/server';
import { prismadb } from '@/lib/prisma';
import { systemLogger } from '@/lib/logger';
import { verifyAndConfirmSnsRequest } from '@/lib/security/sns-verify';

export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        const snsCheck = await verifyAndConfirmSnsRequest(bodyText);
        if (!snsCheck.valid) {
            systemLogger.warn(`[SES_WEBHOOK] Rejected unverified SNS request: ${snsCheck.error}`);
            return NextResponse.json({ error: snsCheck.error || 'Unauthorized' }, { status: 401 });
        }
        if (snsCheck.confirmed) {
            systemLogger.info('[SES_WEBHOOK] Successfully confirmed SNS subscription');
            return NextResponse.json({ success: true, confirmed: true });
        }

        const snsPayload = snsCheck.payload!;

        if (snsPayload.Type === 'Notification') {
            const sesEvent = JSON.parse(snsPayload.Message);

            if (sesEvent.notificationType === 'Complaint' || sesEvent.notificationType === 'Bounce') {
                const type = sesEvent.notificationType; // 'Complaint' or 'Bounce'
                const statusStr = type === 'Complaint' ? 'complained' : 'bounced';
                
                const recipients = type === 'Complaint' ? sesEvent.complaint.complainedRecipients : sesEvent.bounce.bouncedRecipients;
                
                for (const r of recipients) {
                    const email = r.emailAddress;
                    if (!email) continue;
                    
                    systemLogger.info(`[SES_WEBHOOK] Processing ${type} for email: ${email}`);

                    // Update Contacts
                    await prismadb.crm_Contacts.updateMany({
                        where: { email },
                        data: {
                            email_status: statusStr,
                            email_unsubscribed: type === 'Complaint' ? true : undefined,
                        }
                    });

                    // Update Leads
                    await prismadb.crm_Leads.updateMany({
                        where: { email },
                        data: {
                            email_status: statusStr,
                        }
                    });
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        systemLogger.error(`[SES_WEBHOOK] Error processing webhook: ${err.message}`);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
