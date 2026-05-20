import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  console.log("Starting demo seeding...");

  // 1. Ensure Team "Basalt HQ" exists
  let team = await prisma.team.findUnique({
    where: { slug: "basalt-hq" }
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: "Basalt HQ",
        slug: "basalt-hq",
        team_type: "ORGANIZATION",
        status: "ACTIVE"
      }
    });
    console.log("Created team 'Basalt HQ' with ID:", team.id);
  } else {
    console.log("Using existing team 'Basalt HQ' with ID:", team.id);
  }

  // 2. Ensure sysadm user exists
  let user = await prisma.users.findUnique({
    where: { email: "sysadm@basalthq.com" }
  });

  if (!user) {
    user = await prisma.users.create({
      data: {
        email: "sysadm@basalthq.com",
        name: "System Admin",
        userStatus: "ACTIVE",
        is_admin: true,
        is_account_admin: true,
        team_id: team.id,
        team_role: "SUPER_ADMIN"
      }
    });
    console.log("Created user 'sysadm@basalthq.com' with ID:", user.id);
  } else {
    // Make sure user is ACTIVE and linked to Team
    user = await prisma.users.update({
      where: { id: user.id },
      data: {
        userStatus: "ACTIVE",
        team_id: team.id,
        team_role: "SUPER_ADMIN"
      }
    });
    console.log("Updated existing user 'sysadm@basalthq.com'");
  }

  // 3. Clear existing warmup info and insert Phase 2 stats for sysadm@basalthq.com
  await prisma.emailWarmup.deleteMany({
    where: {
      team_id: team.id,
      sender_email: "sysadm@basalthq.com"
    }
  });

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const warmup = await prisma.emailWarmup.create({
    data: {
      team_id: team.id,
      sender_email: "sysadm@basalthq.com",
      first_send_at: twoDaysAgo,
      emails_sent_today: 32,
      last_send_date: todayStart
    }
  });
  console.log("Created EmailWarmup stats (Phase 2, Day 3, 32/50 sent):", warmup.id);

  // 4. Clear any old demo campaigns
  const existingCampaigns = await prisma.crm_Outreach_Campaigns.findMany({
    where: {
      user: user.id,
      name: "Email Warmup Demo Campaign"
    }
  });

  for (const c of existingCampaigns) {
    await prisma.crm_Outreach_Items.deleteMany({ where: { campaign: c.id } });
    await prisma.crm_Outreach_Campaigns.delete({ where: { id: c.id } });
  }

  // 5. Create new demo campaign
  const campaign = await prisma.crm_Outreach_Campaigns.create({
    data: {
      name: "Email Warmup Demo Campaign",
      description: "A high-fidelity demo showcasing active progressive warm-up schedules and glassmorphic UI.",
      status: "ACTIVE",
      user: user.id,
      team_id: team.id,
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
  console.log("Created demo campaign with ID:", campaign.id);

  // 6. Create 32 mock outreach items (20 SENT, 8 OPENED, 4 REPLIED)
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
      sender_email: "sysadm@basalthq.com"
    });
  }

  await prisma.crm_Outreach_Items.createMany({
    data: itemsData
  });
  console.log(`Successfully created 32 mock outreach items!`);
  console.log(`Demo seed complete. Enjoy the UI!`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
