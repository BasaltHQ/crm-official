import { getS3Client } from "@/lib/digital-ocean-s3";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { fillXmlTemplate } from "@/lib/xml-generator";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { invoiceId } = await props.params;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "There is no invoice ID, invoice ID is mandatory" },
      { status: 400 }
    );
  }

  // Get data for invoice body and verify tenant ownership BEFORE generating or uploading XML
  const invoiceData = await prismadb.invoices.findUnique({
    where: {
      id: invoiceId,
    },
  });

  if (!invoiceData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!validateResourceOwnership(teamInfo!.teamId, invoiceData.team_id, teamInfo!.isPlatformAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetTeamId = invoiceData.team_id || teamInfo!.teamId;

  // Get tenant-scoped data for invoice headers
  const myCompany = targetTeamId
    ? await prismadb.myAccount.findFirst({ where: { team_id: targetTeamId } })
    : null;

  const xmlString = fillXmlTemplate(invoiceData, myCompany);
  const buffer = Buffer.from(xmlString);

  const bucketName = process.env.STORAGE_PROVIDER === "s3" ? process.env.S3_BUCKET_NAME : process.env.DO_BUCKET;

  const bucketParamsJSON = {
    Bucket: bucketName,
    Key: `xml/invoice-${invoiceId}.xml`,
    Body: buffer,
    ContentType: "application/xml",
    ContentDisposition: "attachment",
  };

  try {
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand(bucketParamsJSON));
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : "S3 Object Storage not configured";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  //S3 bucket url for the invoice depending on provider
  let urlMoneyS3 = "";
  if (process.env.STORAGE_PROVIDER === "s3") {
    // Basic formatting for S3/OVH style. E.g. https://s3.us-west-or.io.cloud.ovh.us/basaltCRM/xml/...
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, '') || "";
    urlMoneyS3 = `${endpoint}/${bucketName}/xml/invoice-${invoiceId}.xml`;
  } else {
    // DigitalOcean Spaces fallback
    urlMoneyS3 = `https://${bucketName}.${process.env.DO_REGION}.digitaloceanspaces.com/xml/invoice-${invoiceId}.xml`;
  }

  //console.log(urlMoneyS3, "url MoneyS3");

  //Write url to database assigned to invoice
  await prismadb.invoices.update({
    where: {
      id: invoiceId,
    },
    data: {
      money_s3_url: urlMoneyS3,
    },
  });

  return NextResponse.json({ xmlString, invoiceData }, { status: 200 });
}
