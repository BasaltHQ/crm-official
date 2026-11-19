import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { fillXmlTemplate } from "@/lib/xml-generator";
import { NextResponse } from "next/server";
import { sendTeamEmail } from "@/lib/email/team-mailer";

export async function GET(req: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const params = await props.params;
  const { invoiceId } = params;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "Bad Request - invoice id is mandatory" },
      { status: 400 }
    );
  }

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
  if (!targetTeamId) {
    return NextResponse.json({ error: "No team context associated with invoice" }, { status: 400 });
  }

  const myCompany = await prismadb.myAccount.findFirst({
    where: { team_id: targetTeamId },
  });

  const xmlString = fillXmlTemplate(invoiceData, myCompany);
  const buffer = Buffer.from(xmlString);

  if (!buffer) {
    return NextResponse.json(
      { error: "Bad Request - buffer is empty. Nothing to send." },
      { status: 400 }
    );
  }

  const message = `Hello, \n\n Please find attached invoice in XML format. \n\n Thank you \n\n ${process.env.NEXT_PUBLIC_APP_NAME}`;

  if (!myCompany || !myCompany.email_accountant) {
    return NextResponse.json(
      {
        message:
          "There is no accountant email in the database for your team. Nothing to send. Fill the accountant email in the settings.",
      },
      { status: 400 }
    );
  }

  await sendTeamEmail(targetTeamId, {
    to: myCompany.email_accountant,
    subject: `${process.env.NEXT_PUBLIC_APP_NAME} invoice in XML format for ERP system`,
    text: message,
    attachments: [
      {
        filename: `invoice-${invoiceId}.xml`,
        content: buffer,
        contentType: "application/xml",
      },
    ],
  });
  return NextResponse.json({
    status: 200,
    body: { message: "Email with XML send to its destination" },
  });
}
