"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { formatDistanceToNow } from "date-fns";

export const getRecentFiles = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return [];

        const files = await prismadb.documents.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                visibility: {
                    not: "HIDDEN"
                }
            },
            include: {
                created_by: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 10
        });

        return files.map(f => ({
            id: f.id,
            name: f.document_name,
            url: f.document_file_url,
            mimeType: f.document_file_mimeType,
            size: f.size,
            uploadedBy: (f as any).created_by?.name || "Unknown",
            time: formatDistanceToNow(new Date(f.createdAt || f.date_created || new Date()), { addSuffix: true })
        }));
    } catch (error) {
        console.error("Error fetching recent files:", error);
        return [];
    }
};
