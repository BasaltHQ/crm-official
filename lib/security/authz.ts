import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * Centralized Authorization, Role Normalization, Reserved Slug/Plan Guards & User Sanitization.
 */

export const RESERVED_TEAM_SLUGS = new Set([
    "basalt",
    "basalthq",
    "ledger1",
    "internal",
    "system",
    "admin",
    "platform",
    "root",
    "support",
    "api",
]);

export const SELF_SERVICE_PLAN_SLUGS = new Set(["STARTER", "GROWTH", "SCALE"]);

export const PRIVILEGED_SYSTEM_ROLES = new Set([
    "PLATFORM_ADMIN",
    "SUPER_ADMIN",
    "SYSADM",
]);

export const ALLOWED_TENANT_ROLES = new Set(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

const SENSITIVE_USER_KEYS = [
    "password",
    "mfaSecret",
    "mfaBackupCodes",
    "resetToken",
    "resetTokenExpires",
    "openAi_keys",
] as const;

export function normalizeTeamSlug(raw: string): string {
    return String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function isReservedTeamSlug(rawSlug: string | null | undefined): boolean {
    if (!rawSlug) return false;
    const normalized = normalizeTeamSlug(rawSlug);
    const stripped = String(rawSlug).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return RESERVED_TEAM_SLUGS.has(normalized) || RESERVED_TEAM_SLUGS.has(stripped);
}

export function isSelfServicePlanSlug(slug: string | null | undefined): boolean {
    if (!slug) return false;
    return SELF_SERVICE_PLAN_SLUGS.has(slug.trim().toUpperCase());
}

export function normalizeRoleName(role: string | null | undefined): string {
    if (!role) return "MEMBER";
    return role.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function isPrivilegedSystemRole(role: string | null | undefined): boolean {
    return PRIVILEGED_SYSTEM_ROLES.has(normalizeRoleName(role));
}

export function sanitizeUser<T>(user: T): T {
    if (!user || typeof user !== "object") return user;
    if (Array.isArray(user)) {
        return user.map((item) => sanitizeUser(item)) as unknown as T;
    }
    const clone: Record<string, any> = { ...(user as Record<string, any>) };
    for (const key of SENSITIVE_USER_KEYS) {
        delete clone[key];
    }
    return clone as T;
}

export async function requirePlatformAdmin() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
        return null;
    }

    const user = await prismadb.users.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            name: true,
            userStatus: true,
            is_admin: true,
            team_id: true,
            team_role: true,
            assigned_team: { select: { id: true, slug: true } },
        },
    });

    if (!user || user.userStatus !== "ACTIVE") {
        return null;
    }

    const normalizedRole = normalizeRoleName(user.team_role);
    const isInternalOwner =
        ["basalthq", "basalt", "ledger1"].includes((user.assigned_team?.slug || "").toLowerCase()) &&
        normalizedRole === "OWNER";

    if (!user.is_admin && normalizedRole !== "PLATFORM_ADMIN" && !isInternalOwner) {
        return null;
    }

    return user;
}

