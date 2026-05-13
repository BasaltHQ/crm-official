import { prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Invalid or missing token", { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "Unknown IP";
  const timestamp = new Date();

  try {
    // Check Leads
    const lead = await prismadb.crm_Leads.findFirst({
      where: { opt_in_verification_token: token },
    });

    if (lead) {
      await prismadb.crm_Leads.update({
        where: { id: lead.id },
        data: {
          double_opt_in_boolean: true,
          double_opt_in_ip: ip,
          double_opt_in_timestamp: timestamp,
          opt_in_verification_token: null, // Clear token after use
        },
      });

      return new NextResponse(
        "<html><body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9;'><h2>Subscription Confirmed!</h2><p>Thank you for verifying your email address. You are now successfully subscribed.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Check Contacts
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { opt_in_verification_token: token },
    });

    if (contact) {
      await prismadb.crm_Contacts.update({
        where: { id: contact.id },
        data: {
          double_opt_in_boolean: true,
          double_opt_in_ip: ip,
          double_opt_in_timestamp: timestamp,
          opt_in_verification_token: null,
        },
      });

      return new NextResponse(
        "<html><body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9;'><h2>Subscription Confirmed!</h2><p>Thank you for verifying your email address. You are now successfully subscribed.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse("Invalid or expired token", { status: 404 });
  } catch (error) {
    console.error("Verification error:", error);
    return new NextResponse("An error occurred during verification", { status: 500 });
  }
}
