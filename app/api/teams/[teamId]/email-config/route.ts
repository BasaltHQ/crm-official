import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { verifyEmailIdentity, getIdentityVerificationStatus, deleteEmailIdentity } from "@/lib/aws/ses-verify";

export async function GET(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const config = await prismadb.teamEmailConfig.findUnique({
        where: { team_id: params.teamId }
    });

    if (!config) {
        return NextResponse.json(null);
    }

    // Proactively check status if it was pending
    if (config.verification_status === "PENDING") {
        const currentStatus = await getIdentityVerificationStatus(config.from_email);
        if (currentStatus !== "PENDING") {
            const updated = await prismadb.teamEmailConfig.update({
                where: { id: config.id },
                data: { verification_status: currentStatus }
            });
            return NextResponse.json(updated);
        }
    }

    return NextResponse.json(config);
}

export async function POST(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { email } = await req.json();
    if (!email) return new NextResponse("Email required", { status: 400 });

    try {
        // Trigger AWS Verification
        await verifyEmailIdentity(email);

        // Save Config
        const config = await prismadb.teamEmailConfig.upsert({
            where: { team_id: params.teamId },
            create: {
                team_id: params.teamId,
                from_email: email,
                verification_status: "PENDING",
            },
            update: {
                from_email: email,
                verification_status: "PENDING", // Reset to pending on change
            }
        });

        return NextResponse.json(config);
    } catch (error: any) {
        return new NextResponse(error.message || "Failed to set config", { status: 500 });
    }
}

export async function DELETE(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const config = await prismadb.teamEmailConfig.findUnique({
        where: { team_id: params.teamId }
    });

    if (!config) {
        return new NextResponse("Configuration not found", { status: 404 });
    }

    try {
        // Attempt to remove verification identity from AWS SES to clean up
        // We only delete if it was successfully created or verification started
        await deleteEmailIdentity(config.from_email);
    } catch (error) {
        console.error("Failed to delete SES identity", error);
        // Continue to delete from DB even if SES fails
    }

    await prismadb.teamEmailConfig.delete({
        where: { id: config.id }
    });

    return new NextResponse(null, { status: 204 });
}
