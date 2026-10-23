"use server";

import { dbAdapter } from "@/lib/database/db-adapter";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function managePartnerProfile(
    action: "UPDATE" | "TOGGLE_STATUS",
    payload?: {
        agency_name?: string;
        website?: string;
        calendar_url?: string;
        bio?: string;
        is_active?: boolean;
    }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { error: "Unauthorized" };
        }

        const usersCollection = await dbAdapter.getNativeCollection("Users");
        const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });

        if (!user) {
            return { error: "User not found" };
        }

        // Must be level 21 or higher to be a partner
        const level = Math.max(user.university_level || 1, user.level || 1);
        if (level < 21) {
            return { error: "You must reach Strategic Master (Level 21) to join the Partner Network." };
        }

        const currentProfile = user.partner_profile || {};

        if (action === "TOGGLE_STATUS") {
            const newStatus = payload?.is_active !== undefined ? payload.is_active : !currentProfile.is_active;
            await usersCollection.updateOne(
                { _id: new ObjectId(session.user.id) },
                { $set: { "partner_profile.is_active": newStatus, updated_at: new Date() } }
            );
            return { success: true, is_active: newStatus };
        }

        if (action === "UPDATE") {
            await usersCollection.updateOne(
                { _id: new ObjectId(session.user.id) },
                {
                    $set: {
                        "partner_profile.agency_name": payload?.agency_name !== undefined ? payload.agency_name : (currentProfile.agency_name || ""),
                        "partner_profile.website": payload?.website !== undefined ? payload.website : (currentProfile.website || ""),
                        "partner_profile.calendar_url": payload?.calendar_url !== undefined ? payload.calendar_url : (currentProfile.calendar_url || ""),
                        "partner_profile.bio": payload?.bio !== undefined ? payload.bio : (currentProfile.bio || ""),
                        "partner_profile.updated_at": new Date(),
                        updated_at: new Date()
                    }
                }
            );
            return { success: true };
        }

        return { error: "Invalid action" };
    } catch (e: any) {
        console.error("[MANAGE_PARTNER]", e);
        return { error: e.message || "Failed to update partner profile" };
    }
}
