import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * Portal Cases API — customer-facing
 * 
 * GET  /api/portal/cases?token=xxx — List own cases
 * POST /api/portal/cases — Create a case from portal
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const token = url.searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Token required" }, { status: 401 });
        }

        const portalToken = await prismadb.crm_Portal_Token.findUnique({
            where: { token },
            include: {
                contact: { select: { id: true, team_id: true } },
            },
        });

        if (
            !portalToken ||
            !portalToken.is_active ||
            (portalToken.expires_at && portalToken.expires_at <= new Date())
        ) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
        }

        if (!portalToken.permissions.includes("view_cases")) {
            return NextResponse.json({ error: "No permission to view cases" }, { status: 403 });
        }

        const orFilters: any[] = [{ contact_id: portalToken.contact_id }];
        if (portalToken.account_id) {
            orFilters.push({ account_id: portalToken.account_id });
        }

        const cases = await prismadb.crm_Cases.findMany({
            where: {
                ...(portalToken.contact?.team_id ? { team_id: portalToken.contact.team_id } : {}),
                OR: orFilters,
            },
            select: {
                id: true,
                case_number: true,
                subject: true,
                status: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                closedAt: true,
                comments: {
                    where: { is_public: true },
                    select: {
                        body: true,
                        createdAt: true,
                        author: { select: { name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(cases);
    } catch (error) {
        console.error("[PORTAL_CASES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { token, subject, description, priority } = body;

        if (!token || !subject) {
            return NextResponse.json({ error: "Token and subject required" }, { status: 400 });
        }

        const portalToken = await prismadb.crm_Portal_Token.findUnique({
            where: { token },
            include: {
                contact: { select: { id: true, team_id: true } },
            },
        });

        if (
            !portalToken ||
            !portalToken.is_active ||
            (portalToken.expires_at && portalToken.expires_at <= new Date())
        ) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
        }

        if (!portalToken.permissions.includes("create_cases")) {
            return NextResponse.json({ error: "No permission to create cases" }, { status: 403 });
        }

        // Auto-generate case number
        const lastCase = await prismadb.crm_Cases.findFirst({
            orderBy: { case_number: "desc" },
            select: { case_number: true },
        });
        const nextNum = lastCase
            ? String(parseInt(lastCase.case_number.replace("CS-", "")) + 1).padStart(5, "0")
            : "00001";

        const newCase = await prismadb.crm_Cases.create({
            data: {
                case_number: `CS-${nextNum}`,
                subject,
                description: description || null,
                priority: priority || "MEDIUM",
                origin: "PORTAL",
                contact_id: portalToken.contact_id,
                account_id: portalToken.account_id || undefined,
                team_id: portalToken.contact?.team_id || undefined,
            },
        });

        return NextResponse.json({
            case_number: newCase.case_number,
            id: newCase.id,
            status: newCase.status,
        });
    } catch (error) {
        console.error("[PORTAL_CASES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
