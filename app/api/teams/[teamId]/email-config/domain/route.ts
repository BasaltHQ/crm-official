import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { prismadb } from "@/lib/prisma";
import { verifyDomainIdentity, getIdentityVerificationStatus } from "@/lib/aws/ses-verify";
import sendEmail from "@/lib/sendmail";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// POST: Request domain verification
export async function POST(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { domain } = body;

    if (!domain || typeof domain !== "string") {
        return NextResponse.json({ error: "Valid domain required (e.g. acmecorp.com)" }, { status: 400 });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
    if (!DOMAIN_REGEX.test(cleanDomain)) {
        return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
    }

    try {
        const team = await prismadb.team.findUnique({
            where: { id: params.teamId },
            select: {
                id: true,
                name: true,
                slug: true,
                subscription_plan: true,
                assigned_plan: { select: { slug: true, name: true } }
            }
        });

        if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

        const planSlug = team.assigned_plan?.slug || team.subscription_plan;

        const result = await verifyDomainIdentity(cleanDomain);

        const dnsRecords = result.dkimTokens.map((token: string) => ({
            type: "CNAME",
            name: `${token}._domainkey.${cleanDomain}`,
            value: `${token}.dkim.amazonses.com`
        }));

        const existingConfig = await prismadb.teamEmailConfig.findUnique({
            where: { team_id_purpose: { team_id: params.teamId, purpose: "GENERAL" } }
        });

        const domainData = {
            custom_domain: cleanDomain,
            domain_verification_token: result.verificationToken || null,
            domain_dkim_tokens: result.dkimTokens,
            domain_status: "DNS_PENDING",
            domain_requested_at: new Date(),
        };

        if (existingConfig) {
            await prismadb.teamEmailConfig.update({
                where: { id: existingConfig.id },
                data: domainData
            });
        } else {
            await prismadb.teamEmailConfig.create({
                data: {
                    team_id: params.teamId,
                    purpose: "GENERAL",
                    provider: "PLATFORM_SES",
                    from_email: `noreply@${cleanDomain}`,
                    ...domainData,
                }
            });
        }

        await logActivityInternal(
            session!.user.id,
            "DOMAIN_VERIFICATION_REQUEST",
            "Email Configuration",
            `Requested domain verification for ${cleanDomain}`,
            params.teamId
        );

        const adminNotificationEmail = process.env.SES_FROM_ADDRESS || process.env.EMAIL_FROM || "admin@basalthq.com";
        try {
            const safeTeamName = escapeHtml(team.name);
            const safeTeamSlug = escapeHtml(team.slug);
            const safeDomain = escapeHtml(cleanDomain);
            const safePlan = escapeHtml(planSlug);
            const safeRequester = escapeHtml(session!.user.email || session!.user.name || "");

            await sendEmail({
                to: adminNotificationEmail,
                subject: `Domain Verification Request: ${cleanDomain}`,
                text: `Team "${team.name}" (${team.slug}) has requested domain verification for ${cleanDomain}.\n\nTeam ID: ${team.id}\nPlan: ${planSlug}\nRequested by: ${session!.user.email || session!.user.name}\n\nDNS Records to share with the team:\n\n${dnsRecords.map((r: any) => `${r.type}: ${r.name} -> ${r.value}`).join("\n")}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px;">
                        <h2 style="color: #6366f1;">Domain Verification Request</h2>
                        <p><strong>Team:</strong> ${safeTeamName} (${safeTeamSlug})</p>
                        <p><strong>Domain:</strong> ${safeDomain}</p>
                        <p><strong>Plan:</strong> ${safePlan}</p>
                        <p><strong>Requested by:</strong> ${safeRequester}</p>
                        <p><strong>Team ID:</strong> <code>${escapeHtml(team.id)}</code></p>
                        <h3 style="margin-top: 24px;">DNS Records to Share</h3>
                        <table style="border-collapse: collapse; width: 100%;">
                            <tr style="background: #f3f4f6;">
                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Type</th>
                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Name</th>
                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Value</th>
                            </tr>
                            ${dnsRecords.map((r: any) => `
                                <tr>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(r.type)}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(r.name)}</td>
                                    <td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 12px;">${escapeHtml(r.value)}</td>
                                </tr>
                            `).join("")}
                        </table>
                    </div>
                `
            });
        } catch (emailError) {
            systemLogger.error("[DomainVerification] Failed to send admin notification:", emailError);
        }

        return NextResponse.json({
            success: true,
            domain: cleanDomain,
            status: "DNS_PENDING",
            dnsRecords,
            message: "Domain verification initiated! Please add the DNS records below to your domain provider."
        });

    } catch (error: any) {
        systemLogger.error("[DOMAIN_VERIFICATION_POST]", error);
        return NextResponse.json({ error: "Failed to initiate domain verification" }, { status: 500 });
    }
}

// GET: Check domain verification status
export async function GET(_req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await prismadb.teamEmailConfig.findUnique({
        where: { team_id_purpose: { team_id: params.teamId, purpose: "GENERAL" } }
    });

    if (!config?.custom_domain) {
        return NextResponse.json({ domain: null, status: null });
    }

    if (config.domain_status === "DNS_PENDING") {
        const status = await getIdentityVerificationStatus(config.custom_domain);
        if (status === "SUCCESS") {
            await prismadb.teamEmailConfig.update({
                where: { id: config.id },
                data: { domain_status: "VERIFIED" }
            });
            return NextResponse.json({ domain: config.custom_domain, status: "VERIFIED", dkimTokens: config.domain_dkim_tokens });
        }
    }

    return NextResponse.json({
        domain: config.custom_domain,
        status: config.domain_status,
        dkimTokens: config.domain_dkim_tokens,
        requestedAt: config.domain_requested_at
    });
}
