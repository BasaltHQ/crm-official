import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/api-auth-guard";

/**
 * GET /api/cron/auto-followup
 *
 * Automated follow-up cron (runs hourly).
 * Finds outreach items where:
 * 1. Status is SENT or OPENED (no reply)
 * 2. The follow-up delay has elapsed (sentAt + campaign.followup_delay_hours < now)
 * 3. followup_count < campaign.followup_max_count
 * 4. Lead is not unsubscribed or replied
 * 5. Campaign has followup_enabled=true
 *
 * For each eligible item, calls the existing followup endpoint logic.
 */
export async function GET(req: Request) {
  try {
    const cronAuth = requireCronAuth(req);
    if (cronAuth instanceof Response) return cronAuth;

    const now = new Date();
    let processed = 0;
    let errors = 0;

    // Find campaigns with follow-up enabled
    const campaigns = await prismadb.crm_Outreach_Campaigns.findMany({
      where: {
        followup_enabled: true,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: {
        id: true,
        followup_delay_hours: true,
        followup_max_count: true,
        followup_prompt: true,
        user: true,
        team_id: true,
      },
    });

    for (const campaign of campaigns) {
      const delayMs = (campaign.followup_delay_hours || 72) * 60 * 60 * 1000;
      const maxFollowups = campaign.followup_max_count || 2;
      const cutoffDate = new Date(now.getTime() - delayMs);

      // Find eligible outreach items
      const eligibleItems = await prismadb.crm_Outreach_Items.findMany({
        where: {
          campaign: campaign.id,
          status: { in: ["SENT", "DELIVERED"] },
          sentAt: { lte: cutoffDate },
          followup_count: { lt: maxFollowups },
          unsubscribed_at: null,
          repliedAt: null,
        },
        select: {
          id: true,
          lead: true,
          candidate_email: true,
          candidate_name: true,
          subject: true,
          followup_count: true,
        },
        take: 50, // Process in batches of 50 to avoid timeout
      });

      for (const item of eligibleItems) {
        try {
          if (!item.lead) continue;

          // Check if lead is still eligible (not unsubscribed, not replied, not opted out)
          const lead = await prismadb.crm_Leads.findUnique({
            where: { id: item.lead },
            select: {
              id: true,
              email: true,
              outreach_status: true,
              opt_out: true,
              firstName: true,
              lastName: true,
              company: true,
            },
          });

          if (!lead || !lead.email) continue;
          if (lead.opt_out) continue;
          if (["REPLIED_POSITIVE", "REPLIED_NEGATIVE", "UNSUBSCRIBED", "CONVERTED", "CLOSED"].includes(lead.outreach_status || "")) {
            continue;
          }

          // Call the existing followup endpoint internally
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
          const followupRes = await fetch(`${baseUrl}/api/outreach/followup/${lead.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-cron-secret": process.env.CRON_SECRET || "",
            },
            body: JSON.stringify({
              campaignId: campaign.id,
              followupNumber: item.followup_count + 1,
              customPrompt: campaign.followup_prompt || undefined,
            }),
          });

          if (followupRes.ok) {
            // Update item with next follow-up schedule
            const nextFollowupAt = new Date(now.getTime() + delayMs);
            await prismadb.crm_Outreach_Items.update({
              where: { id: item.id },
              data: {
                followup_count: { increment: 1 },
                next_followup_at: item.followup_count + 1 < maxFollowups ? nextFollowupAt : null,
              },
            });

            processed++;
            systemLogger.info(
              `[AUTO_FOLLOWUP] Sent followup #${item.followup_count + 1} for lead ${lead.id} (campaign: ${campaign.id})`
            );
          } else {
            const errText = await followupRes.text().catch(() => "Unknown error");
            systemLogger.warn(`[AUTO_FOLLOWUP] Followup failed for lead ${lead.id}: ${errText}`);
            errors++;
          }
        } catch (itemErr: any) {
          systemLogger.error(`[AUTO_FOLLOWUP] Error processing item ${item.id}: ${itemErr?.message}`);
          errors++;
        }
      }
    }

    systemLogger.info(`[AUTO_FOLLOWUP] Completed: processed=${processed}, errors=${errors}`);

    return NextResponse.json({
      success: true,
      processed,
      errors,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    systemLogger.error("[AUTO_FOLLOWUP] Cron failed:", error?.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
