
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sendEmail from "@/lib/sendmail";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse("Unauthenticated", { status: 401 });
    }

    try {
        const body = await req.json();
        const { to, subject, text, html } = body;

        if (!to || !subject || !text) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Use the existing sendEmail utility
        await sendEmail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            text,
            html, // support HTML if needed
        });

        return NextResponse.json({ message: "Email sent successfully" });
    } catch (error) {
        console.error("[EMAIL_SEND_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
