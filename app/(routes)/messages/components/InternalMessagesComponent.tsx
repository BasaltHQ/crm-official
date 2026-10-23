"use client";

import * as React from "react";
import {
    Archive,
    File,
    FileText,
    Inbox,
    PenBox,
    Search,
    Send,
    Trash2,
    Users2,
    MailPlus,
    Clock,
    Star,
    Reply,
    Forward,
    MoreVertical,
    FormInput,
    UserPlus,
    Undo2,
    AlertTriangle,
    Check,
    Bell,
    X,
    Pencil,
    Mail,
    Phone,
    MessageSquare,
    Lock,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, formatDistanceToNow } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { InboxShell } from "./inbox/InboxShell";
import { InboxComposeDialog, InboxDeleteDialog } from "./inbox/InboxComposeDialog";

interface TeamMember {
    id: string;
    name: string | null;
    email: string | null;
}

interface Message {
    id: string;
    subject: string | null;
    body: string | null;
    createdAt: Date | string;
    is_read: boolean;
    is_important: boolean;
    labels: string[];
    from_user_id: string;
    to_user_id: string;
    from_user?: TeamMember | null;
    to_user?: TeamMember | null;
    recipients?: { recipient_id: string; is_archived?: boolean; is_deleted?: boolean; is_read?: boolean }[];
    status?: string;
    _apiMeta?: {
        conversation_id?: string;
        direction?: string;
        channel?: string;
        contactId?: string;
        leadId?: string;
        clientName?: string;
        clientEmail?: string;
    };
    _thread?: Message[];
    direction?: string;
    senderName?: string;
    parent_id?: string;
}

interface FormSubmission {
    id: string;
    form_id: string;
    data: Record<string, any>;
    source_url?: string;
    ip_address?: string;
    status: string;
    is_deleted?: boolean;
    createdAt: Date | string;
    converted_lead_id?: string | null;
    lead_id?: string | null;
    form: {
        id: string;
        name: string;
        slug: string;
        project_id?: string | null;
    };
}

interface SystemNotification {
    id: string;
    title: string;
    message: string;
    type: string;
    link?: string | null;
    isRead: boolean;
    isCleared: boolean;
    createdAt: Date | string;
}

interface InternalMessagesProps {
    messages: Message[];
    teamMembers: TeamMember[];
    formSubmissions?: FormSubmission[];
    notifications?: SystemNotification[];
    currentUserId: string;
    currentUserName: string;
    currentUserEmail: string;
    defaultLayout?: number[];
    defaultCollapsed?: boolean;
}

export function InternalMessagesComponent({
    messages,
    teamMembers,
    formSubmissions = [],
    notifications = [],
    currentUserId,
    currentUserName,
    currentUserEmail,
    defaultLayout = [20, 35, 45],
    defaultCollapsed = false,
}: InternalMessagesProps) {
    const router = useRouter();
    const [selectedNotificationId, setSelectedNotificationId] = React.useState<string | null>(null);
    const searchParams = useSearchParams();
    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
    const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);
    const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<string | null>(null);
    const [selectedBatchIds, setSelectedBatchIds] = React.useState<string[]>([]);
    const [isBulkProcessing, setIsBulkProcessing] = React.useState(false);

    const [composeOpen, setComposeOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [activeNav, setActiveNav] = React.useState<"inbox" | "dms" | "emails" | "sms" | "internal" | "sent" | "drafts" | "archive" | "trash" | "submissions" | "notifications">("inbox");

    // Handle URL params for deep linking
    React.useEffect(() => {
        const id = searchParams.get("id");
        const tab = searchParams.get("tab");

        if (tab === "forms" || tab === "submissions") {
            setActiveNav("submissions");
            if (id) setSelectedSubmissionId(id);
        } else if (id && !tab) {
            // Default to inbox message
            setSelectedMessageId(id);
        }
    }, [searchParams]);
    
    // Clear batch selection on nav change
    React.useEffect(() => {
        setSelectedBatchIds([]);
    }, [activeNav]);

    const [isConvertingToLead, setIsConvertingToLead] = React.useState(false);
    const [isConvertingEmail, setIsConvertingEmail] = React.useState(false);
    const [isDeletingSubmission, setIsDeletingSubmission] = React.useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [submissionToDelete, setSubmissionToDelete] = React.useState<string | null>(null);
    const [messageToDelete, setMessageToDelete] = React.useState<string | null>(null);
    const [filterReadStatus, setFilterReadStatus] = React.useState<string>("all");

    // Compose form state
    const [composeToUserId, setComposeToUserId] = React.useState("");
    const [composeSubject, setComposeSubject] = React.useState("");
    const [composeBody, setComposeBody] = React.useState("");
    const [composeParentId, setComposeParentId] = React.useState<string | null>(null);
    const [isSending, setIsSending] = React.useState(false);
    const [draftId, setDraftId] = React.useState<string | null>(null);

    // API message reply state
    const [apiReplyOpen, setApiReplyOpen] = React.useState(false);
    const [apiReplyBody, setApiReplyBody] = React.useState("");
    const [apiReplySending, setApiReplySending] = React.useState(false);
    const [apiReplyChannel, setApiReplyChannel] = React.useState<"EMAIL" | "NOTE" | "INTERNAL">("NOTE");

    // Filter messages based on active nav and search
    const getStatus = React.useCallback((m: Message) => {
        const isMeSender = m.from_user_id === currentUserId;
        const myRecipient = m.recipients?.find(r => r.recipient_id === currentUserId);

        const isTrash = (isMeSender && m.labels?.includes("trash")) || (myRecipient?.is_deleted);
        const isArchived = (isMeSender && m.labels?.includes("archived")) || (myRecipient?.is_archived);
        const isDraft = m.status === "DRAFT";

        return { isMeSender, isTrash, isArchived, isDraft, myRecipient };
    }, [currentUserId]);

    // Filter messages based on active nav and search
    const filteredMessages = React.useMemo(() => {
        let filtered = messages;

        switch (activeNav) {
            case "inbox":
            case "dms":
            case "emails":
            case "sms":
            case "internal":
                filtered = messages.filter(m => {
                    const isInbox = (() => {
                        if (m._apiMeta) return true;
                        
                        const checkMsg = (msg: Message) => {
                            const { isTrash, isArchived, myRecipient } = getStatus(msg);
                            return !!myRecipient && !isTrash && !isArchived;
                        };

                        if (checkMsg(m)) return true;
                        if (m._thread && m._thread.some(checkMsg)) return true;

                        return false;
                    })();

                    if (!isInbox) return false;
                    if (activeNav === "inbox") return true;

                    const isInternal = !m._apiMeta;
                    const channel = isInternal ? "INTERNAL" : (m._apiMeta?.channel?.toUpperCase() === "NOTE" ? "DM" : m._apiMeta?.channel?.toUpperCase());

                    if (activeNav === "dms") return channel === "DM";
                    if (activeNav === "emails") return channel === "EMAIL";
                    if (activeNav === "sms") return channel === "SMS";
                    if (activeNav === "internal") return channel === "INTERNAL";
                    return false;
                });
                break;
            case "sent":
                filtered = messages.filter(m => {
                    if (m._apiMeta) return false;
                    
                    const isSent = (() => {
                        // A thread belongs in Sent ONLY if the entire thread was sent by me
                        // OR if I sent the latest message and it's not marked as inbound to me.
                        // Actually, if we want it to ONLY show up in sent if the whole thread is outbound:
                        // But standard email usually shows a thread in Sent if *any* message was sent by me.
                        // However, if we just check if I am the sender of ANY message in the thread:
                        const checkMsg = (msg: Message) => {
                            const { isMeSender, isTrash, isArchived, isDraft } = getStatus(msg);
                            return isMeSender && !isTrash && !isArchived && !isDraft;
                        };
                        
                        if (checkMsg(m)) return true;
                        if (m._thread && m._thread.some(checkMsg)) return true;
                        
                        return false;
                    })();
                    
                    return isSent;
                });
                break;
            case "drafts":
                filtered = messages.filter(m => {
                    const { isMeSender, isDraft, isTrash } = getStatus(m);
                    return isMeSender && isDraft && !isTrash;
                });
                break;
            case "archive":
                filtered = messages.filter(m => {
                    const { isArchived, isTrash } = getStatus(m);
                    return isArchived && !isTrash;
                });
                break;
            case "trash":
                filtered = messages.filter(m => {
                    const { isTrash } = getStatus(m);
                    return isTrash;
                });
                break;
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                m =>
                    (m.subject || "").toLowerCase().includes(query) ||
                    (m.body || "").toLowerCase().includes(query) ||
                    (m.from_user?.name || "").toLowerCase().includes(query) ||
                    (m.to_user?.name || "").toLowerCase().includes(query)
            );
        }

        if (filterReadStatus === "unread") {
            filtered = filtered.filter(m => {
                const { myRecipient } = getStatus(m);
                return !!myRecipient && !myRecipient.is_read;
            });
        }

        return filtered;
    }, [messages, activeNav, searchQuery, getStatus, filterReadStatus]);

    const selectedMessage = React.useMemo(() => {
        return filteredMessages.find(m => m.id === selectedMessageId) || null;
    }, [filteredMessages, selectedMessageId]);

    const inboxCount = messages.filter(m => {
        const { isTrash, isArchived, myRecipient } = getStatus(m);
        return (!!myRecipient && !isTrash && !isArchived && !myRecipient.is_read) || (m._apiMeta && !m.is_read);
    }).length;

    const getChannelUnreadCount = (channelName: string) => messages.filter(m => {
        const { isTrash, isArchived, myRecipient } = getStatus(m);
        const isInbox = (!!myRecipient && !isTrash && !isArchived && !myRecipient.is_read) || (m._apiMeta && !m.is_read);
        if (!isInbox) return false;
        
        const isInternal = !m._apiMeta;
        const channel = isInternal ? "INTERNAL" : (m._apiMeta?.channel?.toUpperCase() === "NOTE" ? "DMS" : m._apiMeta?.channel?.toUpperCase());
        return channel === channelName;
    }).length;

    const dmsCount = getChannelUnreadCount("DMS");
    const emailsCount = getChannelUnreadCount("EMAIL");
    const smsCount = getChannelUnreadCount("SMS");
    const internalCount = getChannelUnreadCount("INTERNAL");

    const archiveCount = messages.filter(m => {
        const { isArchived, isTrash } = getStatus(m);
        return isArchived && !isTrash;
    }).length;

    const draftsCount = messages.filter(m => {
        const { isDraft, isTrash } = getStatus(m);
        return isDraft && !isTrash;
    }).length;

    const sentCount = messages.filter(m => {
        const { isMeSender, isTrash, isDraft } = getStatus(m);
        return isMeSender && !isTrash && !isDraft;
    }).length;

    const messageTrashCount = messages.filter(m => {
        const { isTrash } = getStatus(m);
        return isTrash;
    }).length;

    // Separate active submissions from trashed ones
    const activeSubmissions = React.useMemo(() => {
        let subs = formSubmissions.filter(s => !s.is_deleted && s.status !== "ARCHIVED" && s.status !== "DELETED");
        if (filterReadStatus === "unread") {
            subs = subs.filter(s => s.status === "NEW");
        }
        return subs;
    }, [formSubmissions, filterReadStatus]);

    const trashedSubmissions = React.useMemo(() => {
        return formSubmissions.filter(s => !!s.is_deleted || s.status === "DELETED");
    }, [formSubmissions]);

    const archivedSubmissions = React.useMemo(() => {
        return formSubmissions.filter(s => !s.is_deleted && s.status === "ARCHIVED");
    }, [formSubmissions]);

    const activeNotifications = notifications.filter(n => !n.isCleared);

    const submissionsCount = activeSubmissions.filter(s => s.status === "NEW").length;
    const notificationsCount = activeNotifications.filter(n => !n.isRead).length;
    const totalTrashCount = messageTrashCount + trashedSubmissions.length;
    const totalArchiveCount = archiveCount + archivedSubmissions.length;

    const selectedSubmission = React.useMemo(() => {
        return formSubmissions.find(s => s.id === selectedSubmissionId) || null;
    }, [formSubmissions, selectedSubmissionId]);

    const selectedNotification = React.useMemo(() => {
        return notifications.find(n => n.id === selectedNotificationId) || null;
    }, [notifications, selectedNotificationId]);

    // Convert submission to lead
    const handleConvertToLead = async (submissionId: string) => {
        setIsConvertingToLead(true);
        try {
            const res = await fetch("/api/forms/submissions/convert-to-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
            });

            if (!res.ok) throw new Error("Failed to convert to lead");

            toast.success("Lead created successfully!");
            router.refresh();
        } catch (error) {
            toast.error("Failed to convert to lead");
        } finally {
            setIsConvertingToLead(false);
        }
    };

    // Convert unknown email sender to lead or contact
    const handleConvertMessage = async (type: "contact" | "lead") => {
        if (!selectedMessageId || !selectedMessage) return;
        setIsConvertingEmail(true);
        try {
            const res = await fetch("/api/email/inbound/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    threadId: selectedMessage.id, // the SES email thread ID
                    type,
                    email: selectedMessage._apiMeta?.clientEmail,
                    name: selectedMessage._apiMeta?.clientName
                }),
            });

            if (!res.ok) throw new Error("Failed to convert message");
            toast.success(`${type === 'contact' ? 'Contact' : 'Lead'} created successfully!`);
            // Optimistically update the UI if possible, or just refresh
            router.refresh();
        } catch(error) {
            toast.error(`Failed to create ${type}`);
        } finally {
            setIsConvertingEmail(false);
        }
    };

    // Soft delete submission (move to trash)
    const handleDeleteSubmission = async (submissionId: string) => {
        setIsDeletingSubmission(true);
        try {
            const res = await fetch("/api/forms/submissions/delete", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, action: "delete" }),
            });

            if (!res.ok) throw new Error("Failed to delete submission");

            toast.success("Moved to Trash");
            setSelectedSubmissionId(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to delete submission");
        } finally {
            setIsDeletingSubmission(false);
        }
    };

    // Archive submission
    const handleArchiveSubmission = async (submissionId: string) => {
        setIsDeletingSubmission(true);
        try {
            const res = await fetch("/api/forms/submissions/delete", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, action: "archive" }),
            });

            if (!res.ok) throw new Error("Failed to archive submission");

            toast.success("Submission archived");
            setSelectedSubmissionId(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to archive submission");
        } finally {
            setIsDeletingSubmission(false);
        }
    };

    // Restore submission from trash
    const handleRestoreSubmission = async (submissionId: string) => {
        setIsDeletingSubmission(true);
        try {
            const res = await fetch("/api/forms/submissions/delete", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, action: "restore" }),
            });

            if (!res.ok) throw new Error("Failed to restore submission");

            toast.success("Submission restored");
            setSelectedSubmissionId(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to restore submission");
        } finally {
            setIsDeletingSubmission(false);
        }
    };

    // Permanent delete submission
    const handlePermanentDeleteSubmission = async (submissionId: string) => {
        setIsDeletingSubmission(true);
        try {
            const res = await fetch(`/api/forms/submissions/delete?submissionId=${submissionId}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Failed to permanently delete");

            toast.success("Permanently deleted");
            setSelectedSubmissionId(null);
            setShowDeleteConfirm(false);
            setSubmissionToDelete(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to delete submission");
        } finally {
            setIsDeletingSubmission(false);
        }
    };

    // Message Handlers
    const handleArchiveMessage = async (messageId: string) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg?._apiMeta) {
            // API messages: delete the thread entirely (no archive concept)
            return handleDeleteApiThread(msg);
        }
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "archive" }),
            });
            toast.success("Message archived");
            setSelectedMessageId(null);
            router.refresh();
        } catch (e) { toast.error("Failed to archive"); }
    };

    const handleDeleteMessage = async (messageId: string) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg?._apiMeta) {
            return handleDeleteApiThread(msg);
        }
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "delete" }),
            });
            toast.success("Moved to trash");
            setSelectedMessageId(null);
            router.refresh();
        } catch (e) { toast.error("Failed to delete"); }
    };

    const handleRestoreMessage = async (messageId: string) => {
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "restore" }),
            });
            toast.success("Message restored");
            setSelectedMessageId(null);
            router.refresh();
        } catch (e) { toast.error("Failed to restore"); }
    };

    const handlePermanentDeleteMessage = async (messageId: string) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg?._apiMeta) {
            return handleDeleteApiThread(msg);
        }
        setIsDeletingSubmission(true);
        try {
            await fetch(`/api/messages/${messageId}`, {
                method: "DELETE",
            });
            toast.success("Permanently deleted");
            setSelectedMessageId(null);
            setShowDeleteConfirm(false);
            setMessageToDelete(null);
            router.refresh();
        } catch (e) {
            toast.error("Failed to delete");
        } finally {
            setIsDeletingSubmission(false);
        }
    };

    // Bulk Message Handlers
    const toggleBatchSelection = React.useCallback((id: string) => {
        setSelectedBatchIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const handleBatchArchive = async () => {
        if (selectedBatchIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const msgs = messages.filter(m => selectedBatchIds.includes(m.id));
            const promises = msgs.map(msg => {
                if (msg._apiMeta) {
                    const threadIds = msg._thread ? msg._thread.map((m: any) => m.id) : [msg.id];
                    return fetch("/api/crm/messages/thread", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageIds: threadIds }),
                    });
                }
                return fetch(`/api/messages/${msg.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "archive" }),
                });
            });

            await Promise.all(promises);
            toast.success(`${selectedBatchIds.length} conversations archived`);
            setSelectedBatchIds([]);
            router.refresh();
        } catch (e) {
            toast.error("Bulk archive failed");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedBatchIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const msgs = messages.filter(m => selectedBatchIds.includes(m.id));
            const promises = msgs.map(msg => {
                if (msg._apiMeta) {
                    const threadIds = msg._thread ? msg._thread.map((m: any) => m.id) : [msg.id];
                    return fetch("/api/crm/messages/thread", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageIds: threadIds }),
                    });
                }
                return fetch(`/api/messages/${msg.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "delete" }),
                });
            });

            await Promise.all(promises);
            toast.success(`${selectedBatchIds.length} conversations moved to trash`);
            setSelectedBatchIds([]);
            router.refresh();
        } catch (e) {
            toast.error("Bulk delete failed");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBatchMarkRead = async () => {
        if (selectedBatchIds.length === 0) return;
        setIsBulkProcessing(true);
        try {
            const msgs = messages.filter(m => selectedBatchIds.includes(m.id));
            const promises = msgs.map(msg => {
                if (!msg._apiMeta) {
                    const { myRecipient } = getStatus(msg);
                    if (myRecipient && !myRecipient.is_read) {
                        return fetch(`/api/messages/${msg.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ is_read: true }),
                        });
                    }
                }
                return Promise.resolve();
            });

            await Promise.all(promises);
            toast.success(`${selectedBatchIds.length} conversations marked as read`);
            setSelectedBatchIds([]);
            router.refresh();
        } catch (e) {
            toast.error("Bulk mark read failed");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    // Delete an entire API message thread
    const handleDeleteApiThread = async (msg: Message) => {
        try {
            // Collect all message IDs from the thread
            const threadIds = msg._thread
                ? msg._thread.map((m: any) => m.id)
                : [msg.id];

            const res = await fetch("/api/crm/messages/thread", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageIds: threadIds }),
            });

            if (!res.ok) throw new Error("Failed to delete");

            toast.success("Conversation deleted");
            setSelectedMessageId(null);
            setShowDeleteConfirm(false);
            setMessageToDelete(null);
            router.refresh();
        } catch (e) {
            toast.error("Failed to delete conversation");
        }
    };

    const handleClearNotification = async (notificationId: string) => {
        try {
            const { clearNotification } = await import("@/actions/crm/notifications");
            await clearNotification(notificationId);
            toast.success("Notification cleared");
            setSelectedNotificationId(null);
            router.refresh();
        } catch (e) { toast.error("Failed to clear notification"); }
    };

    const handleMarkNotificationRead = async (notification: SystemNotification) => {
        if (notification.isRead) return;
        try {
            const { markAsRead } = await import("@/actions/crm/notifications");
            await markAsRead(notification.id);
            router.refresh();
        } catch (e) { }
    };

    const handleMessageRead = async (msg: Message) => {
        const { myRecipient } = getStatus(msg);
        if (!myRecipient || myRecipient.is_read) return;
        try {
            await fetch(`/api/messages/${msg.id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_read: true })
            });
            router.refresh();
        } catch (e) { }
    };

    const handleSubmissionViewed = async (id: string, currentStatus: string) => {
        if (currentStatus !== "NEW") return;
        try {
            await fetch("/api/forms/submissions/update", {
                method: "PATCH",
                body: JSON.stringify({ submissionId: id, status: "VIEWED" })
            });
            router.refresh();
        } catch (e) { }
    };

    const handleEditDraft = (message: Message) => {
        setDraftId(message.id);
        const recipient = message.to_user_id || (message.recipients?.[0]?.recipient_id);
        setComposeToUserId(recipient || "");
        setComposeSubject(message.subject || "");
        setComposeBody(message.body || "");
        setComposeOpen(true);
    };

    const handleSendMessage = async () => {
        if (!composeToUserId || !composeBody.trim()) {
            toast.error("Please select a recipient and enter a message");
            return;
        }

        setIsSending(true);
        try {
            if (draftId) {
                // Update draft to sent
                const res = await fetch(`/api/messages/${draftId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "update_draft",
                        recipient_ids: [composeToUserId],
                        subject: composeSubject,
                        body_text: composeBody,
                        status: "SENT"
                    }),
                });
                if (!res.ok) throw new Error("Failed to send");
            } else {
                const res = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recipient_ids: [composeToUserId],
                        subject: composeSubject,
                        body_text: composeBody,
                        status: "SENT",
                        parent_id: composeParentId
                    }),
                });
                if (!res.ok) throw new Error("Failed to send message");
            }

            toast.success("Message sent successfully!");
            setComposeOpen(false);
            setComposeToUserId("");
            setComposeSubject("");
            setComposeBody("");
            setDraftId(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsSending(true);
        try {
            if (draftId) {
                // Update existing draft
                await fetch(`/api/messages/${draftId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "update_draft",
                        recipient_ids: composeToUserId ? [composeToUserId] : [],
                        subject: composeSubject,
                        body_text: composeBody,
                        status: "DRAFT"
                    }),
                });
            } else {
                // Create new draft
                await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recipient_ids: composeToUserId ? [composeToUserId] : [],
                        subject: composeSubject,
                        body_text: composeBody,
                        status: "DRAFT"
                    }),
                });
            }
            toast.success("Draft saved");
            setComposeOpen(false);
            setDraftId(null);
            router.refresh();
        } catch (error) {
            toast.error("Failed to save draft");
        } finally {
            setIsSending(false);
        }
    };

    // Reply to API-originated messages (creates crm_Lead_Activities in same thread)
    const handleApiReply = async () => {
        if (!selectedMessage?._apiMeta || !apiReplyBody.trim()) {
            toast.error("Please enter a reply message");
            return;
        }

        setApiReplySending(true);
        try {
            const res = await fetch("/api/crm/messages/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messageId: selectedMessage.id,
                    body: apiReplyBody,
                    subject: selectedMessage.subject ? `Re: ${selectedMessage.subject}` : undefined,
                    channel: apiReplyChannel.toLowerCase(),
                    sendEmail: apiReplyChannel === "EMAIL",
                }),
            });

            if (!res.ok) throw new Error("Failed to send reply");

            const data = await res.json();
            toast.success(
                apiReplyChannel === "EMAIL"
                    ? "Reply sent via email!"
                    : "Reply added to thread!"
            );
            setApiReplyBody("");
            setApiReplyOpen(false);
            router.refresh();
        } catch (error) {
            toast.error("Failed to send reply");
        } finally {
            setApiReplySending(false);
        }
    };

    // Check if a message is an API message
    const isApiMessage = (msg: Message | null) => {
        return !!msg?._apiMeta;
    };

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const formatMessageDate = (date: Date | string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const daysDiff = diff / (1000 * 60 * 60 * 24);

        if (daysDiff < 1) {
            return formatDistanceToNow(d, { addSuffix: true });
        } else if (daysDiff < 7) {
            return format(d, "EEEE");
        } else {
            return format(d, "MMM d, yyyy");
        }
    };

    const navItems = [
        { id: "inbox" as const, title: "Inbox", icon: Inbox, count: inboxCount },
        { id: "dms" as const, title: "DMs", icon: MessageSquare, count: dmsCount },
        { id: "emails" as const, title: "Emails", icon: Mail, count: emailsCount },
        { id: "sms" as const, title: "SMS", icon: Phone, count: smsCount },
        { id: "internal" as const, title: "Internal", icon: Lock, count: internalCount },
        { id: "submissions" as const, title: "Form Submissions", icon: FormInput, count: submissionsCount },
        { id: "notifications" as const, title: "Notifications", icon: Bell, count: notificationsCount },
        { id: "sent" as const, title: "Sent", icon: Send, count: sentCount },
        { id: "drafts" as const, title: "Drafts", icon: File, count: draftsCount },
        { id: "archive" as const, title: "Archive", icon: Archive, count: totalArchiveCount },
        { id: "trash" as const, title: "Trash", icon: Trash2, count: totalTrashCount },
    ];
    return (
        <>
            <InboxShell
                filteredMessages={filteredMessages}
                activeSubmissions={activeSubmissions}
                activeNotifications={activeNotifications}
                archivedSubmissions={archivedSubmissions}
                trashedSubmissions={trashedSubmissions}
                formSubmissions={formSubmissions}
                notifications={notifications}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserEmail={currentUserEmail}
                defaultLayout={defaultLayout}
                defaultCollapsed={defaultCollapsed}
                activeNav={activeNav}
                onNavChange={setActiveNav}
                selectedMessageId={selectedMessageId}
                selectedSubmissionId={selectedSubmissionId}
                selectedNotificationId={selectedNotificationId}
                selectedMessage={selectedMessage}
                selectedSubmission={selectedSubmission}
                selectedNotification={selectedNotification}
                searchQuery={searchQuery}
                filterReadStatus={filterReadStatus}
                onSearchChange={setSearchQuery}
                onFilterChange={setFilterReadStatus}
                onSelectMessage={setSelectedMessageId}
                onSelectSubmission={setSelectedSubmissionId}
                onSelectNotification={(id) => {
                    setSelectedNotificationId(id);
                }}
                onClearSelection={() => {
                    setSelectedMessageId(null);
                    setSelectedSubmissionId(null);
                    setSelectedNotificationId(null);
                    setApiReplyOpen(false);
                }}
                onArchiveMessage={handleArchiveMessage}
                onDeleteMessage={handleDeleteMessage}
                onRestoreMessage={handleRestoreMessage}
                onPermanentDeleteMessage={(id) => {
                    setMessageToDelete(id);
                    setShowDeleteConfirm(true);
                }}
                onMessageRead={handleMessageRead}
                onEditDraft={handleEditDraft}
                onReply={() => {
                    if (!selectedMessage) return;
                    setComposeToUserId(selectedMessage.from_user_id === currentUserId ? selectedMessage.to_user_id : selectedMessage.from_user_id);
                    setComposeSubject(`Re: ${selectedMessage.subject || ""}`.trim());
                    setComposeBody(`\n\n--- Original Message ---\n${selectedMessage.body}`);
                    setComposeParentId(selectedMessage.parent_id || selectedMessage.id);
                    setComposeOpen(true);
                }}
                onConvertMessage={handleConvertMessage}
                isConvertingEmail={isConvertingEmail}
                onConvertToLead={handleConvertToLead}
                onArchiveSubmission={handleArchiveSubmission}
                onDeleteSubmission={handleDeleteSubmission}
                onRestoreSubmission={handleRestoreSubmission}
                onPermanentDeleteSubmission={(id) => {
                    setSubmissionToDelete(id);
                    setShowDeleteConfirm(true);
                }}
                onSubmissionViewed={handleSubmissionViewed}
                isConvertingToLead={isConvertingToLead}
                isDeletingSubmission={isDeletingSubmission}
                onClearNotification={handleClearNotification}
                onMarkNotificationRead={handleMarkNotificationRead}
                onCompose={() => {
                    setComposeToUserId("");
                    setComposeSubject("");
                    setComposeBody("");
                    setComposeParentId(null);
                    setComposeOpen(true);
                }}
                apiReplyOpen={apiReplyOpen}
                apiReplyBody={apiReplyBody}
                apiReplySending={apiReplySending}
                apiReplyChannel={apiReplyChannel}
                onApiReplyOpenChange={setApiReplyOpen}
                onApiReplyBodyChange={setApiReplyBody}
                onApiReplyChannelChange={setApiReplyChannel}
                onApiReplySend={handleApiReply}
                selectedBatchIds={selectedBatchIds}
                onToggleBatchSelection={toggleBatchSelection}
                onClearBatchSelection={() => setSelectedBatchIds([])}
                onBatchArchive={handleBatchArchive}
                onBatchDelete={handleBatchDelete}
                onBatchMarkRead={handleBatchMarkRead}
                isBulkProcessing={isBulkProcessing}
                isCollapsed={isCollapsed}
                onCollapsedChange={setIsCollapsed}
                getIsTrash={(m) => !!getStatus(m).isTrash}
                getIsApiMessage={isApiMessage}
                navItems={navItems}
            />

            <InboxComposeDialog
                open={composeOpen}
                onOpenChange={setComposeOpen}
                teamMembers={teamMembers}
                currentUserId={currentUserId}
                composeToUserId={composeToUserId}
                composeSubject={composeSubject}
                composeBody={composeBody}
                isSending={isSending}
                onToUserChange={setComposeToUserId}
                onSubjectChange={setComposeSubject}
                onBodyChange={setComposeBody}
                onSend={handleSendMessage}
                onSaveDraft={handleSaveDraft}
            />

            <InboxDeleteDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                isSubmission={!!submissionToDelete}
                isDeleting={isDeletingSubmission || isConvertingToLead}
                onConfirm={() => {
                    if (submissionToDelete) handlePermanentDeleteSubmission(submissionToDelete);
                    if (messageToDelete) handlePermanentDeleteMessage(messageToDelete);
                }}
                onCancel={() => {
                    setShowDeleteConfirm(false);
                    setSubmissionToDelete(null);
                    setMessageToDelete(null);
                }}
            />
        </>
    );
}
