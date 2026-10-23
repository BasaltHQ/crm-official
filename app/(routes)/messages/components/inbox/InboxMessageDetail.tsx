"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Reply,
    Forward,
    Archive,
    Trash2,
    X,
    Undo2,
    Send,
    Users2,
    UserPlus,
    PenBox,
} from "lucide-react";
import { format } from "date-fns";
import { InboxEmptyState } from "./InboxEmptyState";

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
    _apiMeta?: { conversation_id?: string; direction?: string; channel?: string; contactId?: string; leadId?: string; clientName?: string; clientEmail?: string; [key: string]: any };
    _thread?: Message[];
    direction?: string;
    senderName?: string;
}

function avatarHue(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 55%, 55%)`;
}

function getInitials(name: string | null | undefined) {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

interface InboxMessageDetailProps {
    selectedMessage: Message | null;
    currentUserId: string;
    isTrash: boolean;
    isApiMessage: boolean;

    // Handlers
    onClose: () => void;
    onReply: () => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
    onPermanentDelete: (id: string) => void;
    onConvertMessage: (type: "contact" | "lead") => void;
    isConvertingEmail: boolean;
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
}

export function InboxMessageDetail({
    selectedMessage,
    currentUserId,
    isTrash,
    isApiMessage,
    onClose,
    onReply,
    onArchive,
    onDelete,
    onRestore,
    onPermanentDelete,
    onConvertMessage,
    isConvertingEmail,
    onCompose,
    apiReplyOpen,
    apiReplyBody,
    apiReplySending,
    apiReplyChannel,
    onApiReplyOpenChange,
    onApiReplyBodyChange,
    onApiReplyChannelChange,
    onApiReplySend,
}: InboxMessageDetailProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of thread on message change
    React.useEffect(() => {
        if (selectedMessage?._thread && scrollRef.current) {
            const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
            if (el) {
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight;
                });
            }
        }
    }, [selectedMessage?.id, selectedMessage?._thread]);

    if (!selectedMessage) {
        return (
            <div className="h-full flex flex-col">
                <InboxEmptyState type="detail" />
                <div className="flex justify-center pb-8">
                    <Button
                        variant="outline"
                        className="gap-2 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-600"
                        onClick={onCompose}
                    >
                        <PenBox className="h-4 w-4" />
                        Compose Message
                    </Button>
                </div>
            </div>
        );
    }

    const msg = selectedMessage;
    const fromName = msg.from_user?.name || msg.from_user?.email || "Unknown";
    const fromColor = avatarHue(fromName);
    const showConvertBar = isApiMessage && msg._apiMeta?.channel === "EMAIL" && !msg._apiMeta?.contactId && !msg._apiMeta?.leadId;

    return (
        <div className="flex flex-col h-full min-w-0 overflow-hidden bg-background">
            {/* Sticky Header */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex-1 min-w-0 max-w-full">
                    <h3 className="text-[14px] font-semibold text-foreground truncate">
                        {msg.subject || "(No Subject)"}
                    </h3>
                </div>

                <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                    {showConvertBar && (
                        <div className="flex items-center gap-1.5 border-r border-border pr-2">
                            <Button size="sm" variant="outline" onClick={() => onConvertMessage("contact")} disabled={isConvertingEmail} className="h-7 text-[11px] gap-1 border-border text-muted-foreground hover:text-foreground">
                                <Users2 className="w-3 h-3" /> Contact
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onConvertMessage("lead")} disabled={isConvertingEmail} className="h-7 text-[11px] gap-1 border-border text-muted-foreground hover:text-foreground">
                                <UserPlus className="w-3 h-3" /> Lead
                            </Button>
                        </div>
                    )}

                    {/* Action toolbar */}
                    <div className="flex flex-wrap items-center gap-0.5 flex-shrink-0">
                        {isTrash ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onRestore(msg.id)} className="gap-1.5 h-7 text-[11px] border-border text-muted-foreground hover:text-foreground">
                                    <Undo2 className="h-3.5 w-3.5" /> Restore
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => onPermanentDelete(msg.id)} className="gap-1.5 h-7 text-[11px]">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                                </Button>
                            </>
                        ) : (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onReply}>
                                            <Reply className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-muted border-border text-foreground text-xs">Reply (R)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted">
                                            <Forward className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-muted border-border text-foreground text-xs">Forward</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => onArchive(msg.id)}>
                                            <Archive className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-muted border-border text-foreground text-xs">Archive (E)</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(msg.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-muted border-border text-foreground text-xs">Delete (#)</TooltipContent>
                                </Tooltip>
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1 text-muted-foreground hover:text-foreground" onClick={onClose}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sender Info Bar */}
            <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
                <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 ring-1 ring-border/50">
                        <AvatarFallback
                            className="text-[11px] font-bold"
                            style={{ backgroundColor: `${fromColor}15`, color: fromColor }}
                        >
                            {getInitials(fromName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground">{fromName}</span>
                            {msg.from_user_id === currentUserId && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border text-muted-foreground">You</Badge>
                            )}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">
                            To: {msg.to_user?.name || msg.to_user?.email || "Unknown"}
                            {msg.to_user_id === currentUserId && " (You)"}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
                            {format(new Date(msg.createdAt), "PPpp")}
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Body / Thread */}
            <ScrollArea className="flex-1 min-w-0 bg-background" ref={scrollRef}>
                <div className="p-4 overflow-hidden">
                    {/* API message badges */}
                    {isApiMessage && (
                        <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/25">
                                {(msg._apiMeta?.channel || "NOTE").toUpperCase() === "NOTE" ? "DM" : msg._apiMeta?.channel?.toUpperCase() || "DM"}
                            </Badge>
                            {msg._apiMeta?.conversation_id && (
                                <Badge variant="outline" className="text-[10px] h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/25 font-mono">
                                    Thread: {msg._apiMeta.conversation_id.slice(0, 8)}…
                                </Badge>
                            )}
                            {msg._thread && msg._thread.length > 1 && (
                                <Badge variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">
                                    {msg._thread.length} messages
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* Thread view */}
                    {msg._thread && msg._thread.length > 0 ? (
                        <div className="space-y-3">
                            {msg._thread.map((threadMsg: any) => {
                                const isOut = threadMsg.direction === "OUTBOUND" || threadMsg._apiMeta?.direction === "OUTBOUND" || threadMsg.from_user_id === currentUserId;
                                const senderName = threadMsg.senderName || threadMsg.from_user?.name || (isOut ? "You" : "Customer");
                                const sColor = avatarHue(senderName);
                                return (
                                    <div key={threadMsg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                                        {!isOut && (
                                            <Avatar className="h-7 w-7 mr-2 mt-1 flex-shrink-0 ring-1 ring-border/30">
                                                <AvatarFallback className="text-[9px] font-bold" style={{ backgroundColor: `${sColor}15`, color: sColor }}>
                                                    {getInitials(senderName)}
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn(
                                            "max-w-[75%] rounded-2xl px-4 py-2.5",
                                            isOut
                                                ? "bg-primary text-primary-foreground rounded-br-md"
                                                : "bg-muted/80 border border-border/40 rounded-bl-md"
                                        )}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn("text-[10.5px] font-semibold", isOut ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                                    {senderName}
                                                </span>
                                                <span className={cn("text-[9.5px]", isOut ? "text-primary-foreground/60" : "text-muted-foreground/60")}>
                                                    {format(new Date(threadMsg.createdAt), "MMM d, h:mm a")}
                                                </span>
                                                {threadMsg.channel && (
                                                    <span className={cn(
                                                        "text-[8.5px] px-1.5 py-0.5 rounded font-medium border uppercase ml-1",
                                                        threadMsg.channel.toUpperCase() === "EMAIL" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                        threadMsg.channel.toUpperCase() === "FORM" ? "bg-violet-500/10 text-violet-500 border-violet-500/20" :
                                                        threadMsg.channel.toUpperCase() === "INTERNAL" ? "bg-primary/10 text-primary border-primary/20" :
                                                        "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    )}>
                                                        {threadMsg.channel.toUpperCase() === "NOTE" ? "DM" : threadMsg.channel}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={cn("text-[13px] whitespace-pre-wrap break-words break-all leading-relaxed", isOut ? "text-primary-foreground/95" : "text-foreground")}>
                                                {threadMsg.body}
                                            </div>
                                        </div>
                                        {isOut && (
                                            <Avatar className="h-7 w-7 ml-2 mt-1 flex-shrink-0 ring-1 ring-border/30">
                                                <AvatarFallback className="text-[9px] font-bold bg-primary/15 text-primary">
                                                    {getInitials(senderName)}
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Single message view */
                        <div className="prose prose-sm prose-invert w-full min-w-0 overflow-hidden">
                            <div className="text-[13px] text-foreground leading-relaxed break-words break-all whitespace-pre-wrap">
                                {msg.body}
                            </div>
                        </div>
                    )}

                    {/* API Reply Form */}
                    {isApiMessage && apiReplyOpen && (
                        <div className="mt-5 rounded-xl border border-border/50 bg-muted/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[12px] font-semibold text-foreground">Reply to thread</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Label className="text-[11px] text-muted-foreground w-14">Channel</Label>
                                    <Select value={apiReplyChannel} onValueChange={(v: any) => onApiReplyChannelChange(v)}>
                                        <SelectTrigger className="h-7 w-28 text-[11px] bg-muted/50 border-border/50 text-foreground">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-muted border-border text-foreground">
                                            <SelectItem value="EMAIL">Email</SelectItem>
                                            <SelectItem value="NOTE">DM</SelectItem>
                                            <SelectItem value="INTERNAL">Internal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {apiReplyChannel === "EMAIL" && (
                                        <span className="text-[10px] text-amber-500/80 font-medium">Will send actual email</span>
                                    )}
                                </div>
                                <Textarea
                                    placeholder="Type your reply..."
                                    rows={3}
                                    value={apiReplyBody}
                                    onChange={(e) => onApiReplyBodyChange(e.target.value)}
                                    className="text-[12.5px] bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { onApiReplyOpenChange(false); onApiReplyBodyChange(""); }} className="h-7 text-[11px] border-border text-muted-foreground">
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={onApiReplySend} disabled={apiReplySending || !apiReplyBody.trim()} className="h-7 text-[11px] gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
                                        <Send className="h-3 w-3" />
                                        {apiReplySending ? "Sending..." : "Send Reply"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick reply button */}
                    {isApiMessage && !apiReplyOpen && (
                        <div className="mt-5">
                            <Button
                                variant="outline"
                                className="w-full gap-2 h-9 text-[12px] border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => {
                                    onApiReplyOpenChange(true);
                                    onApiReplyChannelChange(msg._apiMeta?.channel === "EMAIL" ? "EMAIL" : msg._apiMeta?.channel === "INTERNAL" ? "INTERNAL" : "NOTE");
                                }}
                            >
                                <Reply className="h-3.5 w-3.5" />
                                Reply to this message
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
