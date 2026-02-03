
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching departments...");
    const departments = await prisma.team.findMany({
        where: { team_type: "DEPARTMENT" },
        select: { id: true, name: true }
    });

    const deptIds = new Set(departments.map(d => d.id));
    console.log("Department IDs:", Array.from(deptIds));

    console.log("\nFetching users...");
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

    let usersInDeptByTeamId = 0;
    let usersInDeptByDeptId = 0;

    users.forEach(u => {
        const inDeptViaTeamId = u.team_id && deptIds.has(u.team_id);
        const inDeptViaDeptId = u.department_id && deptIds.has(u.department_id);

        if (inDeptViaTeamId) {
            const dept = departments.find(d => d.id === u.team_id);
            console.log(`User ${u.email} has team_id pointing to Department '${dept.name}'`);
            usersInDeptByTeamId++;
        }

        if (inDeptViaDeptId) {
            const dept = departments.find(d => d.id === u.department_id);
            console.log(`User ${u.email} has department_id pointing to Department '${dept.name}'`);
            usersInDeptByDeptId++;
        }
    });

    console.log(`\nSummary:`);
    console.log(`Users with team_id = Dept: ${usersInDeptByTeamId}`);
    console.log(`Users with department_id = Dept: ${usersInDeptByDeptId}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
