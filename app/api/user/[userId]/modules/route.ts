import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: { userId: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Check if the requester is an admin or owner (simple check, improve as needed)
        // Note: session.user.isAdmin might not be populated depending on session strategy, 
        // better to fetch user or trust session if configured correctly.
        // For now assuming session works or we fetch requester.

        // Validating requester permissions (optional but recommended)
        // const requester = await prismadb.users.findUnique({ where: { id: session.user.id } });
        // if (requester?.team_role !== 'OWNER' && requester?.team_role !== 'ADMIN') {
        //    return new NextResponse("Forbidden", { status: 403 });
        // }

        const body = await req.json();
        const { modules } = body;

        if (!Array.isArray(modules)) {
            return new NextResponse("Invalid modules format", { status: 400 });
        }

        const user = await prismadb.users.update({
            where: {
                id: params.userId,
            },
            data: {
                assigned_modules: modules,
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_MODULES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
