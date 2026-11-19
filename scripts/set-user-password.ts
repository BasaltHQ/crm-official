/**
 * One-off admin script to set a specific user's password in DATABASE_URL.
 * Requires TARGET_EMAIL and NEW_PASSWORD environment variables (no hardcoded defaults).
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password-utils";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function main() {
  const email = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
  const newPassword = (process.env.NEW_PASSWORD || "").trim();

  if (!email || !newPassword) {
    throw new Error("TARGET_EMAIL and NEW_PASSWORD environment variables are required.");
  }
  if (newPassword.length < 15 || newPassword.length > 128) {
    throw new Error("NEW_PASSWORD must be between 15 and 128 characters.");
  }

  const user = await prisma.users.findFirst({ where: { email } });
  if (!user) {
    throw new Error(`User not found for email: ${email}. Aborting update.`);
  }

  const hashed = await hashPassword(newPassword);
  await prisma.users.update({
    where: { id: user.id },
    data: {
      password: hashed,
      session_version: { increment: 1 },
    },
  });

  console.log(`Password updated and existing sessions invalidated for ${email} (user id: ${user.id}).`);
}

main()
  .catch((e) => {
    console.error("[set-user-password] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
