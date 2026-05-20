import { PrismaClient } from "@prisma/client";

// Explicitly connect to the CRM database
const crmUrl = "mongodb+srv://basalthq:CB98FfYDIZu6LR2prON0@mongodb-5de03bff-o3b3068ad.database.cloud.ovh.us/crm?replicaSet=replicaset&tls=true&authSource=admin";
const prisma = new PrismaClient({
  datasources: {
    db: { url: crmUrl }
  }
});

async function run() {
  console.log("Starting demo campaign cleanup in CRM DB...");

  const userId = "693287a880deffaa87ba2d44";
  const teamId = "6934998c7038863976a7a5fd";
  const senderEmail = "sysadm@basalthq.com";

  // 1. Delete Outreach Items and Campaigns
  const existingCampaigns = await prisma.crm_Outreach_Campaigns.findMany({
    where: {
      user: userId,
      name: "Email Warmup Demo Campaign"
    }
  });

  for (const c of existingCampaigns) {
    const itemsDel = await prisma.crm_Outreach_Items.deleteMany({ where: { campaign: c.id } });
    console.log(`Deleted ${itemsDel.count} outreach items for campaign ID ${c.id}`);
    await prisma.crm_Outreach_Campaigns.delete({ where: { id: c.id } });
    console.log(`Deleted demo campaign ID ${c.id}`);
  }

  // 2. Delete warmup statistics
  const warmupDel = await prisma.emailWarmup.deleteMany({
    where: {
      team_id: teamId,
      sender_email: senderEmail
    }
  });
  console.log(`Deleted ${warmupDel.count} email warmup records for sender ${senderEmail}`);

  console.log("Cleanup complete! The database has been cleanly rolled back.");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
