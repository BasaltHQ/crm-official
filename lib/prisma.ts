import { PrismaClient } from "./prisma-client";

const globalForPrisma = globalThis as unknown as { prismadb_v5: PrismaClient };

// Force recreate with a new global key: v5 (Internal Client Path)
// This bypasses stale node_modules caching in Turbopack
function getPrismaClient() {
  let instance = globalForPrisma.prismadb_v5;

  if (!instance) {
    console.log("🚀 Initializing fresh Prisma v5 Client from INTERNAL PATH...");
    instance = new PrismaClient();
  }

  return instance;
}

export const prismadb = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismadb_v5 = prismadb;
}
