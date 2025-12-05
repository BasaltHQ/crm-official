import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcrypt";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const users = await prismadb.users.findMany({
            where: {
                is_admin: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                is_admin: true,
                createdAt: true,
            }
        });
        return NextResponse.json(users);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        const { name, email, password } = body;

        if (!email || !password) return new NextResponse("Missing fields", { status: 400 });

        const existingUser = await prismadb.users.findUnique({
            where: { email }
        });

        if (existingUser) {
            // If user exists, just make them admin
            const updatedUser = await prismadb.users.update({
                where: { email },
                data: { is_admin: true }
            });
            return NextResponse.json(updatedUser);
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prismadb.users.create({
            data: {
                name,
                email,
                password: hashedPassword,
                is_admin: true,
                userStatus: "ACTIVE"
            }
        });

        return NextResponse.json(user);
    } catch (error) {
        console.log("[ADMIN_USERS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return new NextResponse("ID required", { status: 400 });

    // Prevent deleting yourself
    if (id === session.user.id) return new NextResponse("Cannot delete yourself", { status: 400 });

    try {
        // We don't delete the user, just remove admin access
        await prismadb.users.update({
            where: { id },
            data: { is_admin: false }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
