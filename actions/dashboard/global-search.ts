"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface SearchResult {
    type: "task" | "lead" | "project";
    id: string;
    title: string;
    subtitle?: string;
    url: string;
}

export const globalSearch = async (query: string): Promise<SearchResult[]> => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !query || query.length < 2) return [];

    const q = query.trim();

    // Search Tasks
    const tasksPromise = prismadb.tasks.findMany({
        where: {
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
            ],
            // Add permissions check (e.g. assigned user or team) implementation later if needed
            // For now assuming viewing all allowed or handled by prisma policies if any (schema doesn't imply granular permission policies)
        },
        take: 5,
        select: { id: true, title: true, assigned_section: { select: { board: true } } },
    });

    // Search Leads
    const leadsPromise = prismadb.crm_Leads.findMany({
        where: {
            OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
            ],
        },
        take: 5,
        select: { id: true, firstName: true, lastName: true, company: true },
    });

    // Search Projects (Boards)
    const projectsPromise = prismadb.boards.findMany({
        where: {
            title: { contains: q, mode: "insensitive" },
        },
        take: 5,
        select: { id: true, title: true },
    });

    const [tasks, leads, projects] = await Promise.all([tasksPromise, leadsPromise, projectsPromise]);

    const results: SearchResult[] = [];

    tasks.forEach((t: { id: string; title: string; assigned_section: { board: string | null } | null }) => {
        results.push({
            type: "task",
            id: t.id,
            title: t.title,
            subtitle: "Task",
            url: t.assigned_section?.board ? `/projects/boards/${t.assigned_section.board}?task=${t.id}` : "#",
        });
    });

    leads.forEach((l: { id: string; firstName: string | null; lastName: string | null; company: string | null }) => {
        results.push({
            type: "lead",
            id: l.id,
            title: `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.company || "Unknown Lead",
            subtitle: l.company || "Lead",
            url: `/crm/leads/${l.id}`,
        });
    });

    projects.forEach((p: { id: string; title: string }) => {
        results.push({
            type: "project",
            id: p.id,
            title: p.title,
            subtitle: "Project",
            url: `/projects/boards/${p.id}`,
        });
    });

    return results;
};
