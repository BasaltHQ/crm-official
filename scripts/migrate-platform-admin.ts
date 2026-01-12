/**
 * Migration Script: Update SUPER_ADMIN to PLATFORM_ADMIN
 * 
 * Run with: npx ts-node scripts/migrate-platform-admin.ts
 */

import { prismadb } from "../lib/prisma";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    console.log("🔄 Starting migration: SUPER_ADMIN → PLATFORM_ADMIN\n");

    try {
        // Find all users with SUPER_ADMIN role
        const superAdmins = await prismadb.users.findMany({
            where: { team_role: "SUPER_ADMIN" },
            select: { id: true, email: true, name: true, team_role: true }
        });

        console.log(`Found ${superAdmins.length} user(s) with SUPER_ADMIN role:\n`);

        if (superAdmins.length === 0) {
            console.log("✅ No users to update. Migration complete.");
            return;
        }

        for (const user of superAdmins) {
            console.log(`  - ${user.email} (${user.name || "No name"})`);
        }
        console.log("");

        // Update all SUPER_ADMIN users to PLATFORM_ADMIN
        const result = await prismadb.users.updateMany({
            where: { team_role: "SUPER_ADMIN" },
            data: { team_role: "PLATFORM_ADMIN" }
        });

        console.log(`✅ Updated ${result.count} user(s) to PLATFORM_ADMIN\n`);

        // Verify the update
        const remaining = await prismadb.users.count({
            where: { team_role: "SUPER_ADMIN" }
        });

        if (remaining === 0) {
            console.log("✅ Verification passed: No SUPER_ADMIN roles remaining.");
        } else {
            console.warn(`⚠️ Warning: ${remaining} user(s) still have SUPER_ADMIN role.`);
        }

        console.log("\n🎉 Migration complete!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

main();
