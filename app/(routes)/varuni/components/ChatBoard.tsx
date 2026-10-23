"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { Loader, Send, Square, RefreshCw, ArrowDown, Download, MoreVertical, Menu, Paperclip, X, File as FileIcon } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ChatMessage = {
    id: string;
    session: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
    attachments?: any[];
};

const MAX_TOKENS = 275000;

function estimateTokens(text: string): number {
    if (!text) return 0;
    const c = text.trim().length;
    // Rough estimate: ~4 characters per token
    return Math.ceil(c / 4);
}

interface ChatBoardProps {
    sessionId: string;
    initialMessages: ChatMessage[];
    isTemporary: boolean;
    onRefresh: () => void;
    onToggleSidebar?: () => void;
    sessionTitle?: string | null;
    isCompact?: boolean;
}

export default function ChatBoard({ sessionId, initialMessages, isTemporary, onRefresh, onToggleSidebar, sessionTitle, isCompact }: ChatBoardProps) {
    const [localInput, setLocalInput] = useState("");
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [attachments, setAttachments] = useState<{ url: string, contentType: string, name: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeBranches, setActiveBranches] = useState<Record<string, string>>({});

    // Convert DB messages (plain content strings) to AI SDK v6 UIMessage format (parts arrays)
    const normalizeToUIMessages = (msgs: ChatMessage[]): any[] => {
        return msgs.map(m => {
            const hasParts = (m as any).parts && Array.isArray((m as any).parts);
            const uiMsg: any = hasParts ? { ...m } : {
                ...m,
                parts: m.content ? [{ type: 'text', text: m.content }] : [],
            };

            if (m.attachments && Array.isArray(m.attachments)) {
                uiMsg.experimental_attachments = m.attachments;
            }

            return uiMsg;
        });
    };

    // Client-side Tree Builder & Active Path Resolver
    const { linearizedMessages, siblingInfo } = useMemo(() => {
        if (!initialMessages || initialMessages.length === 0) return { linearizedMessages: [], siblingInfo: {} };
        const map = new Map<string, any>();
        const roots: any[] = [];
        
        // Fix legacy messages: implicitly link null-parents together temporally
        const sorted = [...initialMessages].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let implicitParentId: string | null = null;

        sorted.forEach(m => {
            const resolvedParent = (m as any).parent || implicitParentId;
            map.set(m.id, { ...m, parent: resolvedParent, children: [] });
            implicitParentId = m.id; // Successive unparented messages will chain to this one
        });
        
        sorted.forEach(m => {
            const mappedNode = map.get(m.id);
            if (mappedNode.parent && map.has(mappedNode.parent)) {
                map.get(mappedNode.parent).children.push(mappedNode);
            } else {
                roots.push(mappedNode);
            }
        });

        const linear: any[] = [];
        const info: Record<string, { count: number, index: number, siblings: any[] }> = {};
        
        // Walk down tree, selecting active branch at each fork
        let currentLevel = roots.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        while (currentLevel.length > 0) {
            const parentId = currentLevel[0].parent || 'root';
            const activeChildId = activeBranches[parentId];
            
            let activeIdx = currentLevel.length - 1; // Default to newest sibling
            if (activeChildId) {
                const mapIdx = currentLevel.findIndex(c => c.id === activeChildId);
                if (mapIdx !== -1) activeIdx = mapIdx;
            }
            
            const activeChild = currentLevel[activeIdx];
            
            // Record UI info to power the < 1 / 3 > navigators
            info[activeChild.id] = {
                count: currentLevel.length,
                index: activeIdx,
                siblings: currentLevel
            };
            
            linear.push(activeChild);
            currentLevel = activeChild.children.sort((a: any,b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        return { linearizedMessages: linear, siblingInfo: info };
    }, [initialMessages, activeBranches]);

    const activeParentIdRef = useRef<string | undefined>(undefined);
    const activeAttachmentsRef = useRef<any[] | undefined>(undefined);

    const chatHelpers = useChat({
        transport: typeof DefaultChatTransport !== 'undefined' ? new (DefaultChatTransport as any)({
            api: '/api/varuni',
            body: { 
                sessionId,
                get parentId() { return activeParentIdRef.current; },
                get attachments() { return activeAttachmentsRef.current; }
            },
        }) : undefined,
        api: '/api/varuni', // Fallback if transport isn't standard
        body: { 
            sessionId,
            get parentId() { return activeParentIdRef.current; },
            get attachments() { return activeAttachmentsRef.current; }
        },
        id: sessionId,
        initialMessages: normalizeToUIMessages(linearizedMessages),
        onError: (err: unknown) => {
            console.error("[CHAT_STREAM_ERROR]", err);
            toast.error(`Streaming error: ${(err as Error).message || "Unknown error"}`);
        },
        onFinish: () => {
            setTimeout(() => {
                onRefresh();
            }, 2000);
        }
    } as any);

    const { messages, append, sendMessage, reload, stop, isLoading, status, setMessages } = chatHelpers as any;
    
    // Abstract the submit function since vercel AI SDK keeps changing the API name between versions
    const sendPayload = async (content: string, parentId?: string, attachedFiles?: any[]) => {
        // Dynamically inject the parentId & attachments into the payload body via the getter
        activeParentIdRef.current = parentId;
        activeAttachmentsRef.current = attachedFiles?.length ? attachedFiles : undefined;
        
        let payloadOptions: any = { data: { parentId } };
        // We inject experimental_attachments directly into the options payload.
        // Even if some AI SDK versions strip it, the `activeAttachmentsRef` body block still sends it globally.
        if (attachedFiles && attachedFiles.length > 0) {
            payloadOptions.experimental_attachments = attachedFiles;
        }

        if (append) {
             await append({ role: 'user', content }, payloadOptions);
        } else if (sendMessage) {
             await sendMessage({ text: content, ...payloadOptions });
        }
        
        // Reset after a brief delay so standard chat messages don't inherit the branch parent later
        setTimeout(() => { 
            activeParentIdRef.current = undefined; 
            activeAttachmentsRef.current = undefined;
        }, 100);
    };

    // Resync Vercel AI SDK when the active branch path changes
    const activePathKey = useMemo(() => linearizedMessages.map(m => m.id).join(','), [linearizedMessages]);
    const previousPathKeyRef = useRef(activePathKey);
    
    const isBranchingRef = useRef(false);
    // Derive a string key to prevent referential equality triggering loops
    const initialMessagesKey = useMemo(() => initialMessages.map(m => m.id).join(','), [initialMessages]);

    // Clear branch lock only when DB actually provides new layout
    useEffect(() => {
        isBranchingRef.current = false;
    }, [initialMessagesKey]);

    useEffect(() => {
        if (isBranchingRef.current) return;

        if (activePathKey !== previousPathKeyRef.current) {
             setMessages(normalizeToUIMessages(linearizedMessages));
             previousPathKeyRef.current = activePathKey;
        } else if (messages.length === 0 && linearizedMessages.length > 0) {
             setMessages(normalizeToUIMessages(linearizedMessages));
        } else if (messages.length <= linearizedMessages.length && messages.map((m: any)=>m.id).join(',') !== activePathKey) {
             setMessages(normalizeToUIMessages(linearizedMessages));
             previousPathKeyRef.current = activePathKey;
        }
    }, [activePathKey, linearizedMessages, setMessages, messages]);

    const handleNavigateSibling = (id: string, direction: 'prev' | 'next') => {
        const info = siblingInfo[id];
        if (!info) return;
        const newIdx = direction === 'prev' ? Math.max(0, info.index - 1) : Math.min(info.count - 1, info.index + 1);
        const newActiveId = info.siblings[newIdx].id;
        const parentId = info.siblings[0].parent || 'root';
        setActiveBranches(prev => ({ ...prev, [parentId]: newActiveId }));
    };

    const handleBranchSubmit = async (messageIdToEdit: string, newContent: string) => {
        isBranchingRef.current = true;
        
        // Find exactly where this message exists in the Vercel AI array
        const targetIdx = messages.findIndex((m: any) => m.id === messageIdToEdit);
        if (targetIdx === -1) return;

        // Keep all messages BEFORE the one being edited
        const newHistory = targetIdx > 0 ? messages.slice(0, targetIdx) : [];
        const parentId = targetIdx > 0 ? messages[targetIdx - 1].id : undefined;

        // Native Vercel AI SDK pattern: setMessages to truncate, then immediately append!
        // This is now safe because the initialMessagesKey lock prevents arbitrary overrides!
        setMessages(newHistory);
        await sendPayload(newContent, parentId);
    };

    const usedTokens = useMemo(() => {
        const messageTokens = (messages || []).reduce((sum: number, m: any) => {
            let text = "";
            let attTokens = 0;
            
            // Extract text from standard string OR v6 parts array
            if (typeof m.content === 'string') text += m.content;
            if (m.parts && Array.isArray(m.parts)) {
                text += m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
            }
            
            // Account for any multimodal attachments loaded into history
            if (m.experimental_attachments?.length) {
                attTokens = m.experimental_attachments.length * 1024;
            } else if (m.parts && Array.isArray(m.parts)) {
                const imgParts = m.parts.filter((p: any) => p.type === 'image');
                attTokens = imgParts.length * 1024;
            }
            
            return sum + estimateTokens(text) + attTokens;
        }, 0);

        // Add staged input text + staged attachments safely
        const inputTokens = estimateTokens(localInput);
        const stagedAttachmentTokens = (attachments?.length || 0) * 1024;
        
        return messageTokens + inputTokens + stagedAttachmentTokens;
    }, [messages, localInput, attachments]);

    const percentUsed = Math.min(100, Math.round((usedTokens / MAX_TOKENS) * 100));

    const listRef = useRef<HTMLDivElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollButton(!isNearBottom);
        }
    };

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const content = localInput.trim();
        // Allow submission without text IF there are attachments
        if (!content && attachments.length === 0) return;

        setLocalInput("");

        try {
            const latestParentId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
            const payloadAttachments = attachments.length > 0 ? [...attachments] : undefined;
            
            // Clear attachments immediately so UI is responsive
            setAttachments([]);
            
            await sendPayload(content || "Please review the attached files.", latestParentId, payloadAttachments);
        } catch (err) {
            toast.error("Failed to send message.");
            console.error(err);
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const form = e.currentTarget.closest("form");
            if (form) form.requestSubmit();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalInput(e.target.value);
        if (e.target) {
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
        }
    };

    const handleExport = () => {
        if (!messages.length) return;
        const text = messages.map((m: any) => `[${new Date(m.createdAt).toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content || (m.parts ? m.parts.map((p: any) => typeof p === 'string' ? p : (p.text || '')).join('') : '')}\n`).join("\n---\n\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-export-${sessionId}.txt`;
        document.body.appendChild(a);
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Chat exported!");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        setIsUploading(true);
        try {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append("file", file);
            
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");
            
            setAttachments(prev => [...prev, { 
                url: data.document.document_file_url,
                contentType: data.document.document_file_mimeType,
                name: data.document.document_name
            }]);
        } catch (err) {
            toast.error((err as Error).message || "Failed to upload file");
            console.error(err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const activeModelName = useMemo(() => {
        const latestAssistantMessage = [...messages].reverse().find((m: any) => m.role === 'assistant' && m.model);
        if (latestAssistantMessage?.model) {
            // Simplify model IDs like 'qwen.qwen3-vl-235b-a22b-instruct-v1:0'
            const raw = latestAssistantMessage.model;
            if (raw.includes("qwen") || raw.includes("haiku") || raw.includes("sonnet")) {
                 const match = raw.match(/qwen3?-[^:]+|haiku|sonnet/i);
                 if (match) return match[0].toUpperCase();
            }
            return raw.split(':')[0].split('/').pop() || raw;
        }
        return null;
    }, [messages]);

    return (
        <div className={cn("flex flex-col h-full bg-background relative overflow-hidden", isCompact ? "h-[600px] border-l" : "")}>
            <div className="absolute top-0 right-0 left-0 h-16 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
            
            {/* Header (Context & Refresh) */}
            <div className={cn(
                "flex items-center justify-between px-4 border-b bg-background/95 backdrop-blur z-20 sticky top-0 shrink-0",
                isCompact ? "h-14 py-2" : "h-auto min-h-14 py-2"
            )}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("shrink-0", isCompact ? "h-8 w-8" : "sm:hidden")}
                        onClick={onToggleSidebar}
                    >
                        <Menu className="w-4 h-4" />
                    </Button>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className={cn(
                                "font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase truncate max-w-[200px] md:max-w-none",
                                isCompact ? "text-base py-0 px-0" : "text-3xl md:text-5xl py-4 px-4 mb-[2px]"
                            )}>
                                {sessionTitle || "Varuni AI Assistant"}
                            </h1>
                            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-green-500 animate-pulse" />
                        </div>
                        <div className={cn("flex items-center gap-2", isCompact ? "-mt-0.5 ml-0 mb-0" : "-mt-1 ml-4 mb-2")}>
                            {activeModelName ? (
                                <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider opacity-70 truncate max-w-[150px] sm:max-w-none">
                                    MODEL: <span className="text-primary font-bold">{activeModelName}</span>
                                </span>
                            ) : (
                                <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider opacity-70">
                                    VARUNI SYSTEM
                                </span>
                            )}
                            {isTemporary && (
                                <span className="text-[9px] text-amber-500 font-medium flex items-center gap-1">
                                    History Off
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground hidden md:flex">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-colors ${percentUsed >= 90 ? "bg-red-500" : percentUsed >= 75 ? "bg-yellow-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.min(100, percentUsed)}%` }}
                            />
                        </div>
                        <span>{percentUsed}%</span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onRefresh}>
                                <RefreshCw className="w-3 h-3 mr-2" /> Refresh Context
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExport}>
                                <Download className="w-3 h-3 mr-2" /> Export Chat
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Messages list */}
            <div
                ref={listRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar"
            >
                <div className="max-w-5xl mx-auto space-y-6 pb-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 pt-10">
                            <div className="p-4 bg-primary/10 rounded-full">
                                <RefreshCw className="w-8 h-8 text-primary animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Welcome to Varuni</h3>
                                <p className="text-sm text-muted-foreground">Start a conversation to get assistance.</p>
                            </div>
                        </div>
                    )}

                    {messages.map((m: any) => {
                        // AI SDK v6: render via message.parts array
                        if (m.parts && Array.isArray(m.parts)) {
                            // DEBUG: log part types to understand the format
                            if (m.role === 'assistant') {
                                console.log('[CHAT_PARTS]', m.id, m.parts.map((p: any) => ({ type: p.type, state: p.state, toolName: p.toolName })));
                            }
                            const textContent = m.parts
                                .filter((p: any) => p.type === 'text' && p.text)
                                .map((p: any) => p.text)
                                .join('');
                            
                            // Detect tool parts (type starts with 'tool-' in v6, or 'tool-invocation' in older)
                            const toolParts = m.parts.filter((p: any) => 
                                (typeof p.type === 'string' && p.type.startsWith('tool-')) ||
                                p.type === 'tool-invocation' || p.type === 'dynamic-tool'
                            );
                            const hasTools = toolParts.length > 0;

                            if (!textContent && !hasTools) return null;

                            return (
                                <div key={m.id} className="flex flex-col gap-1 w-full relative">
                                    {/* Render tool status badges */}
                                    {hasTools && toolParts.map((part: any, idx: number) => {
                                        const toolName = part.toolName || part.type?.replace('tool-', '') || 'tool';
                                        const state = part.state || 'unknown';
                                        const isDone = state === 'output-available' || state === 'result';
                                        return (
                                            <div key={part.toolCallId || `tool-${idx}`} className="flex items-center gap-2 text-xs text-muted-foreground ml-14 mb-1 opacity-70">
                                                <Loader className={cn("w-3 h-3 text-primary", !isDone && "animate-spin")} />
                                                <span className="italic uppercase tracking-wider font-mono text-[10px]">
                                                    {toolName} {isDone ? '✓' : '...'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {/* Render text content */}
                                    {textContent && (
                                        <MessageBubble
                                            id={m.id}
                                            role={m.role}
                                            content={textContent}
                                            createdAt={m.createdAt}
                                            siblingCount={siblingInfo[m.id]?.count || 1}
                                            currentSiblingIndex={siblingInfo[m.id]?.index || 0}
                                            onNavigateSibling={handleNavigateSibling}
                                            onBranchSubmit={handleBranchSubmit}
                                            attachments={m.experimental_attachments}
                                        />
                                    )}
                                    {/* Render tool results inline if model didn't narrate them */}
                                    {toolParts.filter((p: any) => p.state === 'output-available' && p.output).length > 0 && 
                                     !textContent?.length && (
                                        toolParts
                                            .filter((p: any) => p.state === 'output-available' && p.output)
                                            .map((p: any, i: number) => {
                                                const result = p.output;
                                                const items = result?.results || result?.data || (Array.isArray(result) ? result : null);
                                                if (!items || items.length === 0) return null;
                                                return (
                                                    <MessageBubble
                                                        key={p.toolCallId || `${m.id}-${i}`}
                                                        id={p.toolCallId || `${m.id}-${i}`}
                                                        role="assistant"
                                                        content={items.map((item: any, idx: number) =>
                                                            `**${idx + 1}.** ${item.name || (item.firstName ? `${item.firstName} ${item.lastName}` : '') || item.title || 'Item'} ${item.status ? `(${item.status})` : ''} ${item.totalLeads !== undefined ? `— ${item.totalLeads} leads` : ''}`
                                                        ).join('\n')}
                                                        createdAt={m.createdAt}
                                                    />
                                                );
                                            })
                                    )}
                                </div>
                            );
                        }
                        
                        // Legacy: plain content string (from DB-loaded messages)
                        const displayContent = m.content || '';
                        if (!displayContent) return null;
                        return (
                            <MessageBubble
                                key={m.id}
                                id={m.id}
                                role={m.role}
                                content={displayContent}
                                createdAt={m.createdAt}
                                siblingCount={siblingInfo[m.id]?.count || 1}
                                currentSiblingIndex={siblingInfo[m.id]?.index || 0}
                                onNavigateSibling={handleNavigateSibling}
                                onBranchSubmit={handleBranchSubmit}
                            />
                        );
                    })}

                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm pl-4 animate-pulse">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Varuni is thinking...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
                <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-32 md:bottom-24 right-4 md:right-8 rounded-full shadow-lg z-20"
                    onClick={() => scrollToBottom()}
                >
                    <ArrowDown className="w-4 h-4" />
                </Button>
            )}

            {/* Composer */}
            <div className="p-4 pb-20 md:pb-4 bg-gradient-to-t from-background via-background/95 to-transparent z-20">
                <div className="max-w-3xl mx-auto flex flex-col gap-2">
                    
                    {/* Attachment Staging Area */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-2 max-h-[150px] overflow-y-auto">
                            {attachments.map((att, i) => {
                                const publicUrl = att.url ? att.url.replace('https://basaltcrm.s3.us-west-or.io.cloud.ovh.us/', '/api/media/') : '';
                                return (
                                <div key={i} className="flex items-center gap-2 bg-muted/60 border border-border/50 text-xs rounded-xl pr-2 overflow-hidden shadow-sm">
                                    {att.contentType?.startsWith('image/') ? (
                                        <div className="h-10 w-10 shrink-0 bg-black/10 overflow-hidden relative border-r">
                                            <img src={publicUrl} alt={att.name} className="h-full w-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-primary/10 text-primary border-r">
                                            <FileIcon className="h-4 w-4" />
                                        </div>
                                    )}
                                    <span className="truncate max-w-[120px] font-medium py-1">{att.name}</span>
                                    <button 
                                        type="button" 
                                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors ml-auto"
                                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )})}
                        </div>
                    )}

                    <form onSubmit={onSubmit} className="relative flex items-end gap-1.5 p-1.5 bg-muted/40 border border-border/50 rounded-[28px] shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background transition-all">
                        <div className="flex pb-1 pl-1 shrink-0">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                className="hidden" 
                                accept="image/*,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.md" 
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className={cn("rounded-full h-10 w-10 text-muted-foreground hover:text-foreground transition-all", isUploading && "opacity-70 pointer-events-none")}
                                onClick={() => !isUploading && fileInputRef.current?.click()}
                                disabled={isLoading || status === 'streaming'}
                            >
                                {isUploading ? <Loader className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                            </Button>
                        </div>
                        <Textarea
                            className="min-h-[48px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 py-3.5 px-2 transition-all duration-200 text-[15px]"
                            placeholder="Message Varuni..."
                            value={localInput}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            style={{ overflowY: localInput.split('\n').length > 5 ? 'auto' : 'hidden' }}
                        />
                        <div className="flex pb-1 pr-1 shrink-0">
                            {isLoading || status === 'streaming' || status === 'submitted' ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="rounded-full h-10 w-10 shadow-sm"
                                    onClick={() => stop()}
                                >
                                    <Square className="w-4 h-4 fill-current" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="rounded-full h-10 w-10 shadow-sm transition-all"
                                    disabled={(!localInput.trim() && attachments.length === 0) || isUploading}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </form>
                    <div className="text-center pb-0.5 text-xs px-4">
                        <p className="text-[10px] text-muted-foreground">
                            AI can make mistakes. Please review generated code and advice.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
