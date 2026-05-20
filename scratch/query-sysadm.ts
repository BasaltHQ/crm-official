import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.users.findMany({
    take: 10,
    select: { id: true, email: true, name: true, team_id: true }
  });
  console.log("RESULT:" + JSON.stringify(users));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
