import { NextResponse } from "next/server";
import { executeApprovedAction, rejectAction } from "@/lib/agents/deal-agent";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/agents/deal/approve
 *
 * Human approval/rejection of a proposed agentic action.
 * Requires team admin ownership of the target action.
 */
export async function POST(req: Request) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo) {
      return error || new NextResponse("Unauthorized", { status: 401 });
    }

    if (!teamInfo.isAdmin) {
      return new NextResponse("Forbidden: Admin access required", { status: 403 });
    }

    const body = await req.json();

    if (!body.actionId || !body.decision) {
      return new NextResponse("actionId and decision are required", { status: 400 });
    }

    const action = await prismadb.crm_Agentic_Actions.findUnique({
      where: { id: body.actionId },
      select: { id: true, team_id: true },
    });

    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo.teamId, action.team_id, teamInfo.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (body.decision === "approve") {
      const result = await executeApprovedAction(
        body.actionId,
        session.user.id,
        body.modifiedPayload
      );
      return NextResponse.json(result);
    } else if (body.decision === "reject") {
      await rejectAction(body.actionId, session.user.id, body.reason);
      return NextResponse.json({ success: true, status: "REJECTED" });
    } else {
      return new NextResponse("decision must be 'approve' or 'reject'", { status: 400 });
    }
  } catch (error: any) {
    systemLogger.error("[DEAL_AGENT_APPROVE]", error?.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
