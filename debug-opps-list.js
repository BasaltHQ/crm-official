
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log("=== ALL PROJECT OPPORTUNITIES ===");
    const projOpps = await prisma.project_Opportunities.findMany();
    if (projOpps.length === 0) console.log("No Project Opportunities found.");
    for (const o of projOpps) {
        console.log(`Title: ${o.title}, Status: ${o.status}, AssignedTo: ${o.assignedTo}, Value: ${o.valueEstimate}`);
    }

    console.log("\n=== ALL CRM OPPORTUNITIES (First 50) ===");
    const crmOpps = await prisma.crm_Opportunities.findMany({ take: 50 });
    if (crmOpps.length === 0) console.log("No CRM Opportunities found.");
    for (const o of crmOpps) {
        console.log(`Name: ${o.name}, Status: ${o.status}, AssignedTo: ${o.assigned_to}, Revenue: ${o.expected_revenue}`);
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
