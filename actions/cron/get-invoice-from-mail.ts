"use server";

import axios from "axios";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function runCronJob() {
  const admin = await requirePlatformAdmin();
  if (!admin) {
    throw new Error("Forbidden: Platform administrator privileges required");
  }

  if (!process.env.CRON_SECRET) {
    throw new Error("CRON_SECRET is not configured");
  }

  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/invoice/get-invoice-from-email`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    }
  );
  return response.data;
}
