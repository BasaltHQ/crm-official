
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const integrations = await prisma.tenant_Integrations.findMany();
    console.log('Integrations:', JSON.stringify(integrations, null, 2));

    const teams = await prisma.team.findMany();
    console.log('Teams:', JSON.stringify(teams, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
