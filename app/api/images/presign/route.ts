import { NextRequest, NextResponse } from "next/server";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

const PUBLIC_RASTER_PREFIXES = [
    "avatars/",
    "logos/",
    "banners/",
    "email-assets/",
    "brand/",
];

function extractValidatedS3Key(rawUrl: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }

    if (parsed.protocol !== "https:") return null;

    const s3BucketName = (process.env.S3_BUCKET_NAME || "basaltcrm").toLowerCase();
    const s3Region = (process.env.S3_REGION || "us-west-or").toLowerCase();
    const s3EndpointRaw = process.env.S3_ENDPOINT || `https://s3.${s3Region}.io.cloud.ovh.us/`;

    let endpointHost = "";
    try {
        endpointHost = new URL(s3EndpointRaw).hostname.toLowerCase();
    } catch {
        endpointHost = `s3.${s3Region}.io.cloud.ovh.us`;
    }

    const host = parsed.hostname.toLowerCase();
    const virtualHosts = new Set([
        `${s3BucketName}.${endpointHost}`,
        `${s3BucketName}.s3.${s3Region}.io.cloud.ovh.us`,
        `${s3BucketName}.s3.amazonaws.com`,
        `${s3BucketName}.s3.${s3Region}.amazonaws.com`,
    ]);

    let key = "";
    if (virtualHosts.has(host)) {
        key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    } else if (host === endpointHost) {
        const stripped = parsed.pathname.replace(/^\/+/, "");
        if (!stripped.toLowerCase().startsWith(`${s3BucketName}/`)) {
            return null;
        }
        key = decodeURIComponent(stripped.slice(s3BucketName.length + 1));
    } else {
        return null;
    }

    if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\") || key.includes("\0")) {
        return null;
    }

    return key;
}

export async function GET(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const urlParams = new URL(req.url);
        const url = urlParams.searchParams.get("url");

        if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

        const key = extractValidatedS3Key(url);
        if (!key) {
            return NextResponse.json({ error: "URL does not match configured storage bucket" }, { status: 400 });
        }

        const isPublicPrefix = PUBLIC_RASTER_PREFIXES.some((prefix) => key.startsWith(prefix));
        let authorized = isPublicPrefix || Boolean(teamInfo.isPlatformAdmin);

        if (!authorized && teamInfo.teamId) {
            const doc = await prismadb.documents.findFirst({
                where: { key, team_id: teamInfo.teamId },
                select: { id: true },
            });
            authorized = Boolean(doc);
        }

        if (!authorized) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const client = getBlobServiceClient();
        const presigned = await client.getPresignedUrl(key, 300);
        return NextResponse.redirect(presigned);
    } catch (e) {
        systemLogger.error("[IMAGE_PRESIGN_PROXY_ERROR]", e);
        return NextResponse.json({ error: "Failed to generate presigned URL" }, { status: 500 });
    }
}
