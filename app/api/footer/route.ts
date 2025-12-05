import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

// Base section titles that should always exist
const BASE_SECTIONS = ["Products", "Company", "Legal"];

export async function GET() {
    try {
        const settings = await prismadb.footerSetting.findFirst();
        let sections = await prismadb.footerSection.findMany({
            include: {
                links: {
                    orderBy: { order: "asc" },
                },
            },
            orderBy: { order: "asc" },
        });

        // Create base sections if they don't exist
        if (sections.length === 0) {
            for (let i = 0; i < BASE_SECTIONS.length; i++) {
                await prismadb.footerSection.create({
                    data: { title: BASE_SECTIONS[i], order: i, isBase: true }
                });
            }
            sections = await prismadb.footerSection.findMany({
                include: { links: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" },
            });
        }

        return NextResponse.json({ settings, sections });
    } catch (error) {
        console.error("[FOOTER_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const { settings, sections } = body;

        // Update Settings
        if (settings) {
            const existingSettings = await prismadb.footerSetting.findFirst();
            if (existingSettings) {
                await prismadb.footerSetting.update({
                    where: { id: existingSettings.id },
                    data: {
                        tagline: settings.tagline,
                        copyrightText: settings.copyrightText,
                        socialXUrl: settings.socialXUrl,
                        socialDiscordUrl: settings.socialDiscordUrl,
                    },
                });
            } else {
                await prismadb.footerSetting.create({
                    data: {
                        tagline: settings.tagline,
                        copyrightText: settings.copyrightText,
                        socialXUrl: settings.socialXUrl,
                        socialDiscordUrl: settings.socialDiscordUrl,
                    },
                });
            }
        }

        // Update Sections and Links
        if (sections && Array.isArray(sections)) {
            // Get existing section IDs
            const existingSections = await prismadb.footerSection.findMany();
            const existingIds = existingSections.map(s => s.id);
            const newIds = sections.filter((s: any) => s.id).map((s: any) => s.id);

            // Delete sections that were removed (but not base sections)
            for (const existing of existingSections) {
                if (!newIds.includes(existing.id) && !existing.isBase) {
                    await prismadb.footerLink.deleteMany({ where: { sectionId: existing.id } });
                    await prismadb.footerSection.delete({ where: { id: existing.id } });
                }
            }

            // Process each section
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];

                if (section.id && existingIds.includes(section.id)) {
                    // Update existing section
                    await prismadb.footerSection.update({
                        where: { id: section.id },
                        data: { title: section.title, order: i },
                    });
                } else {
                    // Create new section
                    const created = await prismadb.footerSection.create({
                        data: { title: section.title, order: i, isBase: false },
                    });
                    section.id = created.id;
                }

                // Handle links
                if (section.links && Array.isArray(section.links)) {
                    await prismadb.footerLink.deleteMany({ where: { sectionId: section.id } });
                    if (section.links.length > 0) {
                        await prismadb.footerLink.createMany({
                            data: section.links.map((link: any, index: number) => ({
                                text: link.text,
                                url: link.url,
                                order: index,
                                sectionId: section.id,
                            })),
                        });
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[FOOTER_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
