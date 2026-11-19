import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";

// API to add messages module to existing databases
export async function POST(_req: NextRequest) {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const admin = await requirePlatformAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const existingModule = await prismadb.system_Modules_Enabled.findFirst({
            where: { name: "messages" },
        });

        if (existingModule) {
            return NextResponse.json({
                success: true,
                message: "Messages module already exists",
                module: existingModule,
            });
        }

        const maxPositionResult = await prismadb.system_Modules_Enabled.findFirst({
            orderBy: { position: "desc" },
            select: { position: true },
        });

        const newPosition = (maxPositionResult?.position || 0) + 1;

        const messagesModule = await prismadb.system_Modules_Enabled.create({
            data: {
                v: 0,
                name: "messages",
                enabled: true,
                position: newPosition,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Messages module added successfully",
            module: messagesModule,
        });
    } catch (error) {
        console.error("Error adding messages module:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET to check if messages module exists
export async function GET(_req: NextRequest) {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const admin = await requirePlatformAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const messagesModule = await prismadb.system_Modules_Enabled.findFirst({
            where: { name: "messages" },
        });

        return NextResponse.json({
            exists: !!messagesModule,
            module: messagesModule,
        });
    } catch (error) {
        console.error("Error checking messages module:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
