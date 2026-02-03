"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateRoleModules(
    teamId: string,
    role: string,
    scope: string, // 'ORGANIZATION' | 'DEPARTMENT'
    modules: string[]
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { error: "Unauthorized" };
        }

        // Verify Actor is Admin
        const currentUser = await prismadb.users.findUnique({
            where: { email: session.user.email },
        });

        const isSuper = currentUser?.team_role === 'SUPER_ADMIN' || currentUser?.team_role === 'OWNER' || session.user.isAdmin;

        if (!isSuper) {
            return { error: "Permission Denied: Only Super Admins can manage roles." };
        }

        // Upsert permission configuration
        await prismadb.rolePermission.upsert({
            where: {
                team_id_role_scope: {
                    team_id: teamId,
                    role,
                    scope
                }
            },
            update: {
                modules,
            },
            create: {
                team_id: teamId,
                role,
                scope,
                modules,
            }
        });

        revalidatePath("/admin/modules");
        return { success: true };

    } catch (error) {
        console.error("Failed to update role modules:", error);
        return { error: "Internal Server Error" };
    }
}
