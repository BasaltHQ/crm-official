import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const campaigns = await prisma.crm_Outreach_Campaigns.findMany({
    where: {
      name: {
        contains: "VENTURE CAPITAL LIST"
      }
    },
    take: 1
  });
  console.log("CAMPAIGNS_FOUND:", JSON.stringify(campaigns, null, 2));

  if (campaigns.length > 0) {
    const campaign = campaigns[0];
    if (campaign.user) {
      const user = await prisma.users.findUnique({
        where: { id: campaign.user },
        select: { id: true, email: true, name: true, team_id: true }
      });
      console.log("OWNER_USER:", JSON.stringify(user, null, 2));
    }
  } else {
    // If we didn't find that specific one, let's find the last 5 campaigns
    const latestCampaigns = await prisma.crm_Outreach_Campaigns.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    });
    console.log("LATEST_CAMPAIGNS:", JSON.stringify(latestCampaigns, null, 2));
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
