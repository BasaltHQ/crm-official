
import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

export const dynamic = 'force-dynamic';

export async function GET() {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

    try {
        const invoices = await (prismadb.invoices as any).findMany({
            take: 10,
            orderBy: { date_created: 'desc' },
            include: {
                documents: true // Correct relation name inferred from error
            }
        });

        // Also check documents
        const documents = await (prismadb.documents as any).findMany({
            take: 10,
            orderBy: { date_created: 'desc' }
        });

        return NextResponse.json({
            summary: `Found ${invoices.length} invoices and ${documents.length} documents.`,
            invoices,
            documents
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
