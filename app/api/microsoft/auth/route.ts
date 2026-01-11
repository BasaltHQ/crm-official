import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMicrosoftAuthUrl } from "@/lib/microsoft";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const url = getMicrosoftAuthUrl(userId);
        return NextResponse.redirect(url);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
