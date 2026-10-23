import "server-only";

import type { Prisma } from "@prisma/client";
import { DECISION_SERVICES } from "./reply-decisions";

export class DecisionAccessError extends Error {}
export interface DecisionReportOptions {
  scope: "team" | "platform";
  days?: string;
  cursor?: string;
  teamId?: string;
}

type DecisionLog = Prisma.crm_AiUsageLogGetPayload<{ select: {
  id: true; createdAt: true; tenant_id: true; user_id: true; service: true; model_used: true;
  tokens_in: true; tokens_out: true; cost: true; metadata: true;
  team: { select: { name: true } }; user: { select: { name: true } };
} }>;
interface ServiceTotal {
  service: string;
  _count: { _all: number };
  _sum: { tokens_in: number | null; tokens_out: number | null; cost: number | null };
}
interface ReportDependencies {
  currentUser: () => Promise<{ team_id: string | null; team_role: string | null } | null>;
  store: () => Promise<{
    crm_AiUsageLog: {
      groupBy: (args: Prisma.crm_AiUsageLogGroupByArgs) => Promise<ServiceTotal[]>;
      findMany: (args: Prisma.crm_AiUsageLogFindManyArgs) => Promise<DecisionLog[]>;
    };
    team: { findMany: (args: Prisma.TeamFindManyArgs) => Promise<{ id: string; name: string }[]> };
  }>;
}

const dependencies: ReportDependencies = {
  currentUser: async () => {
    const [{ getServerSession }, { authOptions }, { prismadb }] = await Promise.all([
      import("next-auth"), import("../auth"), import("../prisma"),
    ]);
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    return prismadb.users.findUnique({ where: { id: session.user.id }, select: { team_id: true, team_role: true } });
  },
  store: async () => (await import("../prisma")).prismadb,
};

/** Authorization and tenant scoping are enforced here, independently of page navigation. */
export async function getDecisionReport(options: DecisionReportOptions, deps: ReportDependencies = dependencies) {
  const user = await deps.currentUser();
  if (!user) throw new DecisionAccessError("Sign in to view Decision Intelligence.");
  const platform = options.scope === "platform";
  const role = (user.team_role || "").trim().toUpperCase();
  if (platform && !["PLATFORM_ADMIN", "PLATFORM ADMIN", "SUPER_ADMIN", "SYSADM"].includes(role)) {
    throw new DecisionAccessError("Platform administrator access required.");
  }
  const objectId = /^[a-f\d]{24}$/i;
  const teamId = platform ? options.teamId : user.team_id;
  if ((!platform && (!teamId || !objectId.test(teamId))) ||
    (options.teamId && (!objectId.test(options.teamId) || (!platform && options.teamId !== user.team_id)))) {
    throw new DecisionAccessError("Invalid team scope.");
  }
  const days = ["7", "30", "90", "all"].includes(options.days || "") ? options.days! : "30";
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - Number(days));
  const where: Prisma.crm_AiUsageLogWhereInput = {
    service: { in: [...DECISION_SERVICES] },
    ...(teamId ? { tenant_id: teamId } : {}),
    ...(days !== "all" ? { createdAt: { gte: start } } : {}),
  };
  const cursor = options.cursor && objectId.test(options.cursor) ? options.cursor : undefined;
  const db = await deps.store();
  const [totals, recent, teams] = await Promise.all([
    db.crm_AiUsageLog.groupBy({ by: ["service"], where, _count: { _all: true }, _sum: { tokens_in: true, tokens_out: true, cost: true } }),
    // Paginate by indexed ObjectId without performing a cross-tenant cursor lookup.
    db.crm_AiUsageLog.findMany({ where: { ...where, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: "desc" }, take: 51, select: {
        id: true, createdAt: true, tenant_id: true, user_id: true, service: true, model_used: true,
        tokens_in: true, tokens_out: true, cost: true, metadata: true,
        team: { select: { name: true } }, user: { select: { name: true } },
      } }),
    platform ? db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const count = (service: string) => totals.find(row => row.service === service)?._count._all || 0;
  return {
    platform, days, teamId, teams, configured: !!process.env.TYPESAFE_API_KEY?.trim(),
    totals: {
      decisions: count("reply_decision"), failures: count("reply_decision_error"),
      unavailable: count("reply_decision_unavailable"), cached: count("reply_decision_cache"), shadow: count("reply_decision_shadow"),
      tokensIn: totals.reduce((sum, row) => sum + (row._sum.tokens_in || 0), 0),
      tokensOut: totals.reduce((sum, row) => sum + (row._sum.tokens_out || 0), 0),
      cost: totals.reduce((sum, row) => sum + (row._sum.cost || 0), 0),
    },
    recent: recent.slice(0, 50), nextCursor: recent.length > 50 ? recent[49].id : null,
  };
}

export type DecisionReport = Awaited<ReturnType<typeof getDecisionReport>>;
