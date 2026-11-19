import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { verifyImpersonatedTeamId } from "@/lib/cookie-utils";
import { normalizeRoleName } from "@/lib/security/authz";

export const getCurrentUserTeamId = cache(async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || (session as any).error === "SessionInvalidated") {
        return null;
    }

    const user = await (prismadb.users as any).findFirst({
        where: { email: { equals: session.user.email.trim().toLowerCase(), mode: "insensitive" } },
        select: {
            id: true,
            userStatus: true,
            team_id: true,
            is_admin: true,
            is_account_admin: true,
            team_role: true,
            assigned_team: {
                select: { id: true, slug: true, parent_id: true, status: true }
            }
        }
    });

    if (!user || user.userStatus === "INACTIVE") {
        return null;
    }

    const normalizedRole = normalizeRoleName(user.team_role);
    const isPlatformAdminRole = Boolean(user.is_admin) || normalizedRole === "PLATFORM_ADMIN";
    const isGlobalAdmin = isPlatformAdminRole;

    let effectiveTeamId: string | null = user.team_id || null;
    let isImpersonating = false;

    try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        if (cookieStore) {
            const impersonatedToken = cookieStore.get("impersonated_team_id")?.value;
            if (impersonatedToken) {
                const verifiedId = await verifyImpersonatedTeamId(impersonatedToken, user.id);
                if (verifiedId) {
                    let allowedToImpersonate = isGlobalAdmin;

                    // Non-global tenant admins may only context-switch within their own org/department hierarchy
                    if (!allowedToImpersonate && (user.is_account_admin || ["OWNER", "ADMIN", "SUPER_ADMIN"].includes(normalizedRole))) {
                        if (verifiedId === user.team_id) {
                            allowedToImpersonate = true;
                        } else if (user.assigned_team?.parent_id && verifiedId === user.assigned_team.parent_id && user.is_account_admin) {
                            allowedToImpersonate = true;
                        } else if (user.team_id) {
                            const targetTeam = await prismadb.team.findUnique({
                                where: { id: verifiedId },
                                select: { parent_id: true }
                            });
                            if (targetTeam?.parent_id && targetTeam.parent_id === user.team_id) {
                                allowedToImpersonate = true;
                            }
                        }
                    }

                    if (allowedToImpersonate) {
                        effectiveTeamId = verifiedId;
                        isImpersonating = verifiedId !== user.team_id || isGlobalAdmin;
                    } else {
                        try {
                            cookieStore.delete("impersonated_team_id");
                        } catch { /* ignore in read-only RSC contexts */ }
                    }
                } else {
                    try {
                        cookieStore.delete("impersonated_team_id");
                    } catch { /* ignore */ }
                }
            }
        }
    } catch {
        // next/headers not available outside request context
    }

    return {
        teamId: effectiveTeamId || null,
        isGlobalAdmin: isImpersonating ? false : isGlobalAdmin,
        isPlatformAdmin: isGlobalAdmin,
        isImpersonating,
        teamRole: isImpersonating ? "OWNER" : user.team_role,
        isAdmin: isImpersonating
            ? true
            : Boolean(
                  user.is_admin ||
                  user.is_account_admin ||
                  ["ADMIN", "OWNER", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(normalizedRole)
              ),
        userId: user.id,
        userStatus: user.userStatus,
    };
});
