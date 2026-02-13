import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismadb: PrismaClient };

// Use a more standard singleton pattern for Prisma v6
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prismadb) {
    return globalForPrisma.prismadb;
  }

  // console.log("🚀 Initializing fresh Prisma v6 Client...");
  const client = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismadb = client;
  }

  return client;
}

export const prismadb = getPrismaClient();
