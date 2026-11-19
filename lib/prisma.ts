import { PrismaClient } from "@prisma/client";

const NO_TEAM_SENTINEL_ID = "000000000000000000000000";

const TENANT_MODELS = [
  "crm_Accounts", "crm_Leads", "crm_Opportunities", "crm_Outreach_Campaigns",
  "crm_Contacts", "crm_Contracts", "Boards", "Invoices", "Documents",
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

const baseClient = new PrismaClient();

const client = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (TENANT_MODELS.includes(model) && TARGET_OPS.includes(operation as string)) {
          try {
            let cookieStore;
            try {
              const { cookies } = await import("next/headers");
              cookieStore = await cookies();
            } catch {
              // Headers not available (e.g. background cron/CLI context)
            }

            if (cookieStore) {
              const { getCurrentUserTeamId } = await import("@/lib/team-utils");
              const teamInfo = await getCurrentUserTeamId();
              if (teamInfo && (!teamInfo.isGlobalAdmin || teamInfo.isImpersonating)) {
                // Never fail open for authenticated users who have team_id === null
                const scopedTeamId = teamInfo.teamId || NO_TEAM_SENTINEL_ID;
                (args as any).where = { ...(args as any).where || {}, team_id: scopedTeamId };
              }
            }
          } catch (e) {
            console.error(`[PRISMA_MIDDLEWARE_ERROR] Model: ${model}, Op: ${operation}`, e);
          }
        }
        return query(args);
      }
    }
  }
});

const globalForPrisma = globalThis as unknown as { prismadb_v5: any };

export const prismadb = globalForPrisma.prismadb_v5 || client;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismadb_v5 = prismadb;
}
