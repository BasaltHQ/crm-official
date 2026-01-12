import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/actions/audit";

export async function PATCH(
    req: Request,
    props: { params: Promise<{ userId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        const body = await req.json();
        const { team_role } = body;

        if (!team_role) {
            return new NextResponse("Role is required", { status: 400 });
        }

        // Validate role enum if necessary, but Prisma will catch invalid values if strictly typed
        // Allowed: "ADMIN" | "MEMBER" | "VIEWER"

        const user = await prismadb.users.update({
            where: {
                id: params.userId,
            },
            data: {
                team_role,
                // Ensure we don't accidentally set is_admin here unless explicitly desired. 
                // We leave is_admin alone as it is likely for Super Admins.
            },
        });

        await logActivity(
            "Updated User Role",
            "User Management",
            `Updated role for ${user.email} to ${team_role}`
        );

        return NextResponse.json(user);
    } catch (error) {
        console.log("[USER_ROLE_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
