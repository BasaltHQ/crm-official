"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function sanitizeOptionalHttpUrl(raw: FormDataEntryValue | null, fallback = ""): string {
    if (typeof raw !== "string" || !raw.trim()) return fallback;
    try {
        const u = new URL(raw.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
        return u.toString().slice(0, 500);
    } catch {
        return fallback;
    }
}

export async function submitApplication(formData: FormData) {
    const jobId = String(formData.get("jobId") || "").trim();
    const name = String(formData.get("name") || "").trim().slice(0, 120);
    const email = String(formData.get("email") || "").trim().toLowerCase().slice(0, 200);
    const phone = String(formData.get("phone") || "").trim().slice(0, 40);
    const linkedinUrl = sanitizeOptionalHttpUrl(formData.get("linkedinUrl"));
    const portfolioUrl = sanitizeOptionalHttpUrl(formData.get("portfolioUrl"));
    const coverLetter = String(formData.get("coverLetter") || "").trim().slice(0, 10000);
    const resumeUrl = sanitizeOptionalHttpUrl(formData.get("resumeUrl"), "No resume link provided");

    if (!jobId || !/^[0-9a-fA-F]{24}$/.test(jobId) || !name || !email || !email.includes("@")) {
        return { success: false, message: "Missing or invalid required fields" };
    }

    try {
        const job = await prismadb.jobPosting.findUnique({ where: { id: jobId } });
        if (!job || (job as any).active === false) {
            return { success: false, message: "Job not found" };
        }

        await prismadb.jobApplication.create({
            data: {
                jobId,
                jobTitle: job.title,
                name,
                email,
                phone,
                linkedinUrl,
                portfolioUrl,
                coverLetter,
                resumeUrl,
                status: "PENDING",
            },
        });

        revalidatePath("/cms/applications");
        return { success: true, message: "Application submitted successfully!" };
    } catch (error) {
        console.error("Application Error:", error);
        return { success: false, message: "Failed to submit application. Please try again." };
    }
}
