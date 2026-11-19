import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { thirdwebAuth, isThirdwebConfigured } from "@/lib/thirdweb-auth";
import { encode } from "next-auth/jwt";

/**
 * POST /api/auth/thirdweb/onboarding
 *
 * Called after Thirdweb login with profile data (email, name).
 * Security rules:
 *   1. Existing user already linked by wallet → verify ACTIVE + !mfaEnabled, then bridge session
 *   2. Active NextAuth session → allow linking wallet ONLY to activeSession.user.id
 *   3. Unauthenticated caller with existing email → reject 409 (never auto-link by email!)
 *   4. Brand new user → create account (respects ALLOW_OPEN_REGISTRATION)
 */
export async function POST(req: NextRequest) {
  try {
    if (!isThirdwebConfigured) {
      return NextResponse.json(
        { error: "Thirdweb authentication is not configured" },
        { status: 503 }
      );
    }

    const token = req.cookies.get("thirdweb_auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authResult = await thirdwebAuth.verifyJWT({ jwt: token });
    if (!authResult.valid || !authResult.parsedJWT.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const address = authResult.parsedJWT.sub;
    const body = await req.json().catch(() => ({}));
    const { email, displayName } = body || {};

    // ── Case 1: Already linked by address ──
    const alreadyLinked = await prismadb.users.findFirst({
      where: { thirdweb_address: address },
    });

    if (alreadyLinked) {
      if (alreadyLinked.userStatus !== "ACTIVE") {
        return NextResponse.json(
          {
            error: "Account is pending approval or inactive.",
            needsRegistration: alreadyLinked.userStatus === "PENDING",
          },
          { status: 403 }
        );
      }
      if ((alreadyLinked as any).mfaEnabled) {
        return NextResponse.json(
          { error: "MFA is enabled on this account. Please sign in with your password and MFA." },
          { status: 403 }
        );
      }

      const res = NextResponse.json({ success: true, userId: alreadyLinked.id, linked: true });
      await bridgeNextAuthSession(res, alreadyLinked);
      return res;
    }

    // ── Case 2: Authenticated NextAuth session linking wallet ──
    const activeSession = await getServerSession(authOptions);
    if (activeSession?.user?.id && !(activeSession as any).error) {
      const sessionUser = await prismadb.users.findUnique({
        where: { id: activeSession.user.id },
      });

      if (!sessionUser || sessionUser.userStatus !== "ACTIVE") {
        return NextResponse.json({ error: "Account is not active" }, { status: 403 });
      }

      if (sessionUser.thirdweb_address && sessionUser.thirdweb_address !== address) {
        return NextResponse.json(
          { error: "Your account is already linked to a different wallet." },
          { status: 409 }
        );
      }

      const updated = await prismadb.users.update({
        where: { id: sessionUser.id },
        data: {
          thirdweb_address: address,
          lastLoginAt: new Date(),
          ...(displayName && !sessionUser.name ? { name: displayName } : {}),
        },
      });

      console.log(
        `[ThirdwebOnboarding] Linked address ${address} to authenticated user (${updated.id})`
      );

      const res = NextResponse.json({ success: true, userId: updated.id, linked: true });
      await bridgeNextAuthSession(res, updated);
      return res;
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required for account registration", needsRegistration: true },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Case 3: Existing user with same email → reject unauthenticated takeover ──
    const existingByEmail = await prismadb.users.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingByEmail) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in with your password first to link your wallet.",
        },
        { status: 409 }
      );
    }

    // ── Case 4: Brand new user → create ──
    const userStatus =
      process.env.ALLOW_OPEN_REGISTRATION === "true" ? "ACTIVE" : "PENDING";

    const newUser = await prismadb.users.create({
      data: {
        email: normalizedEmail,
        name: displayName || null,
        thirdweb_address: address,
        is_admin: false,
        is_account_admin: false,
        userStatus,
        lastLoginAt: new Date(),
      },
    });

    console.log(
      `[ThirdwebOnboarding] Created new user ${newUser.email} (${newUser.id}) with status ${userStatus}`
    );

    const res = NextResponse.json({
      success: true,
      userId: newUser.id,
      linked: true,
      created: true,
      needsRegistration: userStatus === "PENDING",
    });

    if (userStatus === "ACTIVE") {
      await bridgeNextAuthSession(res, newUser);
    }

    return res;
  } catch (error: any) {
    console.error("[ThirdwebOnboarding] Error:", error);
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}

/**
 * Bridge: Issue a NextAuth-compatible JWT session cookie.
 */
async function bridgeNextAuthSession(res: NextResponse, user: any) {
  try {
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[ThirdwebOnboarding] Cannot bridge session — JWT_SECRET not set");
      return;
    }

    const payload = {
      email: user.email,
      name: user.name,
      picture: user.avatar,
      id: user.id,
      session_version: user.session_version ?? 1,
    };

    const secureToken = await encode({
      token: payload,
      secret,
      maxAge: 8 * 60 * 60,
    });

    const insecureToken = secureToken;

    res.cookies.set("__Secure-next-auth.session-token", secureToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    res.cookies.set("next-auth.session-token", insecureToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
  } catch (err) {
    console.error("[ThirdwebOnboarding] Failed to bridge NextAuth session:", err);
  }
}
