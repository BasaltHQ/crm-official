import CrmSidebar from "./components/CrmSidebar";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveRoleModules } from "@/actions/permissions/get-effective-permissions";

export default async function CrmLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    let allowedModules: string[] = [];
    let isMember = false;

    if (session?.user?.id) {
        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: {
                team_role: true,
                team_id: true,
                department_id: true,
                assigned_modules: true // Capture override if exists
            }
        });

        isMember = user?.team_role === "MEMBER";

        if (user?.team_role === 'SUPER_ADMIN' || user?.team_role === 'OWNER') {
            allowedModules = ['*'];
        } else if (user) {
            // Check specific assignments first
            if (user.assigned_modules && user.assigned_modules.length > 0) {
                allowedModules = user.assigned_modules;
            } else {
                // Fetch Role Permissions
                const contextId = user.department_id || user.team_id;
                const scope = user.department_id ? 'DEPARTMENT' : 'ORGANIZATION';

                if (contextId && user.team_role) {
                    allowedModules = await getEffectiveRoleModules(contextId, user.team_role, scope);
                }
            }
        }
    }

    return (
        <div className="flex h-full w-full overflow-hidden">
            <CrmSidebar isMember={isMember} allowedModules={allowedModules} />
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-32 md:pb-0">
                {children}
            </div>
        </div>
    );
}
