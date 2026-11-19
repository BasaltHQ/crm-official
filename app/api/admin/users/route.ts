import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { requirePlatformAdmin, sanitizeUser } from "@/lib/security/authz";
import { hashPassword } from "@/lib/password-utils";
import { systemLogger } from "@/lib/logger";

export async function GET() {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const admin = await requirePlatformAdmin();
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    try {
        const users = await prismadb.users.findMany({
            where: {
                is_admin: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                is_admin: true,
                created_on: true,
            },
        });
        return NextResponse.json(users);
    } catch {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const admin = await requirePlatformAdmin();
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    try {
        const body = await req.json();
        const { name, email, password } = body;

        if (!email || typeof email !== "string") {
            return new NextResponse("Email required", { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await prismadb.users.findFirst({
            where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        });

        if (existingUser) {
            const updatedUser = await prismadb.users.update({
                where: { id: existingUser.id },
                data: { is_admin: true },
            });
            return NextResponse.json(sanitizeUser(updatedUser));
        }

        if (!password || typeof password !== "string" || password.length < 15 || password.length > 128) {
            return new NextResponse("Password must be between 15 and 128 characters", { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        const user = await prismadb.users.create({
            data: {
                name: typeof name === "string" ? name.trim() : "",
                email: normalizedEmail,
                password: hashedPassword,
                is_admin: true,
                userStatus: "ACTIVE",
            },
        });

        return NextResponse.json(sanitizeUser(user));
    } catch (error) {
        systemLogger.error("[ADMIN_USERS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const admin = await requirePlatformAdmin();
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return new NextResponse("ID required", { status: 400 });

    if (id === admin.id) return new NextResponse("Cannot remove your own admin privileges", { status: 400 });

    try {
        await prismadb.users.update({
            where: { id },
            data: {
                is_admin: false,
                session_version: { increment: 1 },
            },
        });
        return NextResponse.json({ success: true });
    } catch {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
