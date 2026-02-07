import nodemailer from "nodemailer";

interface EmailOptions {
  from: string | undefined;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    content: any;
    contentType?: string;
  }[];
}

export default async function sendEmail(
  emailOptions: EmailOptions
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    const result = await transporter.sendMail(emailOptions);
    console.log(`[Email Success] To: ${emailOptions.to}, MessageId: ${result.messageId}`);
  } catch (error: any | Error) {
    console.error(`[Email Error] Failed to send to ${emailOptions.to}:`, error);
    throw error; // Rethrow to let the API know it failed
  }
}
