import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/digital-ocean-s3";
import { ListObjectsCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
export const dynamic = "force-dynamic";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: any) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json("Unauthorized", { status: 401 });
  }

  const { bucketId } = params;

  if (!bucketId) {
    return NextResponse.json("No bucketId ", { status: 400 });
  }

  const bucketParams = { Bucket: bucketId };

  try {
    const s3 = getS3Client();
    const data = await s3.send(new ListObjectsCommand(bucketParams));
    console.log("Success", data);
    return NextResponse.json({ files: data, success: true }, { status: 200 });
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : "DigitalOcean S3 not configured";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
