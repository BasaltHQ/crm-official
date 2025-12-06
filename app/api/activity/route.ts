import { NextResponse } from "next/server";
import { getRecentActivities } from "@/actions/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const activities = await getRecentActivities(50); // Fetch last 50 activities
        return NextResponse.json(activities);
    } catch (error) {
        console.error("[ACTIVITY_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
