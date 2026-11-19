import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole } from "@/lib/security/authz";
import { hashPassword } from "@/lib/password-utils";
import TempPasswordEmail from "@/emails/TempPasswordEmail";
import { logActivity } from "@/actions/audit";
import { render } from "@react-email/render";
import sendEmail from "@/lib/sendmail";
import { systemLogger } from "@/lib/logger";

export async function POST(
    req: Request,
    props: { params: Promise<{ userId: string }> }
) {
    const params = await props.params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return new NextResponse("Unauthorized: Admin privileges required", { status: 403 });
        }

        const user = await prismadb.users.findUnique({
            where: {
                id: params.userId,
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                userLanguage: true,
                team_id: true,
                is_admin: true,
                team_role: true,
            },
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, user.team_id, teamInfo!.isPlatformAdmin)) {
            return await unauthorizedResponse("ADMIN_RESET_PASSWORD", `Users:${params.userId}`);
        }

        if (
            !teamInfo!.isPlatformAdmin &&
            (user.is_admin || isPrivilegedSystemRole(user.team_role))
        ) {
            return new NextResponse("Forbidden: Cannot reset password for a Platform Admin", { status: 403 });
        }

        const tempPassword = `Tmp!${randomBytes(15).toString("base64url")}`;
        const hashedPassword = await hashPassword(tempPassword);

        await prismadb.users.update({
            where: {
                id: params.userId,
            },
            data: {
                session_version: { increment: 1 },
                password: hashedPassword,
                mustChangePassword: true,
            },
        });

        try {
            const emailHtml = await render(
                TempPasswordEmail({
                    username: user.name || "User",
                    avatar: user.avatar,
                    email: user.email,
                    password: tempPassword,
                    userLanguage: user.userLanguage || "en",
                })
            );

            await sendEmail({
                to: user.email,
                subject: "BasaltCRM - Temporary Password",
                text: `Your temporary password is: ${tempPassword}`,
                html: emailHtml,
                replyTo: "support@basalthq.com",
            });
        } catch (emailError) {
            systemLogger.error("[ADMIN_RESET_EMAIL_ERROR]", emailError);
        }

        await logActivity(
            "Admin Reset Password",
            "User Management",
            `Reset password for ${user.email} (Temporary sent)`
        );

        return NextResponse.json({ message: "Password reset and email sent." });
    } catch (error) {
        systemLogger.error("[ADMIN_RESET_PASSWORD_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
