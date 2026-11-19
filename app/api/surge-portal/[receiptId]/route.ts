import { NextRequest } from "next/server";
import axios from "axios";
import https from "https";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { systemLogger } from "@/lib/logger";

const allowSelfSigned =
    process.env.SURGE_ALLOW_SELF_SIGNED === "true" &&
    process.env.NODE_ENV !== "production";

const httpsAgent = new https.Agent({
    rejectUnauthorized: !allowSelfSigned,
});

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ receiptId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return new Response("Unauthorized Access", { status: 401 });
        }

        const { receiptId } = await context.params;
        if (!receiptId || !/^[a-zA-Z0-9_-]{1,128}$/.test(receiptId)) {
            return new Response("Invalid receipt identifier", { status: 400 });
        }

        const searchParams = request.nextUrl.searchParams;

        const paths = ['/portal/', '/p/', '/pay/', '/widget/'];
        let response = null;

        for (const path of paths) {
            const surgeUrl = new URL(`https://surge.basalthq.com${path}${encodeURIComponent(receiptId)}`);
            searchParams.forEach((value, key) => {
                surgeUrl.searchParams.append(key, value);
            });

            try {
                const res = await axios.get(surgeUrl.toString(), {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    },
                    httpsAgent,
                    responseType: 'text',
                    timeout: 5000,
                    validateStatus: (status) => status === 200,
                });

                response = res;
                break;
            } catch {
                continue;
            }
        }

        if (!response) {
            systemLogger.error(`[SurgeProxy] All paths failed for receipt ${receiptId}`);
            return new Response(`[BasaltCRM] Surge Handshake Error: All portal paths returned 404 or timed out.`, { status: 404 });
        }

        let html = response.data;

        // Inject Base Tag and helper script immediately at the start of <head>
        const injection = `
            <base href="https://surge.basalthq.com/">
            <script>
                window.__PROXIED__ = true;
            </script>
            <style>
                html, body { height: 100% !important; background: #000 !important; color: #fff !important; }
            </style>
        `;

        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${injection}`);
        } else {
            html = `<head>${injection}</head>${html}`;
        }

        return new Response(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "X-Frame-Options": "SAMEORIGIN",
                "Content-Security-Policy": "default-src 'self' https://surge.basalthq.com https:; script-src 'self' 'unsafe-inline' https://surge.basalthq.com; style-src 'self' 'unsafe-inline' https://surge.basalthq.com https://fonts.googleapis.com; frame-ancestors 'self'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https://surge.basalthq.com https: wss:;",
                "X-Content-Type-Options": "nosniff",
                "X-Proxy-Handshake": "verified",
                "Cache-Control": "no-store, must-revalidate",
            }
        });

    } catch (error: any) {
        systemLogger.error("[SurgeProxy] Critical Failure:", error);
        return new Response("Proxy Error", { status: 500 });
    }
}
