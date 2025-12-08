"use client";

import React, { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, RefreshCw, Menu } from "lucide-react";
import ChatBoard from "./ChatBoard";

type ChatSession = {
  id: string;
  user: string;
  title?: string | null;
  isTemporary: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

type ChatMessage = {
  id: string;
  session: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export default function ChatApp() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingTitle, setCreatingTitle] = useState<string>("");
  const [creatingTemporary, setCreatingTemporary] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadSessions() {
    try {
      setLoadingSessions(true);
      const res = await fetch("/api/chat/sessions", { method: "GET" });
      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.status}`);
      }
      const json = await res.json();
      const list: ChatSession[] = json.sessions ?? [];
      setSessions(list);

      // Initialize active session if none selected
      if (!activeSessionId && list.length > 0) {
        setActiveSessionId(list[0].id);
      }
    } catch (e) {
      console.error("[LOAD_SESSIONS]", e);
      toast.error("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }

  async function createSession() {
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: creatingTitle || "New Chat", isTemporary: creatingTemporary }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create session: ${res.status}`);
      }
      const json = await res.json();
      const created: ChatSession = json.session;
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setCreatingTitle("");
      setCreatingTemporary(false);
      toast.success("Session created");
      // New session has no messages
      setMessages([]);
    } catch (e) {
      console.error("[CREATE_SESSION]", e);
      toast.error("Failed to create session");
    }
  }

  async function loadMessages(sessionId: string | null) {
    if (!sessionId) return;
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, { method: "GET" });
      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }
      const json = await res.json();
      const list: ChatMessage[] = json.messages ?? [];
      setMessages(list);
    } catch (e) {
      console.error("[LOAD_MESSAGES]", e);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        let errorMessage = `Failed to delete session: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          const errorText = await res.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      toast.success("Session deleted");
    } catch (e: any) {
      console.error("[DELETE_SESSION]", e);
      toast.error(e.message || "Failed to delete session");
    }
  }

  async function renameSession(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameTitle }),
      });
      if (!res.ok) {
        throw new Error(`Failed to rename session: ${res.status}`);
      }
      const json = await res.json();
      const updated: ChatSession = json.session;
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setRenamingSessionId(null);
      setRenameTitle("");
      toast.success("Session renamed");
    } catch (e) {
      console.error("[RENAME_SESSION]", e);
      toast.error("Failed to rename session");
    }
  }

  async function toggleTemporary(sessionId: string, isTemporary: boolean) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTemporary }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update session: ${res.status}`);
      }
      const json = await res.json();
      const updated: ChatSession = json.session;
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(updated.isTemporary ? "Session set to temporary" : "Session set to persistent");
    } catch (e) {
      console.error("[TOGGLE_TEMPORARY]", e);
      toast.error("Failed to update session");
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="relative flex w-full h-full min-h-0 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed z-50 inset-y-0 left-0 w-72 glass p-3 flex flex-col gap-3 h-full overflow-hidden transform transition-transform duration-200 sm:static sm:z-auto sm:inset-auto sm:w-80 sm:transform-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <button
            title="Refresh sessions"
            className="p-2 rounded hover:bg-muted"
            onClick={() => loadSessions()}
          >
            <RefreshCw className={`w-4 h-4 ${loadingSessions ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Create session */}
        <div className="space-y-2 rounded p-2 glass">
          <input
            className="w-full border border-input rounded p-2 bg-transparent"
            value={creatingTitle}
            onChange={(e) => setCreatingTitle(e.target.value)}
            placeholder="New session title"
          />
          <label
            htmlFor="temp-session"
            className="flex items-center gap-2 text-[11px] whitespace-nowrap text-gray-600 dark:text-gray-400"
          >
            <Switch.Root
              id="temp-session"
              className="inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full bg-gray-300 dark:bg-gray-700 data-[state=checked]:bg-blue-600 transition-colors"
              checked={creatingTemporary}
              onCheckedChange={(checked) => setCreatingTemporary(!!checked)}
              aria-label="Temporary session (do not save messages)"
            >
              <Switch.Thumb className="block h-3 w-3 rounded-full bg-white shadow translate-x-0.5 transition-transform data-[state=checked]:translate-x-4" />
            </Switch.Root>
            Temporary session (do not save messages)
          </label>
          <button
            className="w-full flex items-center justify-center gap-2 bg-primary hover:brightness-90 text-primary-foreground rounded p-2"
            onClick={createSession}
            disabled={loadingSessions}
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`p-2 rounded mb-2 cursor-pointer ${s.id === activeSessionId ? "bg-accent/20 border border-accent" : "hover:bg-muted"
                }`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {renamingSessionId === s.id ? (
                      <>
                        <input
                          className="w-full border border-gray-300 dark:border-gray-700 rounded p-1 bg-transparent text-sm"
                          value={renameTitle}
                          onChange={(e) => setRenameTitle(e.target.value)}
                          placeholder={s.title || "Untitled"}
                        // autoFocus
                        />
                        <button
                          className="p-1 rounded bg-green-600 hover:bg-green-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            renameSession(s.id);
                          }}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-black dark:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSessionId(null);
                            setRenameTitle("");
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium">{s.title || "Untitled"}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {s.isTemporary ? "Temporary" : "Persistent"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    title="Rename"
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingSessionId(s.id);
                      setRenameTitle(s.title || "");
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    title={s.isTemporary ? "Make persistent" : "Make temporary"}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTemporary(s.id, !s.isTemporary);
                    }}
                  >
                    {s.isTemporary ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    title="Delete"
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-sm text-gray-500">No sessions yet. Create one above.</div>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="sm:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setSidebarOpen(true)}
              title="Open sessions"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">Varuni</h2>
            {activeSession && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700">
                {activeSession.title || "Untitled"} {activeSession.isTemporary ? "(Temporary)" : "(Persistent)"}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {/* Content */}
        {activeSessionId ? (
          <div className="relative flex-1 flex flex-col min-h-0">
            <ChatBoard
              key={activeSessionId}
              sessionId={activeSessionId}
              initialMessages={messages as any[]}
              isTemporary={activeSession?.isTemporary || false}
              onRefresh={() => loadMessages(activeSessionId)}
            />
            {loadingMessages && messages.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="animate-pulse">Loading conversation...</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
            <div className="text-center">
              <p>Select a session to start chatting.</p>
              <p className="text-sm">Or create a new one.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
