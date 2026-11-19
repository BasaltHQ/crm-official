import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

const isValidId = (id: any) => typeof id === "string" && id.length === 24;

//Create new account route
export async function POST(req: Request) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;
  try {
    const teamId = teamInfo?.teamId;
    const body = await req.json();

    // SOC2 CC6.1 / A1.2: Check account quotas before allowing creation
    if (teamId) {
      const { checkTeamQuota } = await import("@/lib/quota-service");
      const quota = await checkTeamQuota(teamId, "ACCOUNTS", session!.user.id);
      if (!quota.allowed) {
        return NextResponse.json({ error: quota.message }, { status: 403 });
      }
    }
    const {
      name,
      office_phone,
      website,
      fax,
      company_id,
      vat,
      email,
      billing_street,
      billing_postal_code,
      billing_city,
      billing_state,
      billing_country,
      shipping_street,
      shipping_postal_code,
      shipping_city,
      shipping_state,
      shipping_country,
      description,
      assigned_to,
      status,
      annual_revenue,
      member_of,
      industry,
      custom_fields,
    } = body;

    if (assigned_to && teamId && !teamInfo!.isPlatformAdmin) {
      const assignee = await prismadb.users.findFirst({
        where: { id: assigned_to, team_id: teamId },
        select: { id: true },
      });
      if (!assignee) {
        return new NextResponse("Forbidden — invalid assignee", { status: 403 });
      }
    }

    const accountCount = await (prismadb.crm_Accounts as any).count({
      where: { team_id: isValidId(teamId) ? teamId : undefined }
    });
    const generatedCompanyId = `BSLT-${(accountCount + 1).toString().padStart(4, "0")}`;

    const escapeRegExp = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

    let finalIndustryId = industry || null;
    if (industry && industry.trim() !== "") {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(industry);
      if (!isObjectId) {
        // MongoDB does not support `mode: 'insensitive'` — use regex instead
        const existingIndustry = await (prismadb.crm_Industry_Type as any).findFirst({
          where: { name: { equals: industry } }
        });
        if (existingIndustry) {
          finalIndustryId = existingIndustry.id;
        } else {
          const newIndustry = await (prismadb.crm_Industry_Type as any).create({
            data: { name: industry, v: 0 }
          });
          finalIndustryId = newIndustry.id;
        }
      }
    } else {
      finalIndustryId = null;
    }

    const searchOrConditions: any[] = [
      { name: { equals: name } }
    ];

    if (email && email.trim() !== "") {
      searchOrConditions.push({ email: { equals: email } });
    }

    if (office_phone && office_phone.trim() !== "") {
      searchOrConditions.push({ office_phone: { equals: office_phone } });
    }

    const existingAccount = await (prismadb.crm_Accounts as any).findFirst({
      where: {
        team_id: isValidId(teamId) ? teamId : undefined,
        OR: searchOrConditions,
      },
    });

    if (existingAccount) {
      // Merge: Update existing account with new data if current fields are empty
      const updatedAccount = await (prismadb.crm_Accounts as any).update({
        where: { id: existingAccount.id },
        data: {
          office_phone: existingAccount.office_phone || office_phone,
          website: existingAccount.website || website,
          fax: existingAccount.fax || fax,
          company_id: existingAccount.company_id || generatedCompanyId,
          vat: existingAccount.vat || vat,
          email: existingAccount.email || email,
          billing_street: existingAccount.billing_street || billing_street,
          billing_postal_code: existingAccount.billing_postal_code || billing_postal_code,
          billing_city: existingAccount.billing_city || billing_city,
          billing_state: existingAccount.billing_state || billing_state,
          billing_country: existingAccount.billing_country || billing_country,
          shipping_street: existingAccount.shipping_street || shipping_street,
          shipping_postal_code: existingAccount.shipping_postal_code || shipping_postal_code,
          shipping_city: existingAccount.shipping_city || shipping_city,
          shipping_state: existingAccount.shipping_state || shipping_state,
          shipping_country: existingAccount.shipping_country || shipping_country,
          description: existingAccount.description || description,
          annual_revenue: existingAccount.annual_revenue || annual_revenue,
          member_of: existingAccount.member_of || member_of,
          industry_type: (existingAccount.industry || finalIndustryId) ? { connect: { id: existingAccount.industry || finalIndustryId } } : undefined,
          updatedBy: session!.user.id,
        },
      });
      await logActivityInternal(session!.user.id, "UPDATE", "crm_Accounts", `Merged duplicate account: ${updatedAccount.name} (${updatedAccount.id})`, teamId || undefined);
      return NextResponse.json({ newAccount: updatedAccount }, { status: 200 });
    }

    const newAccount = await (prismadb.crm_Accounts as any).create({
      data: {
        v: 0,
        assigned_team: isValidId(teamId) ? { connect: { id: teamId } } : undefined,
        createdBy: session!.user.id,
        updatedBy: session!.user.id,
        name,
        office_phone,
        website,
        fax,
        company_id: generatedCompanyId,
        vat,
        email,
        billing_street,
        billing_postal_code,
        billing_city,
        billing_state,
        billing_country,
        shipping_street,
        shipping_postal_code,
        shipping_city,
        shipping_state,
        shipping_country,
        description: description || undefined,
        assigned_to_user: assigned_to ? { connect: { id: assigned_to } } : undefined,
        status: "Active",
        annual_revenue: annual_revenue || undefined,
        member_of: member_of || undefined,
        industry_type: finalIndustryId ? { connect: { id: finalIndustryId } } : undefined,
        custom_fields: custom_fields || undefined,
      },
    });

    await logActivityInternal(session!.user.id, "CREATE", "crm_Accounts", `Created account: ${newAccount.name} (${newAccount.id})`, teamId || undefined);
    return NextResponse.json({ newAccount }, { status: 200 });
  } catch (error: any) {
    systemLogger.error("[NEW_ACCOUNT_POST]", error);
    return new NextResponse(error?.message || "Internal error", { status: 500 });
  }
}

//Update account route
export async function PUT(req: Request) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;
  try {
    const body = await req.json();
    const {
      id,
      name,
      office_phone,
      website,
      fax,
      company_id,
      vat,
      email,
      billing_street,
      billing_postal_code,
      billing_city,
      billing_state,
      billing_country,
      shipping_street,
      shipping_postal_code,
      shipping_city,
      shipping_state,
      shipping_country,
      description,
      assigned_to,
      status,
      annual_revenue,
      member_of,
      industry,
      custom_fields,
    } = body;

    if (!id) {
      return new NextResponse("Missing account id", { status: 400 });
    }

    const existing = await prismadb.crm_Accounts.findUnique({
      where: { id },
      select: { id: true, team_id: true },
    });
    if (!existing) {
      return new NextResponse("Account not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, existing.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (assigned_to && existing.team_id && !teamInfo!.isPlatformAdmin) {
      const assignee = await prismadb.users.findFirst({
        where: { id: assigned_to, team_id: existing.team_id },
        select: { id: true },
      });
      if (!assignee) {
        return new NextResponse("Forbidden — invalid assignee", { status: 403 });
      }
    }

    const escapeRegExp = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

    let finalIndustryId = industry || null;
    if (industry && industry.trim() !== "") {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(industry);
      if (!isObjectId) {
        // MongoDB does not support `mode: 'insensitive'` — use regex instead
        const existingIndustry = await (prismadb.crm_Industry_Type as any).findFirst({
          where: { name: { equals: industry } }
        });
        if (existingIndustry) {
          finalIndustryId = existingIndustry.id;
        } else {
          const newIndustry = await (prismadb.crm_Industry_Type as any).create({
            data: { name: industry, v: 0 }
          });
          finalIndustryId = newIndustry.id;
        }
      }
    } else {
      finalIndustryId = null;
    }

    const newAccount = await (prismadb.crm_Accounts as any).update({
      where: {
        id,
      },
      data: {
        v: 0,
        updatedBy: session!.user.id,
        name,
        office_phone,
        website,
        fax,
        company_id,
        vat,
        email,
        billing_street,
        billing_postal_code,
        billing_city,
        billing_state,
        billing_country,
        shipping_street,
        shipping_postal_code,
        shipping_city,
        shipping_state,
        shipping_country,
        description,
        assigned_to_user: assigned_to ? { connect: { id: assigned_to } } : (assigned_to === null ? { disconnect: true } : undefined),
        status: status,
        annual_revenue,
        member_of,
        industry_type: finalIndustryId ? { connect: { id: finalIndustryId } } : (industry === null ? { disconnect: true } : undefined),
        ...(custom_fields !== undefined ? { custom_fields } : {}),
      },
    });

    await logActivityInternal(session!.user.id, "UPDATE", "crm_Accounts", `Updated account: ${newAccount.name} (${id})`, teamInfo?.teamId || undefined);
    return NextResponse.json({ newAccount }, { status: 200 });
  } catch (error: any) {
    systemLogger.error("[UPDATE_ACCOUNT_PUT]", error);
    return new NextResponse(error?.message || "Internal error", { status: 500 });
  }
}

//GET all accounts route
export async function GET(req: Request) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;
  try {
    const where: any = {};
    if (teamInfo?.teamId) {
      where.team_id = teamInfo.teamId;
    } else {
      return NextResponse.json([], { status: 200 });
    }

    const accounts = await (prismadb.crm_Accounts as any).findMany({
      where: where
    });

    return NextResponse.json(accounts, { status: 200 });
  } catch (error) {
    systemLogger.error("[ACCOUNTS_GET]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}
