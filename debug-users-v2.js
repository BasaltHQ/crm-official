
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching users with department_id...");
    const usersWithDept = await prisma.users.findMany({
        where: {
            department_id: { not: null }
        },
        select: {
            id: true,
            name: true,
            email: true,
            team_id: true,
            department_id: true,
            team_role: true,
        }
    });

    console.log(`Found ${usersWithDept.length} users in departments.`);
    console.table(usersWithDept);

    if (usersWithDept.length === 0) {
        console.log("No users are currently assigned to any department.");

        // Let's check if there are users who might 'look' like they are in a department (e.g. by name/role?)
        // Actually user just probably hasn't assigned them correctly.
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
