import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { thirdwebAuth, isThirdwebConfigured } from "@/lib/thirdweb-auth";
import { encode } from "next-auth/jwt";

/**
 * GET /api/auth/thirdweb/bridge?email=...&name=...
 *
 * Full-navigation bridge endpoint. After Thirdweb login sets the
 * thirdweb_auth_token cookie (via fetch), the client redirects HERE
 * via window.location.href. Because this is a real navigation (not
 * a fetch), the Set-Cookie headers are processed by the browser
 * reliably.
 */

/** Build a redirect URL using NEXTAUTH_URL as the canonical origin. */
function buildRedirect(path: string): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3002";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isThirdwebConfigured) {
      return NextResponse.redirect(buildRedirect("/sign-in"));
    }

    const token = req.cookies.get("thirdweb_auth_token")?.value;
    if (!token) {
      return NextResponse.redirect(buildRedirect("/sign-in"));
    }

    const authResult = await thirdwebAuth.verifyJWT({ jwt: token });
    if (!authResult.valid || !authResult.parsedJWT.sub) {
      return NextResponse.redirect(buildRedirect("/sign-in"));
    }

    const address = authResult.parsedJWT.sub;

    // Extract optional profile data from query params
    const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() || undefined;
    const displayName = req.nextUrl.searchParams.get("name") || undefined;

    // ── Case 1: Already linked by address ──
    const alreadyLinked = await prismadb.users.findFirst({
      where: { thirdweb_address: address },
    });

    let user = alreadyLinked;

    if (alreadyLinked) {
      if (alreadyLinked.userStatus === "PENDING") {
        return NextResponse.redirect(buildRedirect("/register"));
      }
      if (alreadyLinked.userStatus !== "ACTIVE") {
        return NextResponse.redirect(buildRedirect("/sign-in?error=AccountInactive"));
      }
      if ((alreadyLinked as any).mfaEnabled) {
        return NextResponse.redirect(buildRedirect("/sign-in?error=MfaRequired"));
      }
    }

    // ── Case 2: Authenticated NextAuth session linking wallet ──
    if (!user) {
      const activeSession = await getServerSession(authOptions);
      if (activeSession?.user?.id && !(activeSession as any).error) {
        const sessionUser = await prismadb.users.findUnique({
          where: { id: activeSession.user.id },
        });
        if (!sessionUser || sessionUser.userStatus !== "ACTIVE") {
          return NextResponse.redirect(buildRedirect("/sign-in?error=AccountInactive"));
        }
        if (sessionUser.thirdweb_address && sessionUser.thirdweb_address !== address) {
          return NextResponse.redirect(buildRedirect("/sign-in?error=WalletAlreadyLinked"));
        }
        user = await prismadb.users.update({
          where: { id: sessionUser.id },
          data: {
            thirdweb_address: address,
            lastLoginAt: new Date(),
          },
        });
        console.log(`[ThirdwebBridge] Linked ${address} → authenticated user (${user.id})`);
      }
    }

    // ── Case 3: Unauthenticated caller with email — block takeover if email exists, else create new user ──
    if (!user && email) {
      const existingByEmail = await prismadb.users.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });

      if (existingByEmail) {
        return NextResponse.redirect(buildRedirect("/sign-in?error=EmailAlreadyExists"));
      }

      const userStatus =
        process.env.ALLOW_OPEN_REGISTRATION === "true" ? "ACTIVE" : "PENDING";

      user = await prismadb.users.create({
        data: {
          email,
          name: displayName || null,
          thirdweb_address: address,
          is_admin: false,
          is_account_admin: false,
          userStatus,
          lastLoginAt: new Date(),
        },
      });

      console.log(`[ThirdwebBridge] Created ${email} (${user.id}) status=${userStatus}`);

      if (userStatus !== "ACTIVE") {
        return NextResponse.redirect(buildRedirect("/register"));
      }
    }

    // ── No user found and no email to create one ──
    if (!user || user.userStatus !== "ACTIVE") {
      return NextResponse.redirect(buildRedirect("/sign-in"));
    }

    // ── Bridge NextAuth session ──
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[ThirdwebBridge] JWT_SECRET not set");
      return NextResponse.redirect(buildRedirect("/sign-in"));
    }

    const sessionToken = await encode({
      token: {
        email: user.email,
        name: user.name,
        picture: user.avatar,
        id: user.id,
        session_version: user.session_version ?? 1,
      },
      secret,
      maxAge: 8 * 60 * 60,
    });

    const res = NextResponse.redirect(buildRedirect("/dashboard"));

    const isSecure =
      process.env.NEXTAUTH_URL?.startsWith("https://") || !!process.env.VERCEL;

    const cookieName = isSecure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    res.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    console.log(
      `[ThirdwebBridge] Session bridged for ${user.email} → cookie=${cookieName}, redirecting to /dashboard`
    );

    return res;
  } catch (error: any) {
    console.error("[ThirdwebBridge] Error:", error?.message, error?.stack);
    return NextResponse.json(
      { error: "Bridge failed" },
      { status: 500 }
    );
  }
}
