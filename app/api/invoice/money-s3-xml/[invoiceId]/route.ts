import { authOptions } from "@/lib/auth";
import { getS3Client } from "@/lib/digital-ocean-s3";
import { prismadb } from "@/lib/prisma";
import { fillXmlTemplate } from "@/lib/xml-generator";
import { PutObjectAclCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const fs = require("fs");

export async function GET(req: Request, { params }: any) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ status: 401, body: { error: "Unauthorized" } });
  }

  //console.log(myCompany, "myCompany");

  const { invoiceId } = params;

  if (!invoiceId) {
    return NextResponse.json({
      status: 400,
      body: { error: "There is no inovice ID, invoice ID is mandatory" },
    });
  }

  //Get data for invoice headers
  const myCompany = await prismadb.myAccount.findFirst({});

  //Get data for invoice body
  const invoiceData = await prismadb.invoices.findFirst({
    where: {
      id: invoiceId,
    },
  });

  //This function will generate XML file from template and data
  const xmlString = fillXmlTemplate(invoiceData, myCompany);

  //write xml to file in public folder /public/tmp/[invoiceId].xml
  //fs.writeFileSync(`public/tmp/${invoiceId}.xml`, xmlString);
  //fs.writeFileSync(`public/tmp/${invoiceData}.json`, invoiceData);

  //Store raw XML string in buffer
  const buffer = Buffer.from(xmlString);

  //Upload xml to S3 bucket and return url
  const bucketParamsJSON = {
    Bucket: process.env.DO_BUCKET,
    Key: `xml/invoice-${invoiceId}.xml`,
    Body: buffer,
    ContentType: "application/xml",
    ContentDisposition: "inline",
    ACL: "public-read" as const,
  };

  try {
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand(bucketParamsJSON));
  } catch (e) {
    const msg = (e && (e as any).message) ? (e as any).message : "DigitalOcean S3 not configured";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  //S3 bucket url for the invoice
  const urlMoneyS3 = `https://${process.env.DO_BUCKET}.${process.env.DO_REGION}.digitaloceanspaces.com/xml/invoice-${invoiceId}.xml`;

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
