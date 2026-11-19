import { PrismaClient } from "@prisma/client";

const NO_TEAM_SENTINEL_ID = "000000000000000000000000";

function computeCrmUrl(): string {
  const explicit = process.env.CRM_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("Missing DATABASE_URL (or CRM_DATABASE_URL) for CRM Prisma client");
  }

  const dbName = process.env.PRISMA_DB_NAME || "BasaltCRM";
  try {
    const u = new URL(base);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = `/${dbName}`;
    }
    return u.toString();
  } catch {
    if (base.includes("/")) return base;
    return `${base}/${dbName}`;
  }
}

const crmUrl = computeCrmUrl();

const TENANT_MODELS = [
  "crm_Accounts", "crm_Leads", "crm_Opportunities", "crm_Outreach_Campaigns",
  "crm_Contacts", "crm_Contacts_Opportunities", "crm_Contracts", "Boards", "Invoices", "Documents",
  "Tasks", "crm_Accounts_Tasks", "CustomRole", "crm_CustomWidget",
  "TeamEmailConfig", "TeamAiConfig", "CustomModelRequest", "TeamSmsConfig",
  "TeamCaptchaConfig", "crm_Lead_Pools", "Form", "FormSubmission",
  "crm_Message_Portal", "RolePermission", "crm_Workflow",
  "CustomObjectDefinition", "CustomRecord", "PageLayout", "crm_Cases",
  "SLA_Policy", "RoutingConfig", "KnowledgeCategory", "KnowledgeArticle",
  "ValidationRule", "ApprovalProcess", "ApprovalRequest", "Notification",
  "crm_Products", "crm_Quotes", "NavigationConfig",
  "MyAccount", "TeamBrandIdentity", "crm_Agentic_Actions", "crm_Document_Chunks",
  "crm_Entitlement", "InternalMessage", "Quest", "Sandbox", "EmailWarmup", "crm_Email_Thread"
];

const TARGET_OPS = ["findMany", "findFirst", "count", "aggregate", "updateMany", "deleteMany"];

const client = new PrismaClient({
    datasources: { db: { url: crmUrl } },
}).$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                if (TENANT_MODELS.includes(model) && TARGET_OPS.includes(operation as string)) {
                    try {
                        const { cookies } = await import("next/headers");
                        const cookieStore = await cookies();
                        if (cookieStore) {
                            const { getCurrentUserTeamId } = await import("@/lib/team-utils");
                            const teamInfo = await getCurrentUserTeamId();
                            if (teamInfo && (!teamInfo.isGlobalAdmin || teamInfo.isImpersonating)) {
                                const scopedTeamId = teamInfo.teamId || NO_TEAM_SENTINEL_ID;
                                (args as any).where = { ...(args as any).where || {}, team_id: scopedTeamId };
                            }
                        }
                    } catch {
                        // Outside request context
                    }
                }
                return query(args);
            }
        }
    }
});

declare global {
  var cachedPrismaCrm: any | undefined;
}

if (!global.cachedPrismaCrm) {
  global.cachedPrismaCrm = client;
}

export const prismadbCrm = global.cachedPrismaCrm;
