import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get user to check admin status
        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { is_admin: true, is_account_admin: true },
        });

        // Admins see all leads, regular users see only their assigned leads
        const teamInfo = await getCurrentUserTeamId();

        // If no team and not global admin, return empty
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) {
            return NextResponse.json([]);
        }

        const whereClause: any = {};

        if (!teamInfo?.isGlobalAdmin) {
            whereClause.team_id = teamInfo?.teamId;
        }

        // If not admin/account_admin, restrict to assigned_to within the team
        if (!user?.is_admin && !user?.is_account_admin) {
            whereClause.assigned_to = session.user.id;
        }

        const data = await prismadb.crm_Leads.findMany({
            where: whereClause,
            include: {
                assigned_to_user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("[LEADS_LIST_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
