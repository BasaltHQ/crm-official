import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { format } from "date-fns";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;

        if (!formId) {
            return new NextResponse("Form ID is required", { status: 400 });
        }

        // Fetch ALL submissions (no limit for export)
        const submissions = await (prismadb as any).formSubmission.findMany({
            where: { form_id: formId, is_deleted: false },
            orderBy: { createdAt: "desc" }
        });

        if (!submissions || submissions.length === 0) {
            return new NextResponse("No submissions found", { status: 404 });
        }

        // 1. Identify priority headers
        // For the Airdrop form, we specifically want: email, wallet, socials
        const isAirdropForm = formId === "6986b9050b7508214f5180ce";

        const fieldHeaders = new Set<string>();
        submissions.forEach((sub: any) => {
            if (sub.data && typeof sub.data === 'object') {
                Object.keys(sub.data).forEach(key => fieldHeaders.add(key));
            }
        });

        const sortedHeaders = Array.from(fieldHeaders).sort();

        let finalHeaders: string[] = [];
        if (isAirdropForm) {
            // Strictly follow user request: email, wallet address, screen name
            finalHeaders = ["Email", "Wallet Addresses", "Socials/Screen Names", "Submitted At"];
        } else {
            finalHeaders = ["ID", "Submitted At", ...sortedHeaders];
        }

        // 2. Generate CSV Rows
        const csvRows = [finalHeaders.join(",")];

        submissions.forEach((sub: any) => {
            const data: any = sub.data || {};
            let row: string[] = [];

            if (isAirdropForm) {
                // Mapping for Airdrop form
                // email, wallet address, screen name
                const email = sub.extracted_email || data.email || "";
                const wallet = data.wallet_addresses || "";
                const socials = data.socials_list || "";

                row = [
                    email,
                    wallet,
                    socials,
                    format(new Date(sub.createdAt), "yyyy-MM-dd HH:mm:ss")
                ];
            } else {
                row = [
                    sub.id,
                    format(new Date(sub.createdAt), "yyyy-MM-dd HH:mm:ss"),
                    ...sortedHeaders.map(header => {
                        const val = data[header];
                        return val === undefined || val === null ? "" : String(val);
                    })
                ];
            }

            // Clean each cell for CSV safety
            const cleanRow = row.map(cell => {
                let stringVal = cell === undefined || cell === null ? "" : String(cell);

                // Standardize internal whitespace for legibility in spreadsheets
                // We replace internal newlines with " ; " to keep the data in a single row
                stringVal = stringVal
                    .replace(/\r\n/g, " ; ")
                    .replace(/\n/g, " ; ")
                    .replace(/\r/g, " ; ")
                    .replace(/\u2028/g, " ; ")
                    .replace(/\u2029/g, " ; ")
                    .trim();

                // Escape quotes and wrap in quotes if it contains separator or existing quotes
                if (stringVal.includes(",") || stringVal.includes('"')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            });

            csvRows.push(cleanRow.join(","));
        });

        // Use CRLF (\r\n) for record separators as per RFC 4180
        const csvString = csvRows.join("\r\n");
        // Add UTF-8 BOM (Byte Order Mark) so Excel/Numbers correctly detect encoding
        const BOM = "\uFEFF";

        return new NextResponse(BOM + csvString, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="submissions-${formId}-${new Date().toISOString().split('T')[0]}.csv"`,
            }
        });

    } catch (error) {
        console.error("[FORM_EXPORT_CSV]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
