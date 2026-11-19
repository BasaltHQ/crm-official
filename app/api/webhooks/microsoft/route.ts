import { NextResponse } from "next/server";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { getGraphClient } from "@/lib/microsoft";
import { systemLogger } from "@/lib/logger";

function verifyClientState(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string" || !actual) return false;
  const actualBuf = Buffer.from(actual, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return (
    actualBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(actualBuf, expectedBuf)
  );
}

// Verify Microsoft Subscriptions (they send validationToken query parameter)
export async function POST(req: Request) {
  try {
    const expectedClientState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
    if (!expectedClientState) {
      systemLogger.error("[MICROSOFT_WEBHOOK] MICROSOFT_WEBHOOK_CLIENT_STATE is not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const url = new URL(req.url);
    const validationToken = url.searchParams.get("validationToken");

    // Subscription validation response
    if (validationToken) {
      return new NextResponse(validationToken, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const payload = await req.json();

    // Loop through notifications
    if (payload && Array.isArray(payload.value)) {
      for (const notification of payload.value) {
        if (!verifyClientState(notification?.clientState, expectedClientState)) {
          systemLogger.warn("[MICROSOFT_WEBHOOK] Rejected notification with invalid clientState");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sid = notification.subscriptionId;
        const resourceId = notification.resource; // Usually like Users/{id}/Messages/{id}

        systemLogger.info(`[MICROSOFT_WEBHOOK] Notification for ${sid}. Resource: ${resourceId}`);

        // 1. Look up ms token by subscription_id
        // 2. Refresh graphClient via getGraphClient(userId)
        // 3. fetch message from MS Graph endpoint: /me/messages/{messageId}
        // 4. Transform to crm_Emails row 
        // 5. Insert into DB if not exists
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    systemLogger.error("[MICROSOFT_WEBHOOK_ERROR]", error?.message || error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
