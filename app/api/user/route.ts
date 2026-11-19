import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password-utils";
import { logActivityInternal } from "@/actions/audit";
import sendEmail from "@/lib/sendmail";
import { systemLogger } from "@/lib/logger";
import {
  isReservedTeamSlug,
  isSelfServicePlanSlug,
  normalizeTeamSlug,
  sanitizeUser,
} from "@/lib/security/authz";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { isThirdwebConfigured, thirdwebAuth } from "@/lib/thirdweb-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name, username, email, language, password, confirmPassword,
      companyName, planId, avatar, billingCycle = "monthly",
      paymentMethod = "card", wallet, termsAccepted, turnstile_token
    } = body;

    // Validate required fields
    if (!name || !email || !language || !password || !confirmPassword || !companyName || !planId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return new NextResponse("Invalid email address", { status: 400 });
    }

    // Verify Captcha
    if (process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY && process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
      if (!turnstile_token) {
        return new NextResponse("Captcha missing", { status: 400 });
      }
      
      const formData = new URLSearchParams();
      formData.append('secret', process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY);
      formData.append('response', turnstile_token);

      const captchaRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const outcome = await captchaRes.json();
      if (!outcome.success) {
        return new NextResponse("Captcha validation failed", { status: 400 });
      }
    }

    // SOC2 Consent Requirement
    if (!termsAccepted) {
      return new NextResponse("You must accept the Terms of Service and Privacy Policy.", { status: 400 });
    }

    if (password !== confirmPassword) {
      return new NextResponse("Password does not match", { status: 400 });
    }

    // NIST 800-63B Alignment: Length over complexity.
    if (!password || password.length < 8) {
      return new NextResponse(
        "Password must be at least 8 characters long. We recommend a long passphrase.",
        { status: 400 }
      );
    }
    if (password.length > 128) {
      return new NextResponse("Password too long (max 128 characters).", { status: 400 });
    }

    // Check if user already exists (case-insensitive)
    const checkexisting = await prismadb.users.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    let canUpgradeThirdwebUser = false;
    if (checkexisting) {
      // Only allow upgrading a pre-created Thirdweb record if Thirdweb is configured
      // AND the caller proves ownership of that wallet via a valid thirdweb_auth_token cookie.
      const isThirdwebProvisioned = Boolean(
        checkexisting.thirdweb_address &&
        !checkexisting.team_id &&
        !checkexisting.password
      );

      if (isThirdwebProvisioned && isThirdwebConfigured) {
        try {
          const { cookies } = await import("next/headers");
          const cookieStore = await cookies();
          const thirdwebToken = cookieStore.get("thirdweb_auth_token")?.value;
          if (thirdwebToken) {
            const authResult = await thirdwebAuth.verifyJWT({ jwt: thirdwebToken });
            if (
              authResult.valid &&
              authResult.parsedJWT?.sub &&
              authResult.parsedJWT.sub.toLowerCase() === checkexisting.thirdweb_address!.toLowerCase()
            ) {
              canUpgradeThirdwebUser = true;
            }
          }
        } catch (twErr) {
          systemLogger.error("[Register] Thirdweb JWT verification failed:", twErr);
        }
      }

      if (!canUpgradeThirdwebUser) {
        return new NextResponse("User already exist", { status: 409 });
      }

      systemLogger.info(`[Register] Verified Thirdweb-provisioned user ${normalizedEmail} completing registration`);
    }

    // Normalize and validate team slug
    const slug = normalizeTeamSlug(companyName);
    if (!slug) {
      return new NextResponse("Invalid company name.", { status: 400 });
    }

    if (isReservedTeamSlug(companyName) || isReservedTeamSlug(slug)) {
      return new NextResponse("Company name is reserved. Please choose another.", { status: 409 });
    }

    const checkSlug = await prismadb.team.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } }
    });

    if (checkSlug) {
      return new NextResponse("Company name already taken (slug collision). Please choose another.", { status: 409 });
    }

    // Fetch the selected plan
    let selectedPlan: any;
    if (planId === "enterprise-contact") {
      selectedPlan = await prismadb.plan.findFirst({
        where: { slug: "ENTERPRISE" }
      });

      if (!selectedPlan) {
        selectedPlan = {
          id: "enterprise-placeholder",
          name: "Enterprise",
          slug: "ENTERPRISE",
          price: 0,
          features: ["all"],
          isActive: true,
        };
      }
    } else {
      selectedPlan = await prismadb.plan.findUnique({
        where: { id: planId }
      });
    }

    if (!selectedPlan) {
      return new NextResponse("Invalid Plan selected", { status: 400 });
    }

    const selectedSlugUpper = String(selectedPlan.slug || "").trim().toUpperCase();

    // Block Enterprise since it requires a custom contract
    if (planId === "enterprise-contact" || selectedSlugUpper === "ENTERPRISE") {
      try {
        await sendEmail({
          to: "sysadm@basalthq.com, sales@basalthq.com",
          subject: `Interest in ${selectedPlan.name} Plan`,
          text: `User ${name} (${normalizedEmail}) from company ${companyName} tried to register for the ${selectedPlan.name} plan.`,
          html: `<p>User <strong>${escapeHtml(name)}</strong> (${escapeHtml(normalizedEmail)}) from company <strong>${escapeHtml(companyName)}</strong> tried to register for the <strong>${escapeHtml(selectedPlan.name)}</strong> plan.</p><p>As payment flows are custom for enterprise, their account was not created.</p>`
        });
      } catch (err) {
        systemLogger.error("[Register] Failed to send plan interest email", err);
      }
      return new NextResponse("Thank you for your interest in Enterprise. Our team has been notified and will contact you shortly to configure your instance.", { status: 400 });
    }

    if (!isSelfServicePlanSlug(selectedPlan.slug) || selectedPlan.isActive === false) {
      return new NextResponse("Selected plan is not available for self-service registration.", { status: 400 });
    }

    const isFree = selectedSlugUpper === "STARTER";

    let initialStatus: string = isFree ? "ACTIVE" : "PENDING";

    let finalPrice = selectedPlan.price;
    if (!isFree && billingCycle === "annual") {
      if (paymentMethod === "crypto" && wallet) {
        finalPrice = (selectedPlan.price * 12) * 0.75;
      } else {
        finalPrice = (selectedPlan.price * 12) * 0.80;
      }
    }

    const hashedPassword = await hashPassword(password);

    let avatarUrl: string | null = null;
    if (typeof avatar === "string" && avatar.trim().length > 0) {
      const dataUriMatch = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
        avatar.trim()
      );
      if (!dataUriMatch) {
        return new NextResponse(
          "Invalid avatar format. Only base64 PNG, JPEG, WEBP, or GIF images are allowed.",
          { status: 400 }
        );
      }

      const rawMime = dataUriMatch[1].toLowerCase();
      const mimeType = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
      const base64Data = dataUriMatch[2].replace(/\s+/g, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
        return new NextResponse("Avatar image must not exceed 2 MB.", { status: 400 });
      }

      const isPng =
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;
      const isJpeg =
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;
      const isGif =
        buffer.length >= 6 &&
        buffer.subarray(0, 4).toString("ascii") === "GIF8" &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61;
      const isWebp =
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP";

      const validMagic =
        (mimeType === "image/png" && isPng) ||
        (mimeType === "image/jpeg" && isJpeg) ||
        (mimeType === "image/gif" && isGif) ||
        (mimeType === "image/webp" && isWebp);

      if (!validMagic) {
        return new NextResponse("Avatar file content does not match declared image type.", {
          status: 400,
        });
      }

      const extMap: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
      };
      const extension = extMap[mimeType] || "png";

      try {
        const { getBlobServiceClient } = await import("@/lib/s3-storage");
        const container = process.env.BLOB_STORAGE_CONTAINER;
        if (container) {
          const serviceClient = getBlobServiceClient();
          const containerClient = serviceClient.getContainerClient(container);
          const key = `avatars/public/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

          const blobClient = containerClient.getBlockBlobClient(key);
          await blobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: mimeType },
          });
          avatarUrl = blobClient.url;
          systemLogger.info("[Register] Avatar uploaded successfully:", avatarUrl);
        }
      } catch (uploadError) {
        systemLogger.error("[Register] Avatar upload failed:", uploadError);
        avatarUrl = null;
      }
    }

    let user;
    if (checkexisting && canUpgradeThirdwebUser) {
      // Upgrade verified Thirdweb-provisioned user
      user = await prismadb.users.update({
        where: { id: checkexisting.id },
        data: {
          name,
          username,
          email: normalizedEmail,
          avatar: avatarUrl || checkexisting.avatar,
          userLanguage: "en",
          password: hashedPassword,
          userStatus: initialStatus === "PENDING" ? "PENDING" : "ACTIVE",
          is_account_admin: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
        },
      });
    } else {
      // Brand new user
      user = await (prismadb.users as any).create({
        data: {
          name,
          username,
          email: normalizedEmail,
          avatar: avatarUrl,
          userLanguage: "en",
          password: hashedPassword,
          userStatus: initialStatus === "PENDING" ? "PENDING" : "ACTIVE",
          is_admin: false,
          is_account_admin: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
        },
      });
    }

    // Create Team
    const team = await prismadb.team.create({
      data: {
        name: companyName,
        slug: slug,
        owner_id: user.id,
        plan_id: selectedPlan.id,
        subscription_plan: selectedSlugUpper as any,
        status: initialStatus === "PENDING" ? "PENDING" : "ACTIVE",
        members: {
          connect: { id: user.id }
        }
      }
    });

    // Update User with Team ID (and role)
    await prismadb.users.update({
      where: { id: user.id },
      data: {
        team_id: team.id,
        team_role: "OWNER"
      }
    });

    // 3. Optional: Create initial subscription record
    // This allows the billing dashboard to show their status immediately
    const sub = await prismadb.crm_Subscriptions.create({
      data: {
        tenant_id: team.id,
        customer_email: normalizedEmail,
        customer_wallet: wallet,
        plan_name: selectedPlan.name,
        amount: finalPrice,
        billing_day: new Date().getDate(),
        interval: billingCycle,
        next_billing_date: new Date(new Date().setMonth(new Date().getMonth() + (billingCycle === "annual" ? 12 : 1))),
        status: initialStatus === "PENDING" ? "OVERDUE" : "ACTIVE", // Overdue if payment required
        last_charge_status: initialStatus === "PENDING" ? "PENDING_FIRST_PAYMENT" : "SYSTEM_FREE_TIER",
        discount_applied: billingCycle === "annual"
      }
    });

    // 4. Auto-trigger SES email verification (PLATFORM_SES) for the new team owner
    // Only workspace (non-freemail) emails go through SES verification.
    // Freemail users (gmail, yahoo, etc.) are allowed to use the CRM but are NOT
    // eligible for outbound email services — they get a warning modal instead.
    const { isFreemailDomain } = await import("@/lib/freemail");
    const isFreemail = isFreemailDomain(normalizedEmail);

    if (isFreemail) {
      // Freemail: mark email as "verified" so they bypass the SES gate,
      // but set the isFreemailAccount flag so the UI shows a warning modal.
      await prismadb.users.update({
        where: { id: user.id },
        data: { sesEmailVerified: true, isFreemailAccount: true }
      });
      systemLogger.info(`[Register] Freemail account (${normalizedEmail}) — SES skipped, warning flag set (Team: ${team.id})`);
    } else {
      // Workspace email: trigger full SES verification flow
      try {
        const { verifyEmailIdentity } = await import("@/lib/aws/ses-verify");

        // Create the TeamEmailConfig record with PLATFORM_SES
        await prismadb.teamEmailConfig.create({
          data: {
            team_id: team.id,
            purpose: "GENERAL",
            provider: "PLATFORM_SES",
            from_email: normalizedEmail,
            from_name: companyName,
            verification_status: "PENDING",
          }
        });

        if (isFree) {
          // Trigger the SES verification email immediately for free plans
          await verifyEmailIdentity(normalizedEmail);
          systemLogger.info(`[Register] SES verification triggered for ${normalizedEmail} (Team: ${team.id})`);
        } else {
          // Defer verification until Stripe payment succeeds
          systemLogger.info(`[Register] SES verification deferred pending payment for ${normalizedEmail} (Team: ${team.id})`);
        }
      } catch (sesError) {
        // Non-blocking — registration still succeeds if SES trigger fails
        systemLogger.error("[Register] Auto SES verification failed (non-fatal):", sesError);
      }
    }

    let paymentUrl = null;
    let activeInvoiceId = null;

    if (!isFree) {
      // 4. Generate Stripe Checkout Link for Paid Plans
      try {
        const { createStripeCheckoutSession } = await import("@/lib/stripe");

        const checkout = await createStripeCheckoutSession(
          team.id,
          normalizedEmail,
          selectedSlugUpper,
          billingCycle as "monthly" | "annual",
          team.name
        );
        
        if (checkout && checkout.url) {
          paymentUrl = checkout.url;
        }
      } catch (stripeError) {
        systemLogger.error("[Register] Stripe checkout generation failed:", stripeError);
        return new NextResponse("Failed to secure checkout link. Please try again.", { status: 500 });
      }
    }

    // Notify sysadm and sales that a new team was spawned
    try {
      await sendEmail({
        to: "sysadm@basalthq.com, sales@basalthq.com",
        subject: `New Team Created: ${team.name} (${selectedPlan.name})`,
        text: `A new team has been spawned.\n\nTeam Name: ${team.name}\nTeam ID: ${team.id}\nPlan: ${selectedPlan.name}\nOwner: ${user.name} (${user.email})`,
        html: `<p>A new team has been spawned.</p>
               <ul>
                 <li><strong>Team Name:</strong> ${escapeHtml(team.name)}</li>
                 <li><strong>Team ID:</strong> ${escapeHtml(team.id)}</li>
                 <li><strong>Plan:</strong> ${escapeHtml(selectedPlan.name)}</li>
                 <li><strong>Owner:</strong> ${escapeHtml(user.name)} (${escapeHtml(user.email)})</li>
               </ul>`
      });
    } catch (emailErr) {
      systemLogger.error("[Register] Failed to send new team notification email", emailErr);
    }

    return NextResponse.json({
      ...sanitizeUser(user),
      teamId: team.id,
      requiresPayment: !isFree,
      isFreemailAccount: isFreemail,
      paymentUrl,
      invoiceId: activeInvoiceId,
      amount: finalPrice.toString()
    });

  } catch (error) {
    systemLogger.error("[USERS_POST]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}

export async function GET() {
  const session: any = await getServerSession(authOptions as any);
  if (!session || !session.user) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }
  // Return just the current authenticated user context (lightweight for popup)
  return NextResponse.json({ user: session.user });
}
