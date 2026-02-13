"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const markNotificationRead = async (id: string, type: 'message' | 'form') => {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
        }

        if (type === 'message') {
            // Find the recipient record for this message and this user
            // Note: The ID passed is the message.id based on normalized data in get-user-messages.ts
            // But we need to update the Recipient record.

            const recipient = await prismadb.internalMessageRecipient.findFirst({
                where: {
                    message_id: id,
                    recipient_id: session.user.id
                }
            });

            if (recipient) {
                await prismadb.internalMessageRecipient.update({
                    where: { id: recipient.id },
                    data: { is_read: true }
                });
            }
        } else if (type === 'form') {
            await (prismadb as any).formSubmission.update({
                where: { id },
                data: { status: "VIEWED" }
            });
        }

        revalidatePath("/crm/dashboard");
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return { success: false, error: "Failed to mark as read" };
    }
};
