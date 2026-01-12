
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log("Checking Opportunities...");

    const users = await prisma.users.findMany({
        include: { assigned_team: true }
    });
    console.log(`Found ${users.length} users.`);

    for (const u of users) {
        console.log(`\nUser: ${u.name} (${u.email}) ID: ${u.id}`);

        // Check CRM Opps
        const crmOpps = await prisma.crm_Opportunities.count({
            where: {
                assigned_to: u.id,
                status: "ACTIVE"
            }
        });
        console.log(`- CRM Active Opps: ${crmOpps}`);

        // Check Project Opps
        const projOpps = await prisma.project_Opportunities.count({
            where: {
                assignedTo: u.id,
                status: "OPEN"
            }
        });
        console.log(`- Project Open Opps: ${projOpps}`);

        // Detail check if 0
        if (crmOpps === 0 && projOpps === 0) {
            const allCrm = await prisma.crm_Opportunities.findMany({ where: { assigned_to: u.id } });
            const allProj = await prisma.project_Opportunities.findMany({ where: { assignedTo: u.id } });
            console.log(`  (Total CRM assigned: ${allCrm.length}, Total Project assigned: ${allProj.length})`);

            if (allProj.length > 0) {
                console.log("  Sample Project Opp:", allProj[0]);
            }
        }
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
