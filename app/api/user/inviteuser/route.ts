import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam } from "@/lib/api-utils";
import {
  ALLOWED_TENANT_ROLES,
  isPrivilegedSystemRole,
  normalizeRoleName,
  requirePlatformAdmin,
  sanitizeUser,
} from "@/lib/security/authz";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { logActivity } from "@/actions/audit";
import { hashPassword } from "@/lib/password-utils";
import InviteUserEmail from "@/emails/InviteUser";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import { systemLogger } from "@/lib/logger";
import { verifyEmailIdentity } from "@/lib/aws/ses-verify";

export async function POST(req: Request) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  if (!teamInfo?.teamId) {
    return NextResponse.json(
      { error: "No active team found to invite user to." },
      { status: 400 }
    );
  }

  if (!teamInfo.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Admin privileges required to invite users." },
      { status: 403 }
    );
  }

  // SOC2 CC6.1 / A1.2: Check resource quotas before allowing invitation
  const { checkTeamQuota } = await import("@/lib/quota-service");
  const quota = await checkTeamQuota(teamInfo.teamId, "USERS", teamInfo.userId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.message }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, language, assigned_modules, role = "MEMBER" } = body;

    if (!name || !email || !language || typeof email !== "string" || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name, Email, and Language is required!" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = normalizeRoleName(role);
    const platformAdmin = await requirePlatformAdmin();
    const isPlatformAdmin = Boolean(platformAdmin);

    if (isPrivilegedSystemRole(normalizedRole)) {
      if (!isPlatformAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Only Platform Admins can assign privileged system roles." },
          { status: 403 }
        );
      }
    } else if (!ALLOWED_TENANT_ROLES.has(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role specified." }, { status: 400 });
    }

    const callerRole = normalizeRoleName(teamInfo.teamRole);
    if (normalizedRole === "OWNER" && !isPlatformAdmin && callerRole !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Only an existing Owner or Platform Admin can assign the OWNER role." },
        { status: 403 }
      );
    }

    const safeModules = Array.isArray(assigned_modules)
      ? assigned_modules.filter((m: unknown) => typeof m === "string")
      : undefined;

    const password = `Inv!${randomBytes(15).toString("base64url")}`;

    // Never trust req.headers.get("origin") — prevents phishing link spoofing
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com").replace(/\/+$/, "");
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "BasaltCRM";

    const message = `You have been invited to ${appName} \n\n Your username is: ${normalizedEmail} \n\n Your password is: ${password} \n\n Please login to ${appUrl} \n\n Thank you \n\n ${appName}`;

    // Check if user already exists in local database (case-insensitive)
    const checkexisting = await prismadb.users.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    if (checkexisting) {
      if (checkexisting.team_id && checkexisting.team_id !== teamInfo.teamId) {
        return NextResponse.json(
          { error: "User already belongs to another organization." },
          { status: 409 }
        );
      }

      if (checkexisting.team_id === teamInfo.teamId) {
        return NextResponse.json(
          { error: "User is already a member of this team." },
          { status: 409 }
        );
      }

      if (!isPlatformAdmin && (checkexisting.is_admin || isPrivilegedSystemRole(checkexisting.team_role))) {
        return NextResponse.json(
          { error: "Forbidden: Cannot reassign a Platform Admin." },
          { status: 403 }
        );
      }

      try {
        const user = await prismadb.users.update({
          where: { id: checkexisting.id },
          data: {
            team_id: teamInfo.teamId,
            team_role: normalizedRole,
            assigned_modules: safeModules ?? checkexisting.assigned_modules,
            session_version: { increment: 1 },
          },
        });

        const existingMessage = `You have been added to a team on ${appName}.\n\nPlease login to ${appUrl} to access your team.\n\nThank you\n\n${appName}`;

        await sendEmail({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: `You have been added to a team on ${appName}`,
          text: existingMessage,
          html: `<p>You have been added to a team on <strong>${escapeHtml(appName)}</strong>.</p><p>Please <a href="${escapeHtml(appUrl)}">login</a> to access your team dashboard.</p>`,
        });

        await logActivity(
          "Added Existing User",
          "User Management",
          `Added unassigned user ${normalizedEmail} to team ${teamInfo.teamId}`
        );

        return NextResponse.json(sanitizeUser(user), { status: 200 });
      } catch (err) {
        systemLogger.error("[INVITE_EXISTING_USER]", err);
        return new NextResponse("Error adding existing user to team", { status: 500 });
      }
    } else {
      let user;
      try {
        user = await prismadb.users.create({
          data: {
            name: name.trim(),
            username: "",
            avatar: "",
            account_name: "",
            is_account_admin: isPlatformAdmin && normalizedRole === "PLATFORM_ADMIN",
            is_admin: isPlatformAdmin && normalizedRole === "PLATFORM_ADMIN",
            email: normalizedEmail,
            userStatus: "ACTIVE",
            userLanguage: "en",
            password: await hashPassword(password),
            mustChangePassword: true,
            assigned_modules: safeModules || [],
            team_id: teamInfo.teamId,
            team_role: normalizedRole,
          },
        });
      } catch (createErr: any) {
        systemLogger.error("[INVITE_USER] Failed to create user:", createErr?.message || createErr);
        return NextResponse.json(
          { error: "Failed to create user" },
          { status: 500 }
        );
      }

      if (!user) {
        return new NextResponse("User not created", { status: 500 });
      }

      try {
        const emailHtml = await render(
          InviteUserEmail({
            invitedByUsername: session!.user?.name || "admin",
            username: user.name || "User",
            invitedUserPassword: password,
            userLanguage: "en",
            appUrl,
          })
        );

        await sendEmail({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: `You have been invited to ${appName}`,
          text: message,
          html: emailHtml,
        });
      } catch (emailErr: any) {
        systemLogger.error(`[INVITE_USER] User ${normalizedEmail} created but invitation email failed:`, emailErr?.message || emailErr);
      }

      try {
        await verifyEmailIdentity(user.email);
      } catch (sesError) {
        systemLogger.error(`[SES_VERIFY] Failed to auto-trigger for ${user.email}:`, sesError);
      }

      await logActivity(
        "Invited User",
        "User Management",
        `Invited user ${normalizedEmail} to team ${teamInfo.teamId}`
      );

      return NextResponse.json(sanitizeUser(user), { status: 200 });
    }
  } catch (error) {
    systemLogger.error("[INVITE_USER_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
