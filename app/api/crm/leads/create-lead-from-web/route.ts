import { prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";
import sendEmail from "@/lib/sendmail";

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    return NextResponse.json(
      { message: "Invalid content-type" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const headers = req.headers;

  if (!body) {
    return NextResponse.json({ message: "No body" }, { status: 400 });
  }
  if (!headers) {
    return NextResponse.json({ message: "No headers" }, { status: 400 });
  }

  const { firstName, lastName, account, job, email, phone, lead_source } = body;

  //Validate auth with token from .env.local
  const token = headers.get("authorization");

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.BASALT_TOKEN) {
    return NextResponse.json(
      { message: "BASALT_TOKEN not defined in .env.local file" },
      { status: 401 }
    );
  }

  if (token.trim() !== process.env.BASALT_TOKEN.trim()) {
    console.log("Unauthorized");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  } else {
    if (!lastName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }
    try {
      const ip = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "Unknown IP";
      const timestamp = new Date();
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const newLead = await prismadb.crm_Leads.create({
        data: {
          v: 1,
          firstName,
          lastName,
          company: account,
          jobTitle: job,
          email,
          phone,
          lead_source,
          status: "NEW",
          type: "DEMO",
          opt_in_boolean: true,
          opt_in_ip: ip,
          opt_in_timestamp: timestamp,
          opt_in_verification_token: verificationToken,
        },
      });

      // Send verification email
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm-sand.basalthq.com'}/api/crm/verify-optin?token=${verificationToken}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">Please Confirm Your Subscription</h2>
          <p>Hi ${firstName || 'there'},</p>
          <p>Thank you for your interest! We received a request to subscribe this email address. To ensure we have the right person and comply with best practices, please confirm your subscription by clicking the button below.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Yes, subscribe me to this list</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you didn't make this request, you can safely ignore this email.</p>
        </div>
      `;

      if (email) {
        await sendEmail({
          to: email,
          subject: "Please Confirm Your Subscription",
          text: `Hi ${firstName || 'there'}, please confirm your subscription by visiting this link: ${verifyUrl}`,
          html: emailHtml,
        }).catch((err) => console.error("Error sending verification email:", err));
      }

      return NextResponse.json({ message: "New lead created successfully" });
      //return res.status(200).json({ json: "newContact" });
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: "Error creating new lead" },
        { status: 500 }
      );
    }
  }
}
