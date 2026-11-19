import { NextResponse } from "next/server";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

// Plans that support multiple brands
const MULTI_BRAND_PLANS = ["ENTERPRISE", "EXEMPT", "SCALE"];

const BRAND_STRING_FIELDS = [
    "brand_label",
    "company_name",
    "industry",
    "location",
    "website_url",
    "phone_number",
    "company_email",
    "tagline",
    "logo_url",
    "primary_brand_color",
    "mission_statement",
    "core_philosophy",
    "audience_description",
    "business_model_summary",
    "ideal_customer_profile",
    "persona_preset",
    "brand_voice",
    "agent_tone",
    "communication_style",
    "outreach_approach",
    "objection_handling",
    "email_compliance_footer",
    "sms_opt_out_message",
    "call_script_intro",
    "follow_up_cadence",
    "business_hours",
    "signature_html",
] as const;

const BRAND_ARRAY_FIELDS = [
    "core_values",
    "strategic_focus_areas",
    "competitive_advantages",
    "key_products_services",
    "pain_points_solved",
    "messaging_themes",
    "cta_preferences",
    "do_not_say",
    "preferred_channel_priority",
    "emoji_allowed_in",
    "subsidiaries",
    "partner_categories",
] as const;

function sanitizeBrandPayload(raw: Record<string, any>): Record<string, any> {
    const clean: Record<string, any> = {};

    for (const key of BRAND_STRING_FIELDS) {
        if (raw[key] === null || typeof raw[key] === "string") {
            clean[key] = raw[key];
        }
    }

    for (const key of BRAND_ARRAY_FIELDS) {
        if (Array.isArray(raw[key])) {
            clean[key] = raw[key].filter((item: unknown): item is string => typeof item === "string");
        }
    }

    if (typeof raw.grammar_accuracy === "number" && Number.isFinite(raw.grammar_accuracy)) {
        clean.grammar_accuracy = Math.max(0, Math.min(100, Math.round(raw.grammar_accuracy)));
    }
    if (typeof raw.emoji_frequency === "number" && Number.isFinite(raw.emoji_frequency)) {
        clean.emoji_frequency = Math.max(0, Math.min(100, Math.round(raw.emoji_frequency)));
    }
    if (typeof raw.avoid_em_dashes === "boolean") {
        clean.avoid_em_dashes = raw.avoid_em_dashes;
    }
    if (typeof raw.require_verified_account === "boolean") {
        clean.require_verified_account = raw.require_verified_account;
    }
    if (raw.signature_meta !== undefined) {
        clean.signature_meta = raw.signature_meta;
    }
    if (raw.resource_links !== undefined) {
        clean.resource_links = raw.resource_links;
    }

    return clean;
}

async function resolveTargetTeam(teamId: string | null) {
    if (!teamId) return null;
    const team = await prismadb.team.findUnique({
        where: { id: teamId },
        select: { id: true, subscription_plan: true, parent_id: true },
    });
    if (!team) return null;

    if (team.parent_id) {
        const parent = await prismadb.team.findUnique({
            where: { id: team.parent_id },
            select: { id: true, subscription_plan: true },
        });
        if (parent) return parent;
    }
    return { id: team.id, subscription_plan: team.subscription_plan };
}

export async function GET() {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return new NextResponse("Forbidden: Admin privileges required", { status: 403 });
        }

        const resolved = await resolveTargetTeam(teamInfo!.teamId);
        if (!resolved) {
            return new NextResponse("Team Error", { status: 403 });
        }

        const targetTeamId = resolved.id;
        const plan = String(resolved.subscription_plan || "FREE");
        const isMultiBrand = MULTI_BRAND_PLANS.includes(plan);

        if (isMultiBrand) {
            const brands = await prismadb.teamBrandIdentity.findMany({
                where: { team_id: targetTeamId },
                orderBy: [{ is_default: "desc" }, { createdAt: "asc" }],
            });
            return NextResponse.json({ brands, multiBrand: true, plan });
        } else {
            const brand = await prismadb.teamBrandIdentity.findFirst({
                where: { team_id: targetTeamId, is_default: true },
            });
            return NextResponse.json(brand || {});
        }
    } catch {
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return new NextResponse("Forbidden: Admin privileges required", { status: 403 });
        }

        const resolved = await resolveTargetTeam(teamInfo!.teamId);
        if (!resolved) {
            return new NextResponse("Team Error", { status: 403 });
        }

        const targetTeamId = resolved.id;
        const rawBody = await req.json();
        const { brandId, _createNew } = rawBody || {};
        const safeBrandData = sanitizeBrandPayload(rawBody || {});

        if (brandId) {
            if (typeof brandId !== "string") {
                return new NextResponse("Invalid brandId", { status: 400 });
            }

            const existingBrand = await prismadb.teamBrandIdentity.findUnique({
                where: { id: brandId },
            });

            if (!existingBrand || existingBrand.team_id !== targetTeamId) {
                return new NextResponse("Forbidden", { status: 403 });
            }

            const updatedBrand = await prismadb.teamBrandIdentity.update({
                where: { id: brandId },
                data: {
                    ...safeBrandData,
                    setup_completed: true,
                },
            });
            return NextResponse.json(updatedBrand);
        } else {
            const plan = String(resolved.subscription_plan || "FREE");
            const isMultiBrand = MULTI_BRAND_PLANS.includes(plan);

            if (isMultiBrand && safeBrandData.brand_label && _createNew) {
                const newBrand = await prismadb.teamBrandIdentity.create({
                    data: {
                        ...safeBrandData,
                        team_id: targetTeamId,
                        is_default: false,
                        setup_completed: true,
                    },
                });
                return NextResponse.json(newBrand);
            }

            const existing = await prismadb.teamBrandIdentity.findFirst({
                where: { team_id: targetTeamId, is_default: true },
            });

            if (existing) {
                const updatedBrand = await prismadb.teamBrandIdentity.update({
                    where: { id: existing.id },
                    data: {
                        ...safeBrandData,
                        setup_completed: true,
                    },
                });
                return NextResponse.json(updatedBrand);
            } else {
                const newBrand = await prismadb.teamBrandIdentity.create({
                    data: {
                        ...safeBrandData,
                        team_id: targetTeamId,
                        is_default: true,
                        setup_completed: true,
                    },
                });
                return NextResponse.json(newBrand);
            }
        }
    } catch (error) {
        console.error("[BRAND_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return new NextResponse("Forbidden: Admin privileges required", { status: 403 });
        }

        const resolved = await resolveTargetTeam(teamInfo!.teamId);
        if (!resolved) {
            return new NextResponse("Team Error", { status: 403 });
        }

        const targetTeamId = resolved.id;
        const plan = String(resolved.subscription_plan || "FREE");
        if (!MULTI_BRAND_PLANS.includes(plan)) {
            return new NextResponse("Multi-brand not available on your plan", { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const brandId = searchParams.get("id");
        if (!brandId) {
            return new NextResponse("Brand ID required", { status: 400 });
        }

        const brand = await prismadb.teamBrandIdentity.findUnique({
            where: { id: brandId },
        });

        if (!brand || brand.team_id !== targetTeamId) {
            return new NextResponse("Brand not found", { status: 404 });
        }

        if (brand.is_default) {
            return new NextResponse("Cannot delete the default brand", { status: 400 });
        }

        await prismadb.teamBrandIdentity.delete({
            where: { id: brandId },
        });

        return NextResponse.json({ success: true });
    } catch {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
