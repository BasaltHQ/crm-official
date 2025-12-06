

require('dotenv').config();
import { PrismaClient } from '@prisma/client';

const prismadb = new PrismaClient();

async function main() {
    console.log("Starting migration...");
    const targetTeam = await prismadb.team.findUnique({
        where: { slug: "ledger1" },
    });

    if (!targetTeam) {
        console.error("Target team 'ledger1' not found");
        return;
    }

    const teamId = targetTeam.id;
    console.log(`Found Team: ${targetTeam.name} (${teamId})`);

    // Models list matching Prisma Client properties
    const models = [
        "crm_Accounts",
        "crm_Leads",
        "crm_Opportunities",
        "crm_Contacts",
        "crm_Contracts",
        "boards",
        "employees",
        "invoices",
        "documents",
        "tasks",
        "crm_Accounts_Tasks",
        "crm_Lead_Pools",
    ];

    for (const modelName of models) {
        // @ts-ignore
        const model = prismadb[modelName];
        if (!model) {
            console.error(`Model ${modelName} not found on prisma client`);
            continue;
        }
        try {
            const res = await model.updateMany({
                where: { team_id: { isSet: false } },
                data: { team_id: teamId }
            });
            console.log(`Updated ${modelName}: ${res.count} records`);
        } catch (e: any) {
            console.error(`Error updating ${modelName}:`, e.message);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prismadb.$disconnect();
    });
