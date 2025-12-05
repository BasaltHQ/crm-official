import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const jobs = await prismadb.jobPosting.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(jobs);
    } catch (error) {
        console.error("[CAREERS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, department, location, type, description, requirements, applyLink } = body;

        const job = await prismadb.jobPosting.create({
            data: {
                title,
                department,
                location,
                type,
                description,
                requirements,
                applyLink,
            },
        });

        return NextResponse.json(job);
    } catch (error) {
        console.error("[CAREERS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, title, department, location, type, description, requirements, applyLink, active } = body;

        const job = await prismadb.jobPosting.update({
            where: { id },
            data: {
                title,
                department,
                location,
                type,
                description,
                requirements,
                applyLink,
                active,
            },
        });

        return NextResponse.json(job);
    } catch (error) {
        console.error("[CAREERS_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return new NextResponse("ID required", { status: 400 });

        await prismadb.jobPosting.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CAREERS_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
