import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRandomPassword } from "@/lib/utils";
import { hash } from "bcryptjs";
import resendHelper from "@/lib/resend";
import PasswordResetEmail from "@/emails/PasswordReset";
import { logActivity } from "@/actions/audit";

export async function POST(
    req: Request,
    props: { params: Promise<{ userId: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        // Optional: Check if session user has admin privileges
        // const requestingUser = ...

        const user = await prismadb.users.findUnique({
            where: {
                id: params.userId,
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                userLanguage: true, // Needed for email template
            }
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        const tempPassword = generateRandomPassword();
        const hashedPassword = await hash(tempPassword, 12);

        await prismadb.users.update({
            where: {
                id: params.userId,
            },
            data: {
                password: hashedPassword,
                mustChangePassword: true, // Force reset on next login
            },
        });

        // Send Email
        const resend = await resendHelper();
        if (resend) {
            try {
                await resend.emails.send({
                    from: process.env.EMAIL_FROM!,
                    to: user.email,
                    subject: "BasaltCRM - Temporary Password",
                    text: `Your temporary password is: ${tempPassword}`,
                    react: PasswordResetEmail({
                        username: user.name || "User",
                        avatar: user.avatar,
                        email: user.email,
                        password: tempPassword,
                        userLanguage: user.userLanguage,
                    }),
                });
            } catch (emailError) {
                console.error("[ADMIN_RESET_EMAIL_ERROR]", emailError);
                // Continue execution, we still reset the password
            }
        }

        await logActivity(
            "Admin Reset Password",
            "User Management",
            `Reset password for ${user.email} (Temporary sent)`
        );

        return NextResponse.json({ message: "Password reset and email sent." });
    } catch (error) {
        console.log("[ADMIN_RESET_PASSWORD_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
