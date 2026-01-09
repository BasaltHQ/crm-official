import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
    try {
        const { messageId } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json();
        const { action, ...updates } = body;

        if (!messageId) {
            return NextResponse.json({ error: "Message ID required" }, { status: 400 });
        }

        // Get the message to check permissions
        const message = await prismadb.internalMessage.findUnique({
            where: { id: messageId },
            include: { recipients: true },
        });

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const isSender = message.sender_id === userId;
        const isRecipient = message.recipients.some(r => r.recipient_id === userId);

        if (!isSender && !isRecipient) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Handle specific actions
        if (action === "update_draft") {
            if (!isSender || message.status !== "DRAFT") {
                return NextResponse.json({ error: "Cannot edit this message" }, { status: 400 });
            }

            const updatedMessage = await prismadb.internalMessage.update({
                where: { id: messageId },
                data: {
                    subject: updates.subject,
                    body_text: updates.body_text,
                    status: updates.status || "DRAFT",
                    recipients: updates.recipient_ids ? {
                        deleteMany: {},
                        create: updates.recipient_ids.map((id: string) => ({
                            recipient_id: id,
                            recipient_type: "TO",
                        })),
                    } : undefined,
                },
            });

            return NextResponse.json(updatedMessage);
        }

        if (action === "archive") {
            if (isRecipient) {
                // Update recipient status
                await prismadb.internalMessageRecipient.updateMany({
                    where: { message_id: messageId, recipient_id: userId },
                    data: { is_archived: true },
                });
            }
            if (isSender) {
                // For sender, maybe add "archived" label?
                // Or if Sent view uses is_archived on message?
                // Let's assume sender just labels it archived
                const updatedLabels = [...(message.labels || [])];
                if (!updatedLabels.includes("archived")) updatedLabels.push("archived");

                await prismadb.internalMessage.update({
                    where: { id: messageId },
                    data: { labels: updatedLabels },
                });
            }
            return NextResponse.json({ success: true, message: "Archived" });
        }

        if (action === "delete") {
            if (isRecipient) {
                // Update recipient status
                await prismadb.internalMessageRecipient.updateMany({
                    where: { message_id: messageId, recipient_id: userId },
                    data: { is_deleted: true },
                });
            }
            if (isSender) {
                if (message.status === "DRAFT") {
                    // Permanently delete drafts
                    await prismadb.internalMessage.delete({ where: { id: messageId } });
                    return NextResponse.json({ success: true, message: "Draft deleted" });
                } else {
                    // Soft delete for sent items using labels
                    const updatedLabels = [...(message.labels || [])];
                    if (!updatedLabels.includes("trash")) updatedLabels.push("trash");

                    await prismadb.internalMessage.update({
                        where: { id: messageId },
                        data: { labels: updatedLabels },
                    });
                }
            }
            return NextResponse.json({ success: true, message: "Deleted" });
        }

        if (action === "restore") {
            if (isRecipient) {
                await prismadb.internalMessageRecipient.updateMany({
                    where: { message_id: messageId, recipient_id: userId },
                    data: { is_deleted: false, is_archived: false },
                });
            }
            if (isSender) {
                const updatedLabels = (message.labels || []).filter(l => l !== "trash" && l !== "archived");
                await prismadb.internalMessage.update({
                    where: { id: messageId },
                    data: { labels: updatedLabels },
                });
            }
            return NextResponse.json({ success: true, message: "Restored" });
        }

        // Generic update (e.g. is_read)
        if (isRecipient && typeof updates.is_read === 'boolean') {
            await prismadb.internalMessageRecipient.updateMany({
                where: { message_id: messageId, recipient_id: userId },
                data: { is_read: updates.is_read, read_at: updates.is_read ? new Date() : null },
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Error updating message:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
    try {
        const { messageId } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const message = await prismadb.internalMessage.findUnique({
            where: { id: messageId },
            include: { recipients: true },
        });

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const isSender = message.sender_id === userId;

        // Only sender can permanently delete (usually just drafts, or if cleaning up)
        // Or if in Trash?
        // Let's implement permanent delete logic based on context
        // If it's DRAFT -> Delete
        // If it's SENT -> Maybe prevent unless admin? Or if testing?
        // Replicating FormSubmission logic: Permanent delete is just DELETE

        if (isSender) {
            await prismadb.internalMessage.delete({ where: { id: messageId } });
            return NextResponse.json({ success: true, message: "Permanently deleted" });
        } else {
            return NextResponse.json({ error: "Only sender can delete permanently" }, { status: 403 });
        }

    } catch (error) {
        console.error("Error deleting message:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
