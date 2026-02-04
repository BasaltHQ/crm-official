import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { triggerWorkflowsByType } from "./workflows";

export async function getDealRoomBySlug(slug: string) {
    try {
        const dealRoom = await prismadb.crm_DealRooms.findUnique({
            where: { slug },
            include: {
                contract: {
                    include: {
                        assigned_account: true,
                        assigned_to_user: true
                    }
                }
            }
        });
        return dealRoom;
    } catch (error) {
        console.error("Error fetching DealRoom:", error);
        return null;
    }
}

export async function trackDealRoomActivity(dealRoomId: string, type: string, metadata: any = {}) {
    try {
        await prismadb.crm_DealRoom_Activities.create({
            data: {
                deal_room_id: dealRoomId,
                type,
                metadata
            }
        });

        // Update aggregate stats
        if (type === "OPENED") {
            await prismadb.crm_DealRooms.update({
                where: { id: dealRoomId },
                data: {
                    total_views: { increment: 1 },
                    last_viewed_at: new Date()
                }
            });
            
            // Trigger FlowState workflows for DEAL_ROOM_OPENED
            await triggerWorkflowsByType("DEAL_ROOM_OPENED", {
                dealRoomId,
                type,
                metadata,
                triggeredAt: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error tracking activity:", error);
    }
}

export async function updateDealRoomAddons(dealRoomId: string, selectedAddons: any, totalValue: number) {
    try {
        const room = await prismadb.crm_DealRooms.update({
            where: { id: dealRoomId },
            data: {
                selected_addons: selectedAddons
            },
            include: { contract: true }
        });

        // Optionally update the actual contract value? 
        // For now, let's just keep it in the room state or update a "projected value"

        revalidatePath(`/proposal/${room.slug}`);
        return room;
    } catch (error) {
        console.error("Error updating addons:", error);
        throw error;
    }
}
