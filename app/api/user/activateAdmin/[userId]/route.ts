import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { requirePlatformAdmin, sanitizeUser } from "@/lib/security/authz";
import { logActivity } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  const admin = await requirePlatformAdmin();
  if (!admin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const user = await prismadb.users.update({
      where: {
        id: params.userId,
      },
      data: {
        is_admin: true,
      },
    });

    await logActivity(
      "Activated Admin",
      "User Management",
      `Granted admin to ${user.email}`
    );

    return NextResponse.json(sanitizeUser(user));
  } catch (error) {
    systemLogger.error("[USER_ADMIN_ACTIVATE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
