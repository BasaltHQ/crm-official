import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.users.findMany({
    select: { id: true, email: true, name: true, team_id: true, team_role: true }
  });
  console.log("USERS_LIST:", JSON.stringify(users, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
