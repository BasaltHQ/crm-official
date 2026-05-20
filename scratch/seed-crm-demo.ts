import { PrismaClient } from "@prisma/client";

// Explicitly connect to the CRM database used by the Next.js app in .env.local
const crmUrl = "mongodb+srv://basalthq:CB98FfYDIZu6LR2prON0@mongodb-5de03bff-o3b3068ad.database.cloud.ovh.us/crm?replicaSet=replicaset&tls=true&authSource=admin";
const prisma = new PrismaClient({
  datasources: {
    db: { url: crmUrl }
  }
});

async function run() {
  console.log("Starting CRM DB seeding...");

  // Existing user and team details found in the CRM database
  const userId = "693287a880deffaa87ba2d44";
  const teamId = "6934998c7038863976a7a5fd";
  const senderEmail = "sysadm@basalthq.com";

  // 1. Verify User and Team exist
  const user = await prisma.users.findUnique({
    where: { id: userId }
  });
  if (!user) {
    throw new Error(`User with ID ${userId} not found in CRM DB.`);
  }
  console.log(`Found active CRM user: ${user.name} (${user.email})`);

  // 2. Provision/Update EmailWarmup stats for sysadm@basalthq.com under active team
  await prisma.emailWarmup.deleteMany({
    where: {
      team_id: teamId,
      sender_email: senderEmail
    }
  });

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const warmup = await prisma.emailWarmup.create({
    data: {
      team_id: teamId,
      sender_email: senderEmail,
      first_send_at: twoDaysAgo,
      emails_sent_today: 32,
      last_send_date: todayStart
    }
  });
  console.log("Created EmailWarmup stats (Phase 2, Day 3, 32/50 sent):", warmup.id);

  // 3. Clear any old demo campaigns in CRM DB
  const existingCampaigns = await prisma.crm_Outreach_Campaigns.findMany({
    where: {
      user: userId,
      name: "Email Warmup Demo Campaign"
    }
  });

  for (const c of existingCampaigns) {
    await prisma.crm_Outreach_Items.deleteMany({ where: { campaign: c.id } });
    await prisma.crm_Outreach_Campaigns.delete({ where: { id: c.id } });
  }

  // 4. Create new demo campaign under user and team in CRM DB
  const campaign = await prisma.crm_Outreach_Campaigns.create({
    data: {
      name: "Email Warmup Demo Campaign",
      description: "A high-fidelity demo showcasing active progressive warm-up schedules and glassmorphic UI.",
      status: "ACTIVE",
      user: userId,
      team_id: teamId,
      total_leads: 50,
      emails_sent: 32,
      emails_opened: 12,
      emails_replied: 4,
      channels: ["EMAIL"],
      launchedAt: twoDaysAgo,
      campaign_branding: {
        senderMode: "personal",
        repair_active: false,
        repair_progress: null,
        repair_stream: "Warm-up sequence active. 32 emails sent successfully."
      }
    }
  });
  console.log("Created demo campaign in CRM DB with ID:", campaign.id);

  // 5. Create 32 mock outreach items (20 SENT, 8 OPENED, 4 REPLIED)
  const itemsData = [];
  for (let i = 1; i <= 32; i++) {
    let status: "SENT" | "OPENED" | "REPLIED" = "SENT";
    let openedAt: Date | undefined;
    let repliedAt: Date | undefined;

    if (i <= 4) {
      status = "REPLIED";
      openedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      repliedAt = new Date(Date.now() - 12 * 60 * 60 * 1000);
    } else if (i <= 12) {
      status = "OPENED";
      openedAt = new Date(Date.now() - 18 * 60 * 60 * 1000);
    }

    itemsData.push({
      campaign: campaign.id,
      channel: "EMAIL" as any,
      status: status as any,
      subject: "Unlocking CRM Potential with Basalt",
      body_text: `Hi Recipient ${i},\n\nI noticed you were working on scaling your team's outreach. BasaltCRM helps you do that safely.\n\nBest, System Admin`,
      candidate_email: `demo_lead_${i}@basalthq.com`,
      candidate_name: `Demo Lead ${i}`,
      candidate_company: `Company ${String.fromCharCode(65 + (i % 6))}`,
      candidate_job_title: "Sales Director",
      sentAt: twoDaysAgo,
      openedAt,
      repliedAt,
      sender_email: senderEmail
    });
  }

  await prisma.crm_Outreach_Items.createMany({
    data: itemsData
  });
  console.log(`Successfully created 32 mock outreach items!`);
  console.log(`Demo seed complete in CRM DB. Enjoy the UI!`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
