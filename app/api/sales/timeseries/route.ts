// Sales timeseries API: aggregates invoice amounts by day/week/month within a date range.
import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

// Parse amounts stored as strings to numbers, stripping currency and separators.
function parseAmount(amount: string | null | undefined): number {
    if (!amount) return 0;
    const cleaned = String(amount).replace(/[^0-9\.\-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

// Format keys for buckets by interval.
function formatKey(date: Date, interval: "day" | "week" | "month"): string {
    const d = new Date(date);
    if (interval === "day") {
        // YYYY-MM-DD
        return d.toISOString().slice(0, 10);
    }
    if (interval === "week") {
        // Start of ISO week (Monday) as YYYY-MM-DD
        const day = d.getUTCDay(); // 0=Sunday..6=Saturday
        const diffToMonday = (day + 6) % 7; // 0->6, 1->0, etc.
        const startOfWeek = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diffToMonday);
        return startOfWeek.toISOString().slice(0, 10);
    }
    // month: YYYY-MM
    const year = d.getUTCFullYear();
    const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
}

export async function GET(req: Request) {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

    try {
        const url = new URL(req.url);
        const startParam = url.searchParams.get("start");
        const endParam = url.searchParams.get("end");
        const intervalParam = (url.searchParams.get("interval") || "day") as "day" | "week" | "month";

        // Default range: last 30 days
        const defaultEnd = new Date();
        const defaultStart = new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

        const start = startParam ? new Date(startParam) : defaultStart;
        const end = endParam ? new Date(endParam) : defaultEnd;

        // Safety: if invalid dates, reset to defaults
        if (isNaN(start.getTime())) {
            start.setTime(defaultStart.getTime());
        }
        if (isNaN(end.getTime())) {
            end.setTime(defaultEnd.getTime());
        }

        // Fetch invoices within the range; select only needed fields
        const invoices = await prismadb.invoices.findMany({
            where: {
                date_created: {
                    gte: start as any,
                    lte: end as any,
                },
            },
            select: {
                date_created: true,
                invoice_amount: true,
            },
            orderBy: { date_created: "asc" },
        });

        // Bucketize and sum
        const buckets = new Map<string, number>();
        for (const inv of invoices) {
            const key = formatKey(inv.date_created as any as Date, intervalParam);
            const amt = parseAmount(inv.invoice_amount as any);
            buckets.set(key, (buckets.get(key) || 0) + amt);
        }

        // Produce sorted data points by key ascending
        const data = Array.from(buckets.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
            .map(([key, total]) => ({ date: key, Total: Math.round(total) }));

        return NextResponse.json({ interval: intervalParam, start: start.toISOString(), end: end.toISOString(), data });
    } catch (err: any) {
        console.error("GET /api/sales/timeseries error:", err);
        return NextResponse.json({ error: "Failed to compute sales timeseries." }, { status: 500 });
    }
}
