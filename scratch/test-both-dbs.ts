import { PrismaClient } from "@prisma/client";

const adminUrl = "mongodb+srv://basalthq:CB98FfYDIZu6LR2prON0@mongodb-5de03bff-o3b3068ad.database.cloud.ovh.us/admin?replicaSet=replicaset&tls=true&authSource=admin";
const crmUrl = "mongodb+srv://basalthq:CB98FfYDIZu6LR2prON0@mongodb-5de03bff-o3b3068ad.database.cloud.ovh.us/crm?replicaSet=replicaset&tls=true&authSource=admin";

async function checkDb(url: string, name: string) {
  console.log(`Checking DB: ${name}...`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const campaigns = await prisma.crm_Outreach_Campaigns.findMany({
      select: { id: true, name: true, user: true, team_id: true },
      take: 5
    });
    console.log(`[${name}] Campaigns (count: ${campaigns.length}):`, JSON.stringify(campaigns, null, 2));

    const users = await prisma.users.findMany({
      select: { id: true, email: true, name: true, team_id: true },
      take: 5
    });
    console.log(`[${name}] Users (count: ${users.length}):`, JSON.stringify(users, null, 2));
  } catch (err: any) {
    console.error(`[${name}] Error:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  await checkDb(adminUrl, "ADMIN_DB");
  await checkDb(crmUrl, "CRM_DB");
}

run();
