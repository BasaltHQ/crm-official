import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import sendEmail from "@/lib/sendmail";
import { v4 as uuid } from "uuid";

const ALLOWED_PORTAL_PERMISSIONS = new Set([
    "view_cases",
    "create_cases",
    "view_invoices",
    "view_knowledge",
]);

const GENERIC_MAGIC_LINK_RESPONSE = {
    success: true,
    magicLinkSent: true,
    message: "If portal access is enabled for this email, a sign-in link has been sent.",
};

/**
 * Self-Service Portal API
 * POST /api/portal/auth — Authenticate portal user (by token or magic-link email, or admin invite)
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === "login") {
            const { email, token } = body;

            if (token && typeof token === "string") {
                // Token-based login
                const portalToken = await prismadb.crm_Portal_Token.findUnique({
                    where: { token },
                    include: {
                        contact: { select: { first_name: true, last_name: true, email: true } },
                    },
                });

                if (
                    !portalToken ||
                    !portalToken.is_active ||
                    (portalToken.expires_at && portalToken.expires_at <= new Date())
                ) {
                    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
                }

                // Update login tracking
                await prismadb.crm_Portal_Token.update({
                    where: { id: portalToken.id },
                    data: {
                        last_login: new Date(),
                        login_count: { increment: 1 },
                    },
                });

                return NextResponse.json({
                    success: true,
                    contact: portalToken.contact
                        ? {
                              firstName: portalToken.contact.first_name,
                              lastName: portalToken.contact.last_name,
                              first_name: portalToken.contact.first_name,
                              last_name: portalToken.contact.last_name,
                              email: portalToken.contact.email,
                          }
                        : null,
                    permissions: portalToken.permissions,
                    token: portalToken.token,
                });
            }

            if (email && typeof email === "string") {
                const normalizedEmail = email.trim().toLowerCase();
                if (!normalizedEmail) {
                    return NextResponse.json({ error: "Email or token required" }, { status: 400 });
                }

                // Email-based lookup — NEVER return portalToken.token in HTTP response;
                // always return constant generic response to prevent contact enumeration.
                const contact = await prismadb.crm_Contacts.findFirst({
                    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
                    select: { id: true, first_name: true, last_name: true, email: true },
                });

                if (contact?.email) {
                    const portalToken = await prismadb.crm_Portal_Token.findFirst({
                        where: {
                            contact_id: contact.id,
                            is_active: true,
                            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
                        },
                    });

                    if (portalToken) {
                        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com").replace(/\/$/, "");
                        const magicLink = `${appUrl}/portal?token=${encodeURIComponent(portalToken.token)}`;
                        const fromAddress =
                            process.env.EMAIL_FROM ||
                            process.env.EMAIL_USERNAME ||
                            "no-reply@basalthq.com";

                        await sendEmail({
                            from: fromAddress,
                            to: contact.email,
                            subject: "Your Self-Service Portal Sign-In Link",
                            text: `Hello${contact.first_name ? ` ${contact.first_name}` : ""},\n\nUse the following link to access your portal:\n${magicLink}\n\nIf you did not request this link, you can safely ignore this email.`,
                            html: `<p>Hello${contact.first_name ? ` ${contact.first_name}` : ""},</p><p>Click below to sign in to your Self-Service Portal:</p><p><a href="${magicLink}">${magicLink}</a></p><p>If you did not request this link, you can safely ignore this email.</p>`,
                        }).catch((err) => {
                            console.error("[PORTAL_AUTH_MAGIC_LINK_EMAIL_ERROR]", err);
                        });
                    }
                }

                return NextResponse.json(GENERIC_MAGIC_LINK_RESPONSE);
            }

            return NextResponse.json({ error: "Email or token required" }, { status: 400 });
        }

        if (action === "invite") {
            // Generate portal access for a contact (authenticated tenant admin action)
            const { error, teamInfo } = await getSessionAndTeam();
            if (error) return error;

            if (!teamInfo?.isAdmin) {
                return NextResponse.json({ error: "Forbidden — admin privileges required" }, { status: 403 });
            }

            const { contact_id, permissions, expires_days } = body;

            if (!contact_id || typeof contact_id !== "string") {
                return NextResponse.json({ error: "contact_id required" }, { status: 400 });
            }

            const contact = await prismadb.crm_Contacts.findUnique({
                where: { id: contact_id },
                select: { id: true, account: true, accountsIDs: true, team_id: true },
            });

            if (!contact) {
                return NextResponse.json({ error: "Contact not found" }, { status: 404 });
            }

            if (!validateResourceOwnership(teamInfo.teamId, contact.team_id, teamInfo.isPlatformAdmin)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            const token = uuid();
            const parsedDays = Number(expires_days);
            const expiresAt =
                Number.isFinite(parsedDays) && parsedDays > 0
                    ? new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000)
                    : null;

            const safePermissions = Array.isArray(permissions)
                ? permissions.filter((p: any) => typeof p === "string" && ALLOWED_PORTAL_PERMISSIONS.has(p))
                : ["view_cases", "create_cases", "view_knowledge"];

            const resolvedAccountId =
                typeof contact.accountsIDs === "string"
                    ? contact.accountsIDs
                    : typeof contact.account === "string"
                      ? contact.account
                      : null;

            const portalToken = await prismadb.crm_Portal_Token.create({
                data: {
                    contact_id,
                    account_id: resolvedAccountId,
                    token,
                    permissions: safePermissions.length > 0 ? safePermissions : ["view_cases"],
                    expires_at: expiresAt,
                },
            });

            return NextResponse.json({
                token: portalToken.token,
                portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/portal?token=${portalToken.token}`,
                expires_at: expiresAt,
            });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error) {
        console.error("[PORTAL_AUTH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
