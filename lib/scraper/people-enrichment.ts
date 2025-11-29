import { prismadbCrm } from "@/lib/prisma-crm";
import { launchBrowser, newPageWithDefaults, closeBrowser } from "@/lib/browser";
import {
    normalizeDomain,
    normalizeName,
    normalizeLinkedInUrl,
    generatePersonDedupeKey,
    calculatePersonConfidence,
} from "./normalize";

/**
 * ToS-safe People Enrichment:
 * - Crawls company-owned public pages only (no authenticated sources)
 * - Targets likely team/about/leadership pages and extracts names/titles
 * - Captures public LinkedIn URLs if present on the company's site, but does NOT crawl LinkedIn itself
 * - Saves crm_Contact_Candidates without requiring email/phone (fills title/linkedin when present)
 */
export async function enrichPeopleForJob(
    jobId: string,
    userId: string,
    options?: {
        perCompanyPageLimit?: number;
        maxCandidates?: number;
    }
): Promise<{ contactsAdded: number; companiesProcessed: number }> {
    const perCompanyPageLimit = options?.perCompanyPageLimit ?? 6;
    const maxCandidates = options?.maxCandidates ?? 200;

    const db: any = prismadbCrm;

    // Get job and pool
    const job = await db.crm_Lead_Gen_Jobs.findUnique({
        where: { id: jobId },
        select: { pool: true, providers: true },
    });
    if (!job?.pool) {
        return { contactsAdded: 0, companiesProcessed: 0 };
    }

    // Get candidates in this pool
    const candidates: Array<{
        id: string;
        domain?: string | null;
        homepageUrl?: string | null;
        companyName?: string | null;
    }> = await db.crm_Lead_Candidates.findMany({
        where: { pool: job.pool },
        select: { id: true, domain: true, homepageUrl: true, companyName: true },
        take: maxCandidates,
    });

    if (!candidates?.length) {
        return { contactsAdded: 0, companiesProcessed: 0 };
    }

    const browser = await launchBrowser();
    let contactsAdded = 0;
    let companiesProcessed = 0;

    try {
        // For each candidate, attempt to discover people on public company pages
        for (const cand of candidates) {
            const domain = normalizeDomain(cand.domain || "");
            const homepage = cand.homepageUrl || (domain ? `https://${domain}` : null);
            if (!domain || !homepage) continue;

            companiesProcessed++;

            // Likely pages to check (append to homepage)
            const paths = [
                "/", // homepage sometimes lists team members (small orgs)
                "/team",
                "/about",
                "/leadership",
                "/company",
                "/our-team",
                "/management",
                "/who-we-are",
                "/people",
            ];

            const urls = Array.from(
                new Set(
                    paths
                        .map((p) => {
                            try {
                                const u = new URL(homepage);
                                // Ensure path concat has a single slash
                                const joined =
                                    p === "/"
                                        ? `${u.origin}/`
                                        : `${u.origin}${p.startsWith("/") ? p : `/${p}`}`;
                                return joined;
                            } catch {
                                return null;
                            }
                        })
                        .filter(Boolean) as string[]
                )
            ).slice(0, perCompanyPageLimit);

            const page = await newPageWithDefaults(browser);

            for (const url of urls) {
                try {
                    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
                    await new Promise((r) => setTimeout(r, 500));

                    // Evaluate the DOM to extract likely people entries
                    const people: Array<{
                        name: string;
                        title?: string;
                        linkedinUrl?: string;
                    }> = await page.evaluate(() => {
                        function text(el: Element | null | undefined): string {
                            return (el?.textContent || "").trim();
                        }

                        function looksLikeName(s: string): boolean {
                            // Basic heuristic: 2-4 tokens with capitalized initials
                            const parts = s.trim().split(/\s+/).filter(Boolean);
                            if (parts.length < 2 || parts.length > 4) return false;
                            let score = 0;
                            for (const p of parts) {
                                if (/^[A-Z][a-z'’\-]+$/.test(p)) score++;
                            }
                            return score >= 2;
                        }

                        const anchors = Array.from(document.querySelectorAll("a[href]"));
                        const linkedinMap = new Map<string, string>();
                        for (const a of anchors) {
                            const href = (a as HTMLAnchorElement).href || "";
                            if (href.includes("linkedin.com")) {
                                const label = text(a);
                                if (label) linkedinMap.set(label.toLowerCase(), href);
                            }
                        }

                        const candidates: Array<{ name: string; title?: string; linkedinUrl?: string }> = [];

                        // Consider common container sections
                        const sections = Array.from(
                            document.querySelectorAll(
                                `
                section, div, ul, ol, article
              `
                            )
                        ).filter((el) => {
                            const cls = (el.getAttribute("class") || "").toLowerCase();
                            const id = (el.getAttribute("id") || "").toLowerCase();
                            return (
                                cls.includes("team") ||
                                cls.includes("member") ||
                                cls.includes("people") ||
                                cls.includes("leadership") ||
                                cls.includes("founder") ||
                                id.includes("team") ||
                                id.includes("people") ||
                                id.includes("leaders") ||
                                id.includes("about")
                            );
                        });

                        function findTitleNear(el: Element): string | null {
                            // Try siblings/small tags
                            const next = el.nextElementSibling as Element | null;
                            if (next) {
                                const tt = text(next);
                                if (tt && tt.length > 1 && tt.length < 120) return tt;
                            }
                            const parent = el.parentElement;
                            if (parent) {
                                const small = parent.querySelector("small, .title, .position, .role, p");
                                const tt = text(small as Element);
                                if (tt && tt.length > 1 && tt.length < 120) return tt;
                            }
                            return null;
                        }

                        function collectNames(root: Element) {
                            const headings = root.querySelectorAll("h1, h2, h3, h4, strong, b");
                            for (const h of Array.from(headings)) {
                                const t = text(h);
                                if (!t || t.length > 120) continue;
                                if (!looksLikeName(t)) continue;

                                let title = findTitleNear(h);
                                // If heading includes a hyphen or pipe with title
                                if (!title && /[\-\|]/.test(t)) {
                                    const parts = t.split(/[\-\|]/);
                                    if (parts.length >= 2) {
                                        const nm = parts[0].trim();
                                        const tt = parts.slice(1).join(" ").trim();
                                        if (looksLikeName(nm)) {
                                            candidates.push({ name: nm, title: tt });
                                            continue;
                                        }
                                    }
                                }

                                candidates.push({ name: t, title: title || undefined });
                            }
                        }

                        if (sections.length) {
                            for (const s of sections) collectNames(s);
                        } else {
                            // Fallback to whole document
                            collectNames(document.body);
                        }

                        // Attach LinkedIn if matching label found or present in ancestor anchors
                        for (const c of candidates) {
                            const key = c.name.toLowerCase();
                            if (linkedinMap.has(key)) {
                                c.linkedinUrl = linkedinMap.get(key);
                                continue;
                            }
                        }

                        // Also check nearest anchors for each heading again
                        for (const c of candidates) {
                            if (c.linkedinUrl) continue;
                            const match = Array.from(anchors).find((a) => {
                                const txt = text(a);
                                const href = (a as HTMLAnchorElement).href || "";
                                return !!txt && txt.toLowerCase().includes(c.name.toLowerCase()) && href.includes("linkedin.com");
                            });
                            if (match) {
                                c.linkedinUrl = (match as HTMLAnchorElement).href;
                            }
                        }

                        // Make unique by name+title
                        const dedup = new Map<string, { name: string; title?: string; linkedinUrl?: string }>();
                        for (const p of candidates) {
                            const key = `${p.name.toLowerCase()}|${(p.title || "").toLowerCase()}`.trim();
                            if (!dedup.has(key)) dedup.set(key, p);
                        }

                        return Array.from(dedup.values()).slice(0, 25);
                    });

                    if (!people?.length) continue;

                    // Save to crm_Contact_Candidates (no email/phone required here)
                    for (const person of people) {
                        const fullName = normalizeName(person.name);
                        if (!fullName) continue;

                        const linkedin = normalizeLinkedInUrl(person.linkedinUrl || undefined);
                        const dedupeKey =
                            generatePersonDedupeKey(null, fullName, domain, person.title || null) ||
                            undefined;

                        // Check existing similar record by name+candidate or dedupeKey
                        const existing = await db.crm_Contact_Candidates.findFirst({
                            where: {
                                leadCandidate: cand.id,
                                OR: [
                                    { fullName: fullName },
                                    ...(dedupeKey ? [{ dedupeKey }] : []),
                                ],
                            },
                            select: { id: true },
                        });

                        if (existing?.id) {
                            // Opportunistic update for missing fields
                            await db.crm_Contact_Candidates.update({
                                where: { id: existing.id },
                                data: {
                                    title: person.title || undefined,
                                    linkedinUrl: linkedin || undefined,
                                },
                            });
                            continue;
                        }

                        const confidence = calculatePersonConfidence({
                            hasEmail: false,
                            hasPhone: false,
                            hasLinkedIn: !!linkedin,
                            hasTitle: !!person.title,
                            hasName: true,
                            source: "company-website",
                        });

                        await db.crm_Contact_Candidates.create({
                            data: {
                                leadCandidate: cand.id,
                                fullName,
                                title: person.title || undefined,
                                email: null,
                                phone: null,
                                linkedinUrl: linkedin || undefined,
                                dedupeKey,
                                confidence,
                                status: "NEW",
                                provenance: {
                                    source: "people_enrichment",
                                    jobId,
                                    url,
                                },
                            },
                        });
                        contactsAdded++;
                    }
                } catch (err) {
                    // Ignore per-URL errors; continue to next URL
                }
            }

            await page.close().catch(() => undefined);
        }
    } finally {
        await closeBrowser(browser).catch(() => undefined);
    }

    // Log to job if possible
    try {
        await db.crm_Lead_Gen_Jobs.update({
            where: { id: jobId },
            data: {
                logs: [
                    { ts: new Date().toISOString(), msg: `People enrichment: ${contactsAdded} contacts added across ${companiesProcessed} companies.` },
                ],
                counters: {
                    contactsAddedByPeopleEnrichment: contactsAdded,
                    companiesProcessedByPeopleEnrichment: companiesProcessed,
                } as any,
            },
        });
    } catch {
        // Swallow logging errors
    }

    return { contactsAdded, companiesProcessed };
}
