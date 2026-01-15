
export { };
const { PrismaClient } = require('@prisma/client');
const prismadb = new PrismaClient();

async function archive() {
    try {
        const projectOpp = await prismadb.project_Opportunities.findFirst({
            where: { title: { contains: "APK" } }
        });

        if (projectOpp) {
            await prismadb.project_Opportunities.update({
                where: { id: projectOpp.id },
                data: { status: "ARCHIVED" }
            });
            console.log("Archived:", projectOpp.id);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prismadb.$disconnect();
    }
}

archive();
