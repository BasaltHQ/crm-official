
const { PrismaClient } = require('@prisma/client');

async function main() {
    const client = new PrismaClient();
    console.log('Prisma Client Keys:', Object.keys(client));
    console.log('client.rolePermission:', client.rolePermission);

    // Also check dmmf to see if the model is known
    // console.log('DMMF Datamodel:', client._dmmf.datamodel.models.map(m => m.name));

    await client.$disconnect();
}

main().catch(console.error);
