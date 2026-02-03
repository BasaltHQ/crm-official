
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching users and their department info...");
    const users = await prisma.users.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            team_id: true,
            department_id: true,
            team_role: true,
        }
    });

    console.log("Total users:", users.length);
    console.table(users);

    console.log("\nFetching Departments...");
    const departments = await prisma.team.findMany({
        where: { team_type: "DEPARTMENT" },
        select: {
            id: true,
            name: true,
            parent_id: true
        }
    });
    console.table(departments);

    console.log("\nChecking for mismatches...");
    users.forEach(u => {
        if (u.department_id) {
            const dept = departments.find(d => d.id === u.department_id);
            if (dept) {
                console.log(`User ${u.email} is in department '${dept.name}' (${dept.id}) with role '${u.team_role}'`);
            } else {
                console.warn(`User ${u.email} has department_id ${u.department_id} but that department does not exist!`);
            }
        }
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
