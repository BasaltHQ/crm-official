import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

type Params = { params: Promise<{ accountId: string }> };

export async function GET(_req: Request, { params }: Params) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { accountId } = await params;
        if (!accountId) return new NextResponse("Missing accountId", { status: 400 });

        // Find the account and verify tenant ownership
        const account = await prismadb.crm_Accounts.findUnique({
            where: { id: accountId },
            select: { id: true, team_id: true, email: true, additional_emails: true },
        });
        if (!account) {
            return new NextResponse("Account not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, account.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const accountEmails: string[] = [];
        if (account.email) accountEmails.push(account.email);
        if (account.additional_emails) accountEmails.push(...(account.additional_emails as string[]));

        const targetTeamFilter = account.team_id ? { team_id: account.team_id } : {};

        // Find all leads linked to this account within the same tenant
        const leads = await prismadb.crm_Leads.findMany({
            where: { accountsIDs: accountId, ...targetTeamFilter },
            select: { id: true },
        });

        const leadIds = leads.map((l: { id: string }) => l.id);

        // Also find leads by email match within the same tenant
        if (accountEmails.length > 0) {
            const leadsByEmail = await prismadb.crm_Leads.findMany({
                where: { email: { in: accountEmails }, ...targetTeamFilter },
                select: { id: true },
            });
            leadsByEmail.forEach((l: { id: string }) => {
                if (!leadIds.includes(l.id)) leadIds.push(l.id);
            });
        }

        // Find outreach items linked to these leads, the account, or by candidate email within the account's team campaigns
        const orConditions: any[] = [];
        if (leadIds.length > 0) orConditions.push({ lead: { in: leadIds } });
        orConditions.push({ account_id: accountId });
        if (accountEmails.length > 0 && account.team_id) {
            orConditions.push({
                candidate_email: { in: accountEmails },
                assigned_campaign: { team_id: account.team_id },
            });
        }

        const items = await prismadb.crm_Outreach_Items.findMany({
            where: { OR: orConditions },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
                assigned_campaign: {
                    select: { name: true, status: true },
                },
            },
        });

        // Map to response shape
        const mapped = items.map((item: any) => ({
            id: item.id,
            channel: item.channel,
            status: item.status,
            subject: item.subject,
            body_text: item.body_text,
            body_html: item.body_html,
            candidate_email: item.candidate_email,
            candidate_name: item.candidate_name,
            error_message: item.error_message,
            sentAt: item.sentAt,
            openedAt: item.openedAt,
            clickedAt: item.clickedAt,
            repliedAt: item.repliedAt,
            reply_snippet: item.reply_snippet,
            reply_sentiment: item.reply_sentiment,
            createdAt: item.createdAt,
            sender_email: item.sender_email,
            campaign_name: item.assigned_campaign?.name || null,
            campaign_status: item.assigned_campaign?.status || null,
        }));

        // Compute stats
        const stats = {
            sent: mapped.filter((i: any) => ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"].includes(i.status)).length,
            opened: mapped.filter((i: any) => i.openedAt).length,
            replied: mapped.filter((i: any) => i.repliedAt || i.status === "REPLIED").length,
            failed: mapped.filter((i: any) => i.status === "FAILED").length,
            skipped: mapped.filter((i: any) => i.status === "SKIPPED").length,
            pending: mapped.filter((i: any) => i.status === "PENDING").length,
        };

        return NextResponse.json({ items: mapped, stats }, { status: 200 });
    } catch (error) {
        console.error("[ACCOUNT_OUTREACH_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
