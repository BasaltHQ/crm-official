
export { };
const { PrismaClient } = require('@prisma/client');
const prismadb = new PrismaClient();

async function getRefData() {
    try {
        const stages = await prismadb.crm_Opportunities_Sales_Stages.findMany();
        const types = await prismadb.crm_Opportunities_Type.findMany();
        const projectOpp = await prismadb.project_Opportunities.findFirst({
            where: { title: { contains: "APK" } }
        });

        console.log("Stages:", stages);
        console.log("Types:", types);
        console.log("Project Opp:", projectOpp);
    } finally {
        await prismadb.$disconnect();
    }
}

getRefData();
