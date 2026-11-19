import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request, props: { params: Promise<{ moduleId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  const admin = await requirePlatformAdmin();
  if (!admin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const mod = await prismadb.system_Modules_Enabled.update({
      where: {
        id: params.moduleId,
      },
      data: {
        enabled: true,
      },
    });

    return NextResponse.json(mod);
  } catch (error) {
    systemLogger.error("[ADMIN_ACTIVATE_MODULE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
