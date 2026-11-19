import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";
import { prismadb } from "@/lib/prisma";
import { hashPassword } from "@/lib/password-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { token, newPassword } = body;

        if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
            return new NextResponse("Missing fields", { status: 400 });
        }

        if (newPassword.length < 15 || newPassword.length > 128) {
            return new NextResponse("Password must be between 15 and 128 characters", { status: 400 });
        }

        // Decode the URL-friendly base64 token
        let userId: string;
        let rawToken: string;
        try {
            const decoded = Buffer.from(token, "base64url").toString("utf8");
            [userId, rawToken] = decoded.split(":");

            if (!userId || !rawToken || !/^[0-9a-fA-F]{24}$/.test(userId)) {
                return new NextResponse("Invalid token format", { status: 400 });
            }
        } catch {
            return new NextResponse("Invalid token", { status: 400 });
        }

        const user = await prismadb.users.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user || !user.resetToken || !user.resetTokenExpires) {
            return new NextResponse("Invalid or expired token", { status: 400 });
        }

        if (user.resetTokenExpires < new Date()) {
            return new NextResponse("Token has expired", { status: 400 });
        }

        let isValidToken = false;
        if (user.resetToken.startsWith("$2")) {
            isValidToken = await compare(rawToken, user.resetToken);
        } else {
            const candidateHash = createHash("sha256").update(rawToken).digest("hex");
            const expectedBuf = Buffer.from(user.resetToken, "utf8");
            const candidateBuf = Buffer.from(candidateHash, "utf8");
            if (expectedBuf.length === candidateBuf.length) {
                isValidToken = timingSafeEqual(expectedBuf, candidateBuf);
            }
        }

        if (!isValidToken) {
            return new NextResponse("Invalid token", { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);

        await prismadb.users.update({
            where: { id: user.id },
            data: {
                session_version: { increment: 1 },
                password: hashedPassword,
                resetToken: null,
                resetTokenExpires: null,
                mustChangePassword: false,
            },
        });

        return NextResponse.json({ message: "Password successfully reset" });
    } catch (error) {
        systemLogger.error("[RESET_PASSWORD_WITH_TOKEN]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
