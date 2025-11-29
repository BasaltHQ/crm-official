import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/digital-ocean-s3";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json("Unauthorized", { status: 401 });
  }

  try {
    const s3 = getS3Client();
    const buckets = await s3.send(new ListBucketsCommand({}));
    console.log(buckets, "s3 buckets");
    return NextResponse.json({ buckets, success: true }, { status: 200 });
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : "DigitalOcean S3 not configured";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
