import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export async function getSessionAndTeam() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.error === "SessionInvalidated") {
        return { error: new NextResponse("Unauthenticated", { status: 401 }), session: null, teamInfo: null };
    }

    if (session.user.userStatus && session.user.userStatus !== "ACTIVE") {
        return { error: new NextResponse("Forbidden: Account is not active", { status: 403 }), session, teamInfo: null };
    }

    const teamInfo = await getCurrentUserTeamId();
    if (!teamInfo || (!teamInfo.teamId && !teamInfo.isPlatformAdmin)) {
        return { error: new NextResponse("Forbidden: No team assigned", { status: 403 }), session, teamInfo: null };
    }

    return { error: null, session, teamInfo };
}

export function validateResourceOwnership(teamId: string | null, resourceTeamId: string | null, isGlobalAdmin: boolean = false) {
    if (isGlobalAdmin) return true;
    if (!teamId || !resourceTeamId) return false;
    return teamId === resourceTeamId;
}

export async function unauthorizedResponse(action: string, resource: string, _details?: any) {
    console.warn(`[UNAUTHORIZED_ACCESS_ATTEMPT] Action: ${action}, Resource: ${resource}`);
    return new NextResponse("Unauthorized", { status: 403 });
}
