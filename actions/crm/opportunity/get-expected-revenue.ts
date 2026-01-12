import { prismadb } from "@/lib/prisma";

export const getExpectedRevenue = async () => {
  const [crmAgg, projectAgg] = await prismadb.$transaction([
    prismadb.crm_Opportunities.aggregate({
      where: { status: "ACTIVE" },
      _sum: { expected_revenue: true },
    }),
    (prismadb.project_Opportunities as any).aggregate({
      where: { status: "OPEN" },
      _sum: { valueEstimate: true },
    }),
  ]);

  const crmRevenue = Number(crmAgg._sum.expected_revenue ?? 0);
  const projectRevenue = Number((projectAgg as any)._sum?.valueEstimate ?? 0);

  return crmRevenue + projectRevenue;
};
