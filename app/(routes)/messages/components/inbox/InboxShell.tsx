"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import {
    ArrowLeft,
    PenBox,
    Inbox,
    Send,
    File,
    Archive,
    Trash2,
    FormInput,
    Bell,
} from "lucide-react";
import { InboxSidebar } from "./InboxSidebar";
import { InboxMessageList } from "./InboxMessageList";
import { InboxMessageDetail } from "./InboxMessageDetail";
import { InboxSubmissionDetail } from "./InboxSubmissionDetail";
import { InboxNotificationDetail } from "./InboxNotificationDetail";
import { InboxEmptyState } from "./InboxEmptyState";

type NavId = "inbox" | "dms" | "emails" | "sms" | "internal" | "sent" | "drafts" | "archive" | "trash" | "submissions" | "notifications";

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
    from_user?: { id: string; name: string | null; email: string | null } | null;
    to_user?: { id: string; name: string | null; email: string | null } | null;
    recipients?: { recipient_id: string; is_archived?: boolean; is_deleted?: boolean; is_read?: boolean }[];
    status?: string;
    _apiMeta?: any;
    _thread?: Message[];
    direction?: string;
    senderName?: string;
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
    form: { id: string; name: string; slug: string; project_id?: string | null };
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

// All the handler / state props that the parent orchestrator passes in
export interface InboxShellProps {
    // Data
    filteredMessages: Message[];
    activeSubmissions: FormSubmission[];
    activeNotifications: SystemNotification[];
    archivedSubmissions: FormSubmission[];
    trashedSubmissions: FormSubmission[];
    formSubmissions: FormSubmission[];
    notifications: SystemNotification[];
    currentUserId: string;
    currentUserName: string;
    currentUserEmail: string;
    defaultLayout: number[];
    defaultCollapsed: boolean;

    // Navigation state
    activeNav: NavId;
    onNavChange: (nav: NavId) => void;

    // Selection state
    selectedMessageId: string | null;
    selectedSubmissionId: string | null;
    selectedNotificationId: string | null;
    selectedMessage: Message | null;
    selectedSubmission: FormSubmission | null;
    selectedNotification: SystemNotification | null;

    // Search / filter
    searchQuery: string;
    filterReadStatus: string;
    onSearchChange: (q: string) => void;
    onFilterChange: (f: string) => void;

    // Selection handlers
    onSelectMessage: (id: string) => void;
    onSelectSubmission: (id: string) => void;
    onSelectNotification: (id: string) => void;
    onClearSelection: () => void;

    // Message handlers
    onArchiveMessage: (id: string) => void;
    onDeleteMessage: (id: string) => void;
    onRestoreMessage: (id: string) => void;
    onPermanentDeleteMessage: (id: string) => void;
    onMessageRead: (msg: Message) => void;
    onEditDraft: (msg: Message) => void;
    onReply: () => void;
    onConvertMessage: (type: "contact" | "lead") => void;
    isConvertingEmail: boolean;

    // Submission handlers
    onConvertToLead: (id: string) => void;
    onArchiveSubmission: (id: string) => void;
    onDeleteSubmission: (id: string) => void;
    onRestoreSubmission: (id: string) => void;
    onPermanentDeleteSubmission: (id: string) => void;
    onSubmissionViewed: (id: string, status: string) => void;
    isConvertingToLead: boolean;
    isDeletingSubmission: boolean;

    // Notification handlers
    onClearNotification: (id: string) => void;
    onMarkNotificationRead: (n: SystemNotification) => void;

    // Compose
    onCompose: () => void;

    // API reply
    apiReplyOpen: boolean;
    apiReplyBody: string;
    apiReplySending: boolean;
    apiReplyChannel: "EMAIL" | "NOTE" | "INTERNAL";
    onApiReplyOpenChange: (open: boolean) => void;
    onApiReplyBodyChange: (body: string) => void;
    onApiReplyChannelChange: (channel: "EMAIL" | "NOTE" | "INTERNAL") => void;
    onApiReplySend: () => void;

    // Sidebar collapsed
    isCollapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;

    // Trash status check
    getIsTrash: (msg: Message) => boolean;
    getIsApiMessage: (msg: Message | null) => boolean;

    // Batch Selection
    selectedBatchIds: string[];
    onToggleBatchSelection: (id: string) => void;
    onClearBatchSelection: () => void;
    onBatchArchive: () => void;
    onBatchDelete: () => void;
    onBatchMarkRead: () => void;
    isBulkProcessing: boolean;

    // Nav items
    navItems: { id: NavId; title: string; icon: React.ElementType; count: number }[];
}

// ─── Swipeable Message Row for Mobile ───
function SwipeableRow({
    children,
    onSwipeLeft,
    onSwipeRight,
}: {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
}) {
    const startX = React.useRef(0);
    const currentX = React.useRef(0);
    const rowRef = React.useRef<HTMLDivElement>(null);
    const threshold = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const diff = e.touches[0].clientX - startX.current;
        currentX.current = diff;
        if (rowRef.current) {
            const clamped = Math.max(-120, Math.min(120, diff));
            rowRef.current.style.transform = `translateX(${clamped}px)`;
            rowRef.current.style.transition = "none";
        }
    };

    const handleTouchEnd = () => {
        if (rowRef.current) {
            rowRef.current.style.transition = "transform 0.25s ease";
            rowRef.current.style.transform = "translateX(0)";
        }
        if (currentX.current < -threshold && onSwipeLeft) {
            onSwipeLeft();
        } else if (currentX.current > threshold && onSwipeRight) {
            onSwipeRight();
        }
    };

    return (
        <div className="relative overflow-hidden">
            {/* Swipe backgrounds */}
            <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-emerald-400">
                    <Archive className="h-4 w-4" />
                    <span className="text-[11px] font-semibold">Archive</span>
                </div>
                <div className="flex items-center gap-2 text-red-400">
                    <span className="text-[11px] font-semibold">Delete</span>
                    <Trash2 className="h-4 w-4" />
                </div>
            </div>
            <div
                ref={rowRef}
                className="relative bg-zinc-950"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}

export function InboxShell(props: InboxShellProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [mobileView, setMobileView] = React.useState<"list" | "detail">("list");
    const messageListPanelRef = React.useRef<ImperativePanelHandle>(null);

    // Reset mobile view when selection clears
    React.useEffect(() => {
        if (!props.selectedMessageId && !props.selectedSubmissionId && !props.selectedNotificationId) {
            setMobileView("list");
        } else {
            // Auto-compact the message list column if it's large and a message was just selected
            if (isDesktop && messageListPanelRef.current) {
                const currentSize = messageListPanelRef.current.getSize();
                if (currentSize > 35) {
                    messageListPanelRef.current.resize(25);
                }
            }
        }
    }, [props.selectedMessageId, props.selectedSubmissionId, props.selectedNotificationId, isDesktop]);

    // ─── Keyboard Shortcuts (Desktop) ───
    const {
        filteredMessages,
        selectedMessageId,
        selectedMessage,
        onSelectMessage,
        onMessageRead,
        onReply,
        onArchiveMessage,
        onDeleteMessage,
        onCompose,
        onClearSelection,
    } = props;

    React.useEffect(() => {
        if (!isDesktop) return;

        const handler = (e: KeyboardEvent) => {
            // Don't fire in inputs/textareas
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") return;

            const msgs = filteredMessages;
            const currentIdx = msgs.findIndex(m => m.id === selectedMessageId);

            switch (e.key.toLowerCase()) {
                case "j": // Next message
                    e.preventDefault();
                    if (currentIdx < msgs.length - 1) {
                        const next = msgs[currentIdx + 1];
                        onSelectMessage(next.id);
                        onMessageRead(next);
                    }
                    break;
                case "k": // Previous message
                    e.preventDefault();
                    if (currentIdx > 0) {
                        const prev = msgs[currentIdx - 1];
                        onSelectMessage(prev.id);
                        onMessageRead(prev);
                    }
                    break;
                case "r": // Reply
                    if (selectedMessage) {
                        e.preventDefault();
                        onReply();
                    }
                    break;
                case "e": // Archive
                    if (selectedMessage) {
                        e.preventDefault();
                        onArchiveMessage(selectedMessage.id);
                    }
                    break;
                case "#": // Delete
                    if (selectedMessage) {
                        e.preventDefault();
                        onDeleteMessage(selectedMessage.id);
                    }
                    break;
                case "c": // Compose
                    e.preventDefault();
                    onCompose();
                    break;
                case "escape":
                    onClearSelection();
                    break;
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [
        isDesktop,
        filteredMessages,
        selectedMessageId,
        selectedMessage,
        onSelectMessage,
        onMessageRead,
        onReply,
        onArchiveMessage,
        onDeleteMessage,
        onCompose,
        onClearSelection,
    ]);

    // Mobile folder pills
    const mobileFolderPills: { id: NavId; label: string; icon: React.ElementType; count: number }[] = [
        { id: "inbox", label: "Inbox", icon: Inbox, count: props.navItems.find(n => n.id === "inbox")?.count || 0 },
        { id: "submissions", label: "Forms", icon: FormInput, count: props.navItems.find(n => n.id === "submissions")?.count || 0 },
        { id: "notifications", label: "Alerts", icon: Bell, count: props.navItems.find(n => n.id === "notifications")?.count || 0 },
        { id: "sent", label: "Sent", icon: Send, count: 0 },
        { id: "drafts", label: "Drafts", icon: File, count: props.navItems.find(n => n.id === "drafts")?.count || 0 },
        { id: "archive", label: "Archive", icon: Archive, count: 0 },
        { id: "trash", label: "Trash", icon: Trash2, count: 0 },
    ];

    // ═══════════════ MOBILE ═══════════════
    if (!isDesktop) {
        const hasSelection = !!(props.selectedMessageId || props.selectedSubmissionId || props.selectedNotificationId);

        return (
            <TooltipProvider delayDuration={0}>
                <div className="flex flex-col h-[calc(100dvh-120px)] bg-background relative overflow-hidden">
                    {hasSelection && mobileView === "detail" ? (
                        /* ─── Detail View ─── */
                        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-background/80 backdrop-blur-xl">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        props.onClearSelection();
                                        setMobileView("list");
                                    }}
                                    className="gap-1 text-muted-foreground hover:text-foreground text-[12px] h-7 -ml-1"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back
                                </Button>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {props.selectedSubmission ? (
                                    <InboxSubmissionDetail
                                        submission={props.selectedSubmission}
                                        onClose={() => { props.onClearSelection(); setMobileView("list"); }}
                                        onConvertToLead={props.onConvertToLead}
                                        onArchive={props.onArchiveSubmission}
                                        onDelete={props.onDeleteSubmission}
                                        onRestore={props.onRestoreSubmission}
                                        onPermanentDelete={props.onPermanentDeleteSubmission}
                                        isConverting={props.isConvertingToLead}
                                        isDeleting={props.isDeletingSubmission}
                                    />
                                ) : props.selectedNotification ? (
                                    <InboxNotificationDetail
                                        notification={props.selectedNotification}
                                        onClose={() => { props.onClearSelection(); setMobileView("list"); }}
                                        onClear={props.onClearNotification}
                                    />
                                ) : props.selectedMessage ? (
                                    <InboxMessageDetail
                                        selectedMessage={props.selectedMessage}
                                        currentUserId={props.currentUserId}
                                        isTrash={props.getIsTrash(props.selectedMessage)}
                                        isApiMessage={props.getIsApiMessage(props.selectedMessage)}
                                        onClose={() => { props.onClearSelection(); setMobileView("list"); }}
                                        onReply={props.onReply}
                                        onArchive={props.onArchiveMessage}
                                        onDelete={props.onDeleteMessage}
                                        onRestore={props.onRestoreMessage}
                                        onPermanentDelete={props.onPermanentDeleteMessage}
                                        onConvertMessage={props.onConvertMessage}
                                        isConvertingEmail={props.isConvertingEmail}
                                        onCompose={props.onCompose}
                                        apiReplyOpen={props.apiReplyOpen}
                                        apiReplyBody={props.apiReplyBody}
                                        apiReplySending={props.apiReplySending}
                                        apiReplyChannel={props.apiReplyChannel}
                                        onApiReplyOpenChange={props.onApiReplyOpenChange}
                                        onApiReplyBodyChange={props.onApiReplyBodyChange}
                                        onApiReplyChannelChange={props.onApiReplyChannelChange}
                                        onApiReplySend={props.onApiReplySend}
                                    />
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        /* ─── List View ─── */
                        <div className="flex flex-col h-full">
                        {/* Mobile folder pills */}
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 overflow-x-auto no-scrollbar">
                            {mobileFolderPills.map((pill) => {
                                const Icon = pill.icon;
                                const isActive = props.activeNav === pill.id;
                                return (
                                    <button
                                        key={pill.id}
                                        onClick={() => props.onNavChange(pill.id)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-3 w-3" />
                                        {pill.label}
                                        {pill.count > 0 && (
                                            <span className={cn(
                                                "text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1",
                                                isActive ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                                            )}>
                                                {pill.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile message list */}
                        <ScrollArea className="flex-1">
                            <InboxMessageList
                                activeNav={props.activeNav}
                                filteredMessages={props.filteredMessages}
                                activeSubmissions={props.activeSubmissions}
                                activeNotifications={props.activeNotifications}
                                archivedSubmissions={props.archivedSubmissions}
                                trashedSubmissions={props.trashedSubmissions}
                                currentUserId={props.currentUserId}
                                selectedMessageId={props.selectedMessageId}
                                selectedSubmissionId={props.selectedSubmissionId}
                                selectedNotificationId={props.selectedNotificationId}
                                searchQuery={props.searchQuery}
                                filterReadStatus={props.filterReadStatus}
                                onSearchChange={props.onSearchChange}
                                onFilterChange={props.onFilterChange}
                                onSelectMessage={(id) => { props.onSelectMessage(id); setMobileView("detail"); }}
                                onSelectSubmission={(id) => { props.onSelectSubmission(id); setMobileView("detail"); }}
                                onSelectNotification={(id) => { props.onSelectNotification(id); setMobileView("detail"); }}
                                onArchiveMessage={props.onArchiveMessage}
                                onDeleteMessage={props.onDeleteMessage}
                                onEditDraft={(msg) => { props.onEditDraft(msg); }}
                                onMessageRead={props.onMessageRead}
                                onSubmissionViewed={props.onSubmissionViewed}
                                onMarkNotificationRead={props.onMarkNotificationRead}
                                selectedBatchIds={props.selectedBatchIds}
                                onToggleBatchSelection={props.onToggleBatchSelection}
                                onClearBatchSelection={props.onClearBatchSelection}
                                onBatchArchive={props.onBatchArchive}
                                onBatchDelete={props.onBatchDelete}
                                onBatchMarkRead={props.onBatchMarkRead}
                                isBulkProcessing={props.isBulkProcessing}
                            />
                        </ScrollArea>

                        {/* Gmail-style FAB */}
                        <div className="absolute bottom-6 right-5 z-20">
                            <Button
                                onClick={props.onCompose}
                                className="h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 text-primary-foreground transition-all duration-200 hover:scale-105 active:scale-95"
                                size="icon"
                            >
                                <PenBox className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )}
                </div>
            </TooltipProvider>
        );
    }

    // ═══════════════ DESKTOP ═══════════════
    return (
        <TooltipProvider delayDuration={0}>
            <ResizablePanelGroup
                direction="horizontal"
                onLayout={(sizes: number[]) => {
                    document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
                }}
                className="h-full w-full items-stretch bg-background overflow-hidden"
            >
                {/* Left Sidebar */}
                <ResizablePanel
                    defaultSize={props.defaultLayout[0]}
                    collapsedSize={4}
                    collapsible={true}
                    minSize={14}
                    maxSize={22}
                    onCollapse={() => {
                        props.onCollapsedChange(true);
                        document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`;
                    }}
                    onExpand={() => {
                        props.onCollapsedChange(false);
                        document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`;
                    }}
                    className={cn(props.isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}
                >
                    <InboxSidebar
                        activeNav={props.activeNav}
                        onNavChange={props.onNavChange}
                        onCompose={props.onCompose}
                        isCollapsed={props.isCollapsed}
                        currentUserName={props.currentUserName}
                        currentUserEmail={props.currentUserEmail}
                        navItems={props.navItems}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/30 transition-colors data-[resize-handle-active]:bg-primary/50" />

                {/* Middle — Message List */}
                <ResizablePanel ref={messageListPanelRef} defaultSize={props.defaultLayout[1]} minSize={22}>
                    <InboxMessageList
                        activeNav={props.activeNav}
                        filteredMessages={props.filteredMessages}
                        activeSubmissions={props.activeSubmissions}
                        activeNotifications={props.activeNotifications}
                        archivedSubmissions={props.archivedSubmissions}
                        trashedSubmissions={props.trashedSubmissions}
                        currentUserId={props.currentUserId}
                        selectedMessageId={props.selectedMessageId}
                        selectedSubmissionId={props.selectedSubmissionId}
                        selectedNotificationId={props.selectedNotificationId}
                        searchQuery={props.searchQuery}
                        filterReadStatus={props.filterReadStatus}
                        onSearchChange={props.onSearchChange}
                        onFilterChange={props.onFilterChange}
                        onSelectMessage={props.onSelectMessage}
                        onSelectSubmission={props.onSelectSubmission}
                        onSelectNotification={props.onSelectNotification}
                        onArchiveMessage={props.onArchiveMessage}
                        onDeleteMessage={props.onDeleteMessage}
                        onEditDraft={props.onEditDraft}
                        onMessageRead={props.onMessageRead}
                        onSubmissionViewed={props.onSubmissionViewed}
                        onMarkNotificationRead={props.onMarkNotificationRead}
                        selectedBatchIds={props.selectedBatchIds}
                        onToggleBatchSelection={props.onToggleBatchSelection}
                        onClearBatchSelection={props.onClearBatchSelection}
                        onBatchArchive={props.onBatchArchive}
                        onBatchDelete={props.onBatchDelete}
                        onBatchMarkRead={props.onBatchMarkRead}
                        isBulkProcessing={props.isBulkProcessing}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/30 transition-colors data-[resize-handle-active]:bg-primary/50" />

                {/* Right — Detail Pane */}
                <ResizablePanel defaultSize={props.defaultLayout[2]}>
                    <div className="flex flex-col h-full min-w-0 overflow-hidden">
                        {props.selectedNotification ? (
                            <InboxNotificationDetail
                                notification={props.selectedNotification}
                                onClose={() => props.onClearSelection()}
                                onClear={props.onClearNotification}
                            />
                        ) : props.selectedSubmission ? (
                            <InboxSubmissionDetail
                                submission={props.selectedSubmission}
                                onClose={() => props.onClearSelection()}
                                onConvertToLead={props.onConvertToLead}
                                onArchive={props.onArchiveSubmission}
                                onDelete={props.onDeleteSubmission}
                                onRestore={props.onRestoreSubmission}
                                onPermanentDelete={props.onPermanentDeleteSubmission}
                                isConverting={props.isConvertingToLead}
                                isDeleting={props.isDeletingSubmission}
                            />
                        ) : (
                            <InboxMessageDetail
                                selectedMessage={props.selectedMessage}
                                currentUserId={props.currentUserId}
                                isTrash={props.selectedMessage ? props.getIsTrash(props.selectedMessage) : false}
                                isApiMessage={props.getIsApiMessage(props.selectedMessage)}
                                onClose={() => props.onClearSelection()}
                                onReply={props.onReply}
                                onArchive={props.onArchiveMessage}
                                onDelete={props.onDeleteMessage}
                                onRestore={props.onRestoreMessage}
                                onPermanentDelete={props.onPermanentDeleteMessage}
                                onConvertMessage={props.onConvertMessage}
                                isConvertingEmail={props.isConvertingEmail}
                                onCompose={props.onCompose}
                                apiReplyOpen={props.apiReplyOpen}
                                apiReplyBody={props.apiReplyBody}
                                apiReplySending={props.apiReplySending}
                                apiReplyChannel={props.apiReplyChannel}
                                onApiReplyOpenChange={props.onApiReplyOpenChange}
                                onApiReplyBodyChange={props.onApiReplyBodyChange}
                                onApiReplyChannelChange={props.onApiReplyChannelChange}
                                onApiReplySend={props.onApiReplySend}
                            />
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </TooltipProvider>
    );
}
