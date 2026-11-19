import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { prismadbCrm } from "@/lib/prisma-crm";

const SVIX_TOLERANCE_SECONDS = 300; // 5 minutes

function verifyResendSvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  webhookSecret: string
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !webhookSecret) {
    return false;
  }

  const tsNum = Number(svixTimestamp);
  if (!Number.isFinite(tsNum)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > SVIX_TOLERANCE_SECONDS) {
    return false;
  }

  const keyBytes = webhookSecret.startsWith("whsec_")
    ? Buffer.from(webhookSecret.slice(6), "base64")
    : Buffer.from(webhookSecret, "utf8");

  if (keyBytes.length === 0) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSig = crypto
    .createHmac("sha256", keyBytes)
    .update(signedContent, "utf8")
    .digest();

  const signatures = svixSignature.trim().split(/\s+/);
  for (const entry of signatures) {
    const [version, b64Sig] = entry.split(",");
    if (version !== "v1" || !b64Sig) continue;
    const candidateBuf = Buffer.from(b64Sig, "base64");
    if (
      candidateBuf.length === expectedSig.length &&
      crypto.timingSafeEqual(candidateBuf, expectedSig)
    ) {
      return true;
    }
  }

  return false;
}

function normalizeRecipient(payload: any): string | null {
  // Try common locations
  const candidates: any[] = [];
  if (payload?.data?.to) candidates.push(payload.data.to);
  if (payload?.to) candidates.push(payload.to);
  if (Array.isArray(payload?.data?.rcpt_to)) candidates.push(payload.data.rcpt_to);
  // Normalize to first string email
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) {
      const e = c.find((x) => typeof x === "string" && x.includes("@"));
      if (e) return e.toLowerCase();
    } else if (typeof c === "string" && c.includes("@")) {
      return c.toLowerCase();
    }
  }
  // Some events may embed recipient under payload.email.to
  const e2 = payload?.email?.to;
  if (typeof e2 === "string" && e2.includes("@")) return e2.toLowerCase();
  if (Array.isArray(e2)) {
    const e = e2.find((x: any) => typeof x === "string" && x.includes("@"));
    if (e) return e.toLowerCase();
  }
  return null;
}

function getEventType(payload: any): string {
  return payload?.type || payload?.event || payload?.data?.event || "";
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[RESEND_WEBHOOK] RESEND_WEBHOOK_SECRET is not set");
      return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
    }

    const rawBody = await req.text();
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!verifyResendSvixSignature(rawBody, svixId, svixTimestamp, svixSignature, webhookSecret)) {
      return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const eventType = getEventType(payload).toLowerCase();
    const recipient = normalizeRecipient(payload);

    if (!recipient) {
      return NextResponse.json({ ok: false, reason: "no recipient in payload" }, { status: 200 });
    }

    let status: "VALID" | "INVALID" | "UNKNOWN" = "UNKNOWN";
    // Map common Resend events
    if (eventType.includes("delivered")) status = "VALID";
    else if (eventType.includes("bounce") || eventType.includes("bounced")) status = "INVALID";

    // Update crm_Contact_Candidates by email
    if (status !== "UNKNOWN") {
      await prismadbCrm.crm_Contact_Candidates.updateMany({
        where: { email: recipient },
        data: {
          emailStatus: status,
          confidence: status === "VALID" ? 85 : status === "INVALID" ? 50 : undefined,
          provenance: {
            source: "resend_webhook",
            eventType,
            receivedAt: new Date().toISOString(),
          } as any,
        },
      });

      // Also update global persons if present
      await prismadbCrm.crm_Global_Persons.updateMany({
        where: { email: recipient },
        data: {
          emailStatus: status,
          confidence: status === "VALID" ? 85 : status === "INVALID" ? 50 : undefined,
          provenance: {
            source: "resend_webhook",
            eventType,
            receivedAt: new Date().toISOString(),
          } as any,
        },
      });
    }

    return NextResponse.json({ ok: true, eventType, recipient, status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
