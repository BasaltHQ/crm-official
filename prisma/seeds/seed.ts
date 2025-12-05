//import { PrismaClient } from "@prisma/client";
const { PrismaClient } = require("@prisma/client");
/*
Seed data is used to populate the database with initial data.
*/
//Menu Items
const moduleData = require("../initial-data/system_Modules_Enabled.json");
//GPT Models
const gptModelsData = require("../initial-data/gpt_Models.json");
//CRM
const crmOpportunityTypeData = require("../initial-data/crm_Opportunities_Type.json");
const crmOpportunitySaleStagesData = require("../initial-data/crm_Opportunities_Sales_Stages.json");
const crmCampaignsData = require("../initial-data/crm_campaigns.json");
const crmIndustryTypeData = require("../initial-data/crm_Industry_Type.json");

const prisma = new PrismaClient();

async function main() {
  // Your seeding logic here using Prisma Client
  console.log("-------- Seeding DB --------");

  //Seed Menu Items
  const modules = await prisma.system_Modules_Enabled.findMany();

  if (modules.length === 0) {
    await prisma.system_Modules_Enabled.createMany({
      data: moduleData,
    });
    console.log("Modules seeded successfully");
  } else {
    console.log("Modules already seeded");
  }

  //Seed CRM Opportunity Types
  const crmOpportunityType = await prisma.crm_Opportunities_Type.findMany();

  if (crmOpportunityType.length === 0) {
    await prisma.crm_Opportunities_Type.createMany({
      data: crmOpportunityTypeData,
    });
    console.log("Opportunity Types seeded successfully");
  } else {
    console.log("Opportunity Types already seeded");
  }

  const crmOpportunitySaleStages =
    await prisma.crm_Opportunities_Sales_Stages.findMany();

  if (crmOpportunitySaleStages.length === 0) {
    await prisma.crm_Opportunities_Sales_Stages.createMany({
      data: crmOpportunitySaleStagesData,
    });
    console.log("Opportunity Sales Stages seeded successfully");
  } else {
    console.log("Opportunity Sales Stages already seeded");
  }

  const crmCampaigns = await prisma.crm_campaigns.findMany();

  if (crmCampaigns.length === 0) {
    await prisma.crm_campaigns.createMany({
      data: crmCampaignsData,
    });
    console.log("Campaigns seeded successfully");
  } else {
    console.log("Campaigns already seeded");
  }

  const crmIndustryType = await prisma.crm_Industry_Type.findMany();

  if (crmIndustryType.length === 0) {
    await prisma.crm_Industry_Type.createMany({
      data: crmIndustryTypeData,
    });
    console.log("Industry Types seeded successfully");
  } else {
    console.log("Industry Types already seeded");
  }

  //Seed GPT Models
  const gptModels = await prisma.gpt_models.findMany();

  if (gptModels.length === 0) {
    await prisma.gpt_models.createMany({
      data: gptModelsData,
    });
    console.log("GPT Models seeded successfully");
  } else {
    console.log("GPT Models already seeded");
  }

  // Seed Footer Data
  const footerSetting = await prisma.footerSetting.findFirst();
  if (!footerSetting) {
    await prisma.footerSetting.create({
      data: {
        tagline: "Your 24/7 AI workforce. Sales, Support, and Growth on autopilot.",
        copyrightText: "© 2025 Ledger AI. All rights reserved.",
        socialXUrl: "https://x.com/Ledger1AI",
        socialDiscordUrl: "https://discord.gg/vARPqF84Zt",
      },
    });
    console.log("Footer Settings seeded successfully");
  } else {
    console.log("Footer Settings already seeded");
  }

  const footerSections = await prisma.footerSection.findMany();
  if (footerSections.length === 0) {
    // Product Section
    const productSection = await prisma.footerSection.create({
      data: {
        title: "Product",
        order: 1,
        links: {
          create: [
            { text: "Features", url: "/features", order: 1 },
            { text: "Pricing", url: "/pricing", order: 2 },
          ],
        },
      },
    });

    // Company Section
    const companySection = await prisma.footerSection.create({
      data: {
        title: "Company",
        order: 2,
        links: {
          create: [
            { text: "About Us", url: "/about", order: 1 },
            { text: "Blog", url: "/blog", order: 2 },
            { text: "Careers", url: "/careers", order: 3 },
            { text: "Contact", url: "/support", order: 4 },
          ],
        },
      },
    });

    // Legal Section
    const legalSection = await prisma.footerSection.create({
      data: {
        title: "Legal",
        order: 3,
        links: {
          create: [
            { text: "Privacy Policy", url: "/privacy", order: 1 },
            { text: "Terms of Service", url: "/terms", order: 2 },
            { text: "Cookie Policy", url: "/cookies", order: 3 },
          ],
        },
      },
    });

    console.log("Footer Sections and Links seeded successfully");
  } else {
    console.log("Footer Sections and Links already seeded");
  }

  console.log("-------- Seed DB completed --------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
