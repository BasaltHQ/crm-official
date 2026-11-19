import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getGraphClient } from "@/lib/microsoft";
import { systemLogger } from "@/lib/logger";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // This is userId

    if (!code || !state) {
        return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    // Security: Verify session matches state to prevent CSRF
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.id !== state) {
        return NextResponse.json({ error: "Unauthorized session mismatch" }, { status: 403 });
    }

    try {
        await exchangeCodeForTokens(state, code);
        
        // [WEBHOOK SETUP] Register push notifications via Graph API
        const appUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
        try {
            const clientState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
            if (!clientState) {
                throw new Error("MICROSOFT_WEBHOOK_CLIENT_STATE is not configured");
            }
            const graphClient = await getGraphClient(state);
            if (graphClient) {
                const subPayload = {
                    changeType: "created,updated",
                    notificationUrl: `${appUrl}/api/webhooks/microsoft`,
                    resource: "me/messages",
                    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days (max is ~4230 minutes)
                    clientState,
                };
                
                const subscription = await graphClient.api("/subscriptions").post(subPayload);
                if (subscription && subscription.id) {
                    import('@/lib/prisma').then(({ prismadb }) => {
                        prismadb.microsoft_Tokens.updateMany({
                            where: { user: state },
                            data: {
                                subscription_id: subscription.id,
                                subscription_expires_at: new Date(subscription.expirationDateTime)
                            }
                        }).catch(console.error);
                    });
                    systemLogger.info(`[MICROSOFT_WEBHOOK] Registered push for user ${state}`);
                }
            }
        } catch (subErr: any) {
             systemLogger.error("[MICROSOFT_WEBHOOK_SETUP_FAILED]", subErr?.message || subErr);
             // Fail gracefully so user still gets connected
        }

        // Successful connection
        // Redirect back to OAuth page
        return NextResponse.redirect(`${appUrl}/en/cms/oauth?status=success`);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
