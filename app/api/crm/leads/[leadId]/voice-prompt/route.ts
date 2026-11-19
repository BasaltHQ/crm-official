import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request, props: { params: Promise<{ leadId: string }> }) {
  const params = await props.params;
  const { error, teamInfo } = await getSessionAndTeam();
  
  if (error) return error;

  try {
    const { prompt } = await req.json();

    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: params.leadId },
      select: { team_id: true, firstName: true, lastName: true }
    });

    if (!lead) return new NextResponse("Lead not found", { status: 404 });

    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return await unauthorizedResponse("POST", `crm_Leads:${params.leadId}`);
    }

    await prismadb.crm_Leads.update({
      where: { id: params.leadId },
      data: { voice_prompt_override: prompt || null }
    });
    
    systemLogger.info(`[VOICE_PROMPT] Updated voice instruction override for Lead ${lead.firstName} ${lead.lastName}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    systemLogger.error("[VOICE_PROMPT_ERROR]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
