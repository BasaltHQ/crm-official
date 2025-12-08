"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { Loader, Pencil, Send, Square, RefreshCw } from "lucide-react";

type ChatMessage = {
    id: string;
    session: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
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
}

export default function ChatBoard({ sessionId, initialMessages, isTemporary, onRefresh }: ChatBoardProps) {
    // Local input for stability
    const [localInput, setLocalInput] = useState("");
    const [editParentId, setEditParentId] = useState<string | undefined>(undefined);

    // Use standard /api/chat endpoint
    const apiEndpoint = "/api/chat";

    // Initialize useChat
    // @ts-ignore - The SDK types might be outdated or strict, but 'api' is the standard property
    const chatHelpers = useChat({
        id: sessionId,
        api: apiEndpoint,
        initialMessages: initialMessages as any[],
        // Pass sessionId in the body so the API knows which session to update
        body: { sessionId, parentId: editParentId },
        onError: (err: unknown) => {
            console.error("[CHAT_STREAM_ERROR]", err);
            toast.error(`Streaming error: ${(err as Error).message || "Unknown error"}`);
        },
        onFinish: () => {
            // console.log("[useChat] onFinish triggered");
            setEditParentId(undefined);
            onRefresh();
        }
    });

    // Extract available methods based on logs
    const {
        messages,
        sendMessage, // Replaces append
        regenerate,  // Replaces reload
        isLoading,
        stop,
        setMessages,
        error
    } = chatHelpers as any;

    // Safe Sync
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
            setMessages(initialMessages as any[]);
        }
    }, [initialMessages, messages.length, setMessages]);

    // ... (token calc)

    // ... (auto scroll)

    // ... (manual append fallback remains useful but less likely needed if sendMessage works)

    // Robust submit removed from here (it was duplicate)

    // Safe Sync: Only sync from initialMessages if local state is empty.
    // ...
    // ...

    // Calculate tokens
    const usedTokens = useMemo(() => {
        const messageTokens = (messages || []).reduce((sum: number, m: any) => sum + estimateTokens(m.content), 0);
        const inputTokens = estimateTokens(localInput);
        return messageTokens + inputTokens;
    }, [messages, localInput]);

    const percentUsed = Math.min(100, Math.round((usedTokens / MAX_TOKENS) * 100));

    // Auto-scroll
    const listRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Manual Append Fallback
    async function manualAppend(message: { role: "user"; content: string }) {
        // console.log("[ChatBoard] Triggering manual append");
        const optimisticUserMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: message.content,
            createdAt: new Date().toISOString(),
            session: sessionId
        } as ChatMessage;

        // Optimistically add user message
        if (setMessages) {
            setMessages([...messages, optimisticUserMessage]);
        }

        try {
            const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, optimisticUserMessage], // Send full history including new message
                    sessionId, // Pass sessionId here as well
                    parentId: editParentId
                })
            });

            if (!response.ok || !response.body) {
                const text = await response.text().catch(() => "No body");
                console.error("[ManualAppend] Response Error:", { status: response.status, text });
                throw new Error(`Failed to fetch chat response: ${response.status} ${text}`);
            }

            // We need to handle the stream manually if useChat is broken
            // But realistically if useChat is this broken, we might need a full manual implementation.
            // For now, let's see if reload() exists and can be used, or if we can just trigger a refresh.
            if (response.ok && regenerate) {
                 // Use regenerate instead of reload
                toast.success("Message sent (Manual).");
                onRefresh(); // Brute force refresh for now
            } else {
                // Try to read stream?
                toast.success("Message sent, refresh to see reply.");
                setTimeout(onRefresh, 1000);
            }

        } catch (err) {
            console.error("[ManualAppend] Error:", err);
            toast.error("Failed to send manually.");
        }
    }

    // Robust submit
    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const content = localInput.trim();
        if (!content) return;

        setLocalInput(""); // Clear immediately
        setEditParentId(undefined);

        try {
            if (sendMessage) {
                // Explicitly pass body again to be safe
                await sendMessage(
                    { role: "user", content },
                    { body: { sessionId, parentId: editParentId } }
                );
            } else {
                console.warn("sendMessage missing, using manual fallback.");
                await manualAppend({ role: "user", content });
            }
        } catch (err) {
            toast.error("Failed to send message.");
            console.error(err);
        }
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header (Context & Refresh) */}
            <div className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border p-3 flex items-center justify-end gap-4">
                {/* Context window tracker */}
                <div className="w-40 sm:w-64">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs mb-1">
                        <span className="text-muted-foreground">Context</span>
                        <span className="font-medium">
                            {usedTokens.toLocaleString()} / {MAX_TOKENS.toLocaleString()} ({percentUsed}%)
                        </span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                        <div
                            className={`h-2 rounded transition-all ${percentUsed >= 90 ? "bg-red-500" : percentUsed >= 75 ? "bg-yellow-500" : "bg-blue-600"
                                }`}
                            style={{ width: `${Math.min(100, percentUsed)}%` }}
                        />
                    </div>
                </div>

                {/* Refresh messages */}
                <button
                    className="p-2 rounded hover:bg-muted"
                    onClick={onRefresh}
                    title="Refresh messages"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Messages list */}
            <div ref={listRef} className="flex-1 p-4 space-y-4 overflow-auto">
                {messages.length === 0 && (
                    <div className="text-sm text-gray-500">No messages yet. Start the conversation!</div>
                )}
                {messages.map((m: any) => (
                    <div
                        key={m.id}
                        className={`rounded-xl p-3 ${m.role === "user"
                            ? "border bg-primary/10 border-primary/40 backdrop-blur-md shadow"
                            : "glass"
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs px-2 py-1 rounded bg-muted">
                                {m.role.toUpperCase()}
                            </span>
                            {m.role === "user" && !isTemporary && (
                                <button
                                    className="text-xs p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1"
                                    onClick={() => {
                                        setEditParentId(m.id);
                                        setLocalInput(m.content);
                                        toast.info("Editing previous message; this will create a branch.");
                                    }}
                                >
                                    <Pencil className="w-3 h-3" />
                                    Edit & Branch
                                </button>
                            )}
                        </div>

                        <div className="mt-2 whitespace-pre-wrap text-sm">
                            {m.content}
                            {m.role === 'assistant' && isLoading && m.id === messages[messages.length - 1]?.id && (
                                <span className="ml-2 animate-pulse">...</span>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="text-primary text-xs flex items-center gap-2">
                        <Loader className="w-3 h-3 animate-spin" /> Thinking...
                    </div>
                )}
            </div>

            {/* Composer */}
            <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-border p-3 bg-card/80 backdrop-blur">
                <div className="glass rounded-xl p-2 sm:p-3 flex items-center gap-2">
                    <textarea
                        className="flex-1 rounded-xl border border-input bg-background/60 text-foreground placeholder-muted-foreground p-3 resize-none min-h-[56px] max-h-[160px] shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={localInput}
                        onChange={(e) => setLocalInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const form = e.currentTarget.closest("form");
                                if (form) form.requestSubmit();
                            }
                        }}
                        placeholder="Type your message..."
                    />
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Stop streaming"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground hover:brightness-90 shadow-sm transition-colors"
                            onClick={() => stop()}
                            disabled={!isLoading}
                        >
                            <Square className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            aria-label="Send message"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary hover:brightness-90 text-primary-foreground disabled:opacity-50 shadow-sm transition-colors"
                            disabled={isLoading || localInput.trim().length === 0}
                        >
                            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                {editParentId && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Branching from message id: {editParentId}
                        <button
                            type="button"
                            className="ml-2 px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700"
                            onClick={() => setEditParentId(undefined)}
                        >
                            Clear
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
