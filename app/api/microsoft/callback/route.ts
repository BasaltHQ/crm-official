import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/microsoft";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // This is userId

    if (!code || !state) {
        return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    try {
        await exchangeCodeForTokens(state, code);
        // Successful connection
        // Redirect back to OAuth page
        const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return NextResponse.redirect(`${appUrl}/en/cms/oauth?status=success`);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
