"use server";

import { prismadb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/security/authz";
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
                        assigned_to_user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                            },
                        },
                    },
                },
            },
        });
        if (dealRoom) {
            delete (dealRoom as any).password_protection;
            if (dealRoom.contract?.assigned_to_user) {
                (dealRoom.contract as any).assigned_to_user = sanitizeUser(dealRoom.contract.assigned_to_user);
            }
        }
        return dealRoom;
    } catch (error) {
        console.error("Error fetching DealRoom:", error);
        return null;
    }
}

export async function trackDealRoomActivity(dealRoomId: string, type: string, metadata: any = {}) {
    try {
        const existingRoom = await prismadb.crm_DealRooms.findUnique({
            where: { id: dealRoomId },
            select: {
                id: true,
                is_active: true,
                contract: { select: { team_id: true } },
            },
        });
        if (!existingRoom || !existingRoom.is_active) {
            return;
        }

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

            // Trigger FlowState workflows for DEAL_ROOM_OPENED strictly scoped to contract's team
            if (existingRoom.contract?.team_id) {
                await triggerWorkflowsByType(
                    "DEAL_ROOM_OPENED",
                    {
                        dealRoomId,
                        type,
                        metadata,
                        triggeredAt: new Date().toISOString()
                    },
                    existingRoom.contract.team_id
                );
            }
        }
    } catch (error) {
        console.error("Error tracking activity:", error);
    }
}

export async function updateDealRoomAddons(dealRoomId: string, selectedAddons: any, _totalValue: number) {
    try {
        const existingRoom = await prismadb.crm_DealRooms.findUnique({
            where: { id: dealRoomId },
            select: {
                id: true,
                is_active: true,
                valid_until: true,
                interactive_pricing: true,
                allowed_addons: true,
            },
        });
        if (!existingRoom || !existingRoom.is_active || existingRoom.interactive_pricing === false) {
            throw new Error("Deal room is inactive or does not allow pricing changes");
        }
        if (existingRoom.valid_until && new Date() > new Date(existingRoom.valid_until)) {
            throw new Error("Deal room has expired");
        }

        // Only allow addons defined in allowed_addons
        let sanitizedAddons: any[] = [];
        if (Array.isArray(selectedAddons)) {
            const allowedList = Array.isArray(existingRoom.allowed_addons) ? (existingRoom.allowed_addons as any[]) : [];
            if (allowedList.length > 0) {
                const allowedByName = new Map(allowedList.map((a: any) => [a?.name, a]));
                sanitizedAddons = selectedAddons
                    .map((item: any) => allowedByName.get(item?.name))
                    .filter(Boolean);
            }
        }

        const room = await prismadb.crm_DealRooms.update({
            where: { id: dealRoomId },
            data: {
                selected_addons: sanitizedAddons
            },
            include: { contract: true }
        });
        delete (room as any).password_protection;

        revalidatePath(`/proposal/${room.slug}`);
        return room;
    } catch (error) {
        console.error("Error updating addons:", error);
        throw error;
    }
}
