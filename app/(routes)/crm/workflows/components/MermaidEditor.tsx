"use client";

import React, { useEffect, useState, useRef } from "react";
import { MermaidDiagram, parseMarkdownToPages } from "../../university/_components/MermaidDiagram";
import type { DiagramPage } from "../../university/_components/MermaidDiagram";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Code,
    Play,
    RefreshCw,
    Save,
    Share2,
    Mail,
    Copy,
    Check,
    Loader2,
    FolderOpen,
    Trash2,
    Link,
    Download,
    MoreVertical,
    Sparkles,
    FileText,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import DOMPurify from "isomorphic-dompurify";

// ─── Saved Diagram Type ─────────────────────────────
type SavedDiagram = {
    id: string;
    name: string;
    code: string;
    pages?: DiagramPage[];
    createdAt: string;
    updatedAt: string;
};

const STORAGE_KEY = "basalt_mermaid_diagrams";

function getSavedDiagrams(): SavedDiagram[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

function persistDiagrams(diagrams: SavedDiagram[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams));
}

function formatSafeInlineMarkdown(raw: string): string {
    const escaped = raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    return DOMPurify.sanitize(
        escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/70">$1</strong>')
    );
}

// ─── Markdown Notes Renderer ────────────────────────
function renderFormattedNotes(notes: string) {
    if (!notes) return null;
    const lines = notes.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];

    const flushList = () => {
        if (currentList.length > 0) {
            elements.push(
                <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-2 text-xs text-muted-foreground/80">
                    {currentList.map((item, i) => (
                        <li key={i} className="leading-relaxed" dangerouslySetInnerHTML={{
                            __html: formatSafeInlineMarkdown(item)
                        }} />
                    ))}
                </ol>
            );
            currentList = [];
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Headings (### )
        if (trimmed.startsWith('### ')) {
            flushList();
            const headingText = trimmed.replace(/^###\s*/, '');
            elements.push(
                <h4 key={`h-${elements.length}`} className="text-xs font-bold text-white/60 mt-3 mb-1.5 flex items-center gap-1.5">
                    {headingText}
                </h4>
            );
            continue;
        }

        // Numbered list items (1. ...)
        const listMatch = trimmed.match(/^\d+\.\s+(.+)/);
        if (listMatch) {
            currentList.push(listMatch[1]);
            continue;
        }

        // Regular paragraphs
        flushList();
        elements.push(
            <p key={`p-${elements.length}`} className="text-xs text-muted-foreground/70 leading-relaxed" dangerouslySetInnerHTML={{
                __html: formatSafeInlineMarkdown(trimmed)
            }} />
        );
    }
    flushList();
    return <div className="space-y-1.5">{elements}</div>;
}

// ─── Component ──────────────────────────────────────
export function MermaidEditor() {
    const { toast } = useToast();

    const defaultChart = `%%{init: {'theme': 'dark', 'themeVariables': { 'fontSize': '13px', 'clusterBkg': 'rgba(15, 23, 42, 0.3)', 'clusterBorder': '#334155' }}}%%
graph TB
    A[New Lead Created] --> B{Is lead hot?}
    B -- Yes --> C[Assign to Sales Rep]
    B -- No --> D[Add to Nurture Campaign]
    C --> E[Send Welcome Email]
    D --> E
    
    style A fill:#1e3a5f,stroke:#3b82f6,stroke-width:2px,color:#e2e8f0
    style B fill:#831843,stroke:#ec4899,stroke-width:2px,color:#fce7f3
    style C fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#dcfce7
    style D fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#c7d2fe
    style E fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#e9d5ff
`;

    const [chartCode, setChartCode] = useState(defaultChart);
    const [activeChartCode, setActiveChartCode] = useState(defaultChart);
    const [diagramName, setDiagramName] = useState("Untitled Diagram");
    const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
    const [activePages, setActivePages] = useState<DiagramPage[]>([]);

    // Dialogs
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Email
    const [recipientEmail, setRecipientEmail] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Misc
    const [copied, setCopied] = useState(false);
    const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);
    const previewRef = useRef<HTMLDivElement>(null);
    const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

    useEffect(() => {
        setSavedDiagrams(getSavedDiagrams());
    }, []);

    // ─── Actions ─────────────────────────────────────
    const handleRun = () => {
        const pages = parseMarkdownToPages(chartCode);
        setActivePages(pages);
        // For single diagram (no markdown structure), use the raw code
        if (pages.length === 1 && !pages[0].title) {
            setActiveChartCode(pages[0].mermaidCode);
        } else {
            // Multi-page mode — activeChartCode not used, pages drive rendering
            setActiveChartCode(chartCode);
        }
        setExpandedNotes(new Set());
        // Auto-select all pages for save
        setSelectedPages(new Set(pages.map(p => p.pageNumber)));
    };

    const toggleNotes = (pageNum: number) => {
        setExpandedNotes(prev => {
            const next = new Set(prev);
            if (next.has(pageNum)) {
                next.delete(pageNum);
            } else {
                next.add(pageNum);
            }
            return next;
        });
    };

    const handleReset = () => {
        setChartCode(defaultChart);
        setActiveChartCode(defaultChart);
        setDiagramName("Untitled Diagram");
        setActiveDiagramId(null);
        setActivePages([]);
        setExpandedNotes(new Set());
        setSelectedPages(new Set());
    };

    // ── Save ────────────────────────────────────────
    const handleSave = () => {
        const now = new Date().toISOString();
        const diagrams = getSavedDiagrams();
        // Filter to only selected pages
        const pages = activePages.length > 0
            ? activePages.filter(p => selectedPages.has(p.pageNumber))
            : undefined;

        if (activeDiagramId) {
            // Update existing
            const idx = diagrams.findIndex((d) => d.id === activeDiagramId);
            if (idx !== -1) {
                diagrams[idx] = { ...diagrams[idx], name: diagramName, code: chartCode, pages, updatedAt: now };
                persistDiagrams(diagrams);
                setSavedDiagrams([...diagrams]);
                toast({ title: "Diagram updated", description: `"${diagramName}" saved with ${pages?.length || 1} page(s).` });
                setSaveDialogOpen(false);
                return;
            }
        }

        // Create new
        const newDiagram: SavedDiagram = {
            id: crypto.randomUUID(),
            name: diagramName,
            code: chartCode,
            pages,
            createdAt: now,
            updatedAt: now,
        };
        diagrams.unshift(newDiagram);
        persistDiagrams(diagrams);
        setSavedDiagrams([...diagrams]);
        setActiveDiagramId(newDiagram.id);
        toast({ title: "Diagram saved", description: `"${diagramName}" saved with ${pages?.length || 1} page(s).` });
        setSaveDialogOpen(false);
    };

    // ── Load ────────────────────────────────────────
    const handleLoad = (diagram: SavedDiagram) => {
        setChartCode(diagram.code);
        setActiveChartCode(diagram.code);
        setDiagramName(diagram.name);
        setActiveDiagramId(diagram.id);
        // Restore parsed pages if available
        if (diagram.pages && diagram.pages.length > 0) {
            setActivePages(diagram.pages);
        } else {
            setActivePages([]);
        }
        setExpandedNotes(new Set());
        setLoadDialogOpen(false);
        toast({ title: "Diagram loaded", description: `"${diagram.name}" loaded${diagram.pages ? ` (${diagram.pages.length} pages)` : ''}.` });
    };

    // ── Delete ──────────────────────────────────────
    const handleDeleteDiagram = (id: string) => {
        const diagrams = getSavedDiagrams().filter((d) => d.id !== id);
        persistDiagrams(diagrams);
        setSavedDiagrams([...diagrams]);
        if (activeDiagramId === id) setActiveDiagramId(null);
        toast({ title: "Diagram deleted" });
    };

    // ── Copy Code ───────────────────────────────────
    const handleCopyCode = async () => {
        await navigator.clipboard.writeText(chartCode);
        setCopied(true);
        toast({ title: "Copied!", description: "Mermaid code copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Copy Share Link ─────────────────────────────
    const [shareUrl, setShareUrl] = useState('');

    const generateShareUrl = () => {
        const encoded = encodeURIComponent(chartCode);
        const url = `${window.location.origin}/crm/workflows?view=editor&code=${encoded}`;
        setShareUrl(url);
        setShareDialogOpen(true);
    };

    const handleCopyRawLink = async () => {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied!", description: "Raw URL copied to clipboard." });
    };

    const handleCopyMarkdownLink = async () => {
        const mdLink = `[${diagramName} - FlowState](${shareUrl})`;
        await navigator.clipboard.writeText(mdLink);
        toast({ title: "Markdown link copied!", description: "Hyperlink text copied — paste in Slack, docs, or messages." });
    };

    const handleCopyHtmlLink = async () => {
        const htmlLink = `<a href="${shareUrl}">${diagramName} - FlowState</a>`;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([htmlLink], { type: 'text/html' }),
                    'text/plain': new Blob([shareUrl], { type: 'text/plain' }),
                }),
            ]);
        } catch {
            await navigator.clipboard.writeText(htmlLink);
        }
        toast({ title: "Rich link copied!", description: "Paste anywhere that supports rich text (email, Google Docs, etc)." });
    };

    // ── Download SVG ────────────────────────────────
    const handleDownloadSvg = () => {
        const svgEl = previewRef.current?.querySelector("svg");
        if (!svgEl) {
            toast({ variant: "destructive", title: "No diagram", description: "Build a diagram first." });
            return;
        }
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${diagramName.replace(/\s+/g, "_")}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded!", description: "SVG file saved." });
    };

    // ── Email ───────────────────────────────────────
    const handleSendEmail = async () => {
        if (!recipientEmail.trim()) {
            toast({ variant: "destructive", title: "Missing email", description: "Enter a recipient email." });
            return;
        }
        setIsSendingEmail(true);
        try {
            const res = await fetch("/api/crm/workflows/share-diagram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientEmail: recipientEmail.trim(),
                    diagramName,
                    diagramCode: chartCode,
                    senderName: "Your Team", // Will be replaced by session on backend
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            toast({ title: "Email sent!", description: `Diagram shared with ${recipientEmail}.` });
            setRecipientEmail("");
            setEmailDialogOpen(false);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Failed", description: err?.message || "Could not send email." });
        } finally {
            setIsSendingEmail(false);
        }
    };

    // ── Load from URL param ─────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
            try {
                const decoded = decodeURIComponent(code);
                setChartCode(decoded);
                setActiveChartCode(decoded);
                toast({ title: "Diagram loaded from link" });
            } catch { /* ignore */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Render ─────────────────────────────────────
    return (
        <>
            <div className="flex flex-col h-full space-y-4">
                {/* ── Toolbar ────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-background/50 backdrop-blur-sm"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <Input
                            value={diagramName}
                            onChange={(e) => setDiagramName(e.target.value)}
                            className="h-8 w-56 text-sm font-semibold bg-transparent border-white/10 focus-visible:ring-primary/30"
                            placeholder="Diagram name..."
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10" onClick={handleReset}>
                            <RefreshCw className="w-3 h-3" /> Reset
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10" onClick={() => setLoadDialogOpen(true)}>
                            <FolderOpen className="w-3 h-3" /> Open
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10" onClick={() => setSaveDialogOpen(true)}>
                            <Save className="w-3 h-3" /> Save
                        </Button>

                        <div className="w-px h-5 bg-white/10 mx-1" />

                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10" onClick={handleCopyCode}>
                            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied" : "Copy Code"}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10" onClick={handleDownloadSvg}>
                            <Download className="w-3 h-3" /> SVG
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10">
                                    <Share2 className="w-3 h-3" /> Share
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 border-white/10 bg-background/95 backdrop-blur-xl">
                                <DropdownMenuItem onClick={() => generateShareUrl()}>
                                    <Link className="mr-2 h-4 w-4" /> Copy Share Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
                                    <Mail className="mr-2 h-4 w-4" /> Send via Email
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleCopyCode}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Mermaid Code
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDownloadSvg}>
                                    <Download className="mr-2 h-4 w-4" /> Download SVG
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-5 bg-white/10 mx-1" />

                        <Button size="sm" className="h-8 text-xs font-semibold gap-1.5 shadow-lg shadow-primary/20" onClick={handleRun}>
                            <Play className="w-3 h-3" /> Build Diagram
                        </Button>
                    </div>
                </motion.div>

                {/* ── Editor + Preview Grid ───────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[500px]">
                    {/* Editor Column */}
                    <Card className="flex flex-col h-full border-white/10 bg-background/50 backdrop-blur-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                                <Code className="w-4 h-4 text-primary" />
                                Mermaid Editor
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Write your flowchart syntax here
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 px-4 pb-4">
                            <Textarea
                                value={chartCode}
                                onChange={(e) => setChartCode(e.target.value)}
                                className="w-full h-full min-h-[400px] font-mono text-xs bg-muted/20 border-white/5 resize-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40 p-4"
                                placeholder="graph TD..."
                                spellCheck={false}
                            />
                        </CardContent>
                    </Card>

                    {/* Preview Column */}
                    <Card className="flex flex-col h-full border-white/10 bg-background/50 backdrop-blur-sm overflow-hidden relative">
                        <CardHeader className="pb-3 border-b border-white/5 z-10 bg-background/50 backdrop-blur-sm">
                            <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                                <Play className="w-4 h-4 text-emerald-500" />
                                Live Preview
                                {activePages.length > 1 && (
                                    <span className="text-xs font-normal text-muted-foreground ml-2">
                                        {activePages.length} pages
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {activePages.length > 1
                                    ? "Scroll to view all pages with descriptions"
                                    : "Visual representation of your workflow"
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent
                            ref={previewRef}
                            className="flex-1 p-0 overflow-auto relative min-h-[400px] bg-grid-white/[0.02]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-0 pointer-events-none" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] z-0 pointer-events-none" />
                            <div className="relative z-10 w-full p-6">
                                {activePages.length > 1 ? (
                                    /* ── Multi-Page Mode ── */
                                    <div className="space-y-8">
                                        {activePages.map((page) => (
                                            <motion.div
                                                key={page.pageNumber}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: page.pageNumber * 0.05 }}
                                                className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
                                            >
                                                {/* Page Header */}
                                                <div className="px-5 pt-5 pb-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono font-bold text-primary/60 bg-primary/10 px-2 py-0.5 rounded-full">
                                                            PAGE {page.pageNumber}
                                                        </span>
                                                    </div>
                                                    {page.title && (
                                                        <h3 className="text-sm font-bold text-white/90 mt-2">
                                                            {page.title}
                                                        </h3>
                                                    )}
                                                    {page.description && (
                                                        <p className="text-xs text-muted-foreground/70 mt-1 italic">
                                                            {page.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Diagram */}
                                                <div className="px-3 pb-3">
                                                    <MermaidDiagram
                                                        chart={page.mermaidCode}
                                                        className="w-full"
                                                    />
                                                </div>

                                                {/* Notes Toggle */}
                                                {page.notes && (
                                                    <div className="border-t border-white/5">
                                                        <button
                                                            onClick={() => toggleNotes(page.pageNumber)}
                                                            className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:text-white/80 hover:bg-white/[0.02] transition-colors"
                                                        >
                                                            <span className="flex items-center gap-1.5 font-medium">
                                                                <FileText className="w-3 h-3" />
                                                                Notes & Logic Breakdown
                                                            </span>
                                                            {expandedNotes.has(page.pageNumber)
                                                                ? <ChevronUp className="w-3 h-3" />
                                                                : <ChevronDown className="w-3 h-3" />
                                                            }
                                                        </button>
                                                        <AnimatePresence>
                                                            {expandedNotes.has(page.pageNumber) && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: "auto", opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="px-5 pb-4">
                                                                        {renderFormattedNotes(page.notes)}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : (
                                    /* ── Single Diagram Mode ── */
                                    <MermaidDiagram
                                        chart={activeChartCode}
                                        className="w-full"
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ═══════════ DIALOGS ═══════════ */}

            {/* ── Save Dialog ────────────────── */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="sm:max-w-2xl border-white/10 glass">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                            <Save className="w-5 h-5 text-primary" /> Save Diagram
                        </DialogTitle>
                        <DialogDescription>
                            {activePages.length > 1
                                ? `Select which pages to save (${selectedPages.size} of ${activePages.length} selected).`
                                : "Save this diagram locally for quick access later."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diagram Name</label>
                            <Input
                                value={diagramName}
                                onChange={(e) => setDiagramName(e.target.value)}
                                placeholder="e.g., GTM Master Playbook"
                                className="bg-muted/20 border-white/10"
                            />
                        </div>
                        {/* Page selection */}
                        {activePages.length > 1 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pages to Save</label>
                                    <button
                                        onClick={() => {
                                            if (selectedPages.size === activePages.length) {
                                                setSelectedPages(new Set());
                                            } else {
                                                setSelectedPages(new Set(activePages.map(p => p.pageNumber)));
                                            }
                                        }}
                                        className="text-[10px] font-mono font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                                    >
                                        {selectedPages.size === activePages.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                    {activePages.map((page) => {
                                        const isSelected = selectedPages.has(page.pageNumber);
                                        return (
                                            <label
                                                key={page.pageNumber}
                                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                                                    ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10'
                                                    : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-80'
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedPages(prev => {
                                                            const next = new Set(prev);
                                                            if (checked) {
                                                                next.add(page.pageNumber);
                                                            } else {
                                                                next.delete(page.pageNumber);
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono font-bold text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">
                                                            {page.pageNumber}
                                                        </span>
                                                        <p className="text-xs font-semibold text-white/80 truncate">{page.title || 'Untitled'}</p>
                                                    </div>
                                                    {page.description && (
                                                        <p className="text-[11px] text-muted-foreground/50 truncate mt-1 italic">{page.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                                                            <Code className="w-2.5 h-2.5" /> Diagram
                                                        </span>
                                                        {page.notes && (
                                                            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                                                                <FileText className="w-2.5 h-2.5" /> Notes
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="border-white/10">Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={activePages.length > 1 && selectedPages.size === 0}
                            className="shadow-lg shadow-primary/20 gap-1.5"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {activePages.length > 1 ? `Save ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}` : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Load / Open Dialog ─────────── */}
            <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogContent className="sm:max-w-lg border-white/10 glass">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                            <FolderOpen className="w-5 h-5 text-primary" /> Saved Diagrams
                        </DialogTitle>
                        <DialogDescription>
                            Select a previously saved diagram to load it into the editor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[350px] overflow-y-auto space-y-2 py-2 custom-scrollbar pr-1">
                        {savedDiagrams.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground/60">
                                <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">No saved diagrams yet</p>
                                <p className="text-xs mt-1">Save your first diagram to see it here.</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {savedDiagrams.map((d) => (
                                    <motion.div
                                        key={d.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-background hover:border-primary/20 hover:bg-primary/[0.02] cursor-pointer transition-colors group"
                                        onClick={() => handleLoad(d)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{d.name}</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                                Updated {new Date(d.updatedAt).toLocaleDateString()} • {d.pages ? `${d.pages.length} pages` : `${d.code.split("\n").length} lines`}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-[color,background-color,border-color,opacity] shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteDiagram(d.id);
                                            }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Share Link Dialog ──────────── */}
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogContent className="sm:max-w-lg border-white/10 glass">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                            <Link className="w-5 h-5 text-primary" /> Share Diagram
                        </DialogTitle>
                        <DialogDescription>
                            Share this diagram as a clean hyperlink. Anyone with the link can view and edit it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-4">
                        {/* Preview */}
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                            <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider mb-2">Preview</p>
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-primary hover:underline"
                            >
                                {diagramName || 'Untitled Diagram'} — FlowState
                            </a>
                            <p className="text-[10px] text-muted-foreground/30 mt-1.5 font-mono truncate">{shareUrl.substring(0, 80)}...</p>
                        </div>

                        {/* Copy options */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">Copy as</p>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyHtmlLink}
                                    className="border-white/10 h-auto py-2.5 flex flex-col items-center gap-1"
                                >
                                    <Link className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[10px]">Rich Link</span>
                                    <span className="text-[9px] text-muted-foreground/40">Email, Docs</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyMarkdownLink}
                                    className="border-white/10 h-auto py-2.5 flex flex-col items-center gap-1"
                                >
                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[10px]">Markdown</span>
                                    <span className="text-[9px] text-muted-foreground/40">Slack, GitHub</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyRawLink}
                                    className="border-white/10 h-auto py-2.5 flex flex-col items-center gap-1"
                                >
                                    <Copy className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[10px]">Raw URL</span>
                                    <span className="text-[9px] text-muted-foreground/40">Browser</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShareDialogOpen(false)} className="border-white/10">Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Email Dialog ──────────────── */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="sm:max-w-md border-white/10 glass">
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">
                            <Mail className="w-5 h-5 text-primary" /> Email Diagram
                        </DialogTitle>
                        <DialogDescription>
                            Send the Mermaid code to a colleague so they can view it in their own editor.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient Email</label>
                            <Input
                                type="email"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className="bg-muted/20 border-white/10"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diagram Name</label>
                            <Input
                                value={diagramName}
                                onChange={(e) => setDiagramName(e.target.value)}
                                placeholder="e.g., Lead Qualification Flow"
                                className="bg-muted/20 border-white/10"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)} className="border-white/10">Cancel</Button>
                        <Button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail}
                            className="shadow-lg shadow-primary/20 gap-1.5"
                        >
                            {isSendingEmail ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                            ) : (
                                <><Mail className="w-3.5 h-3.5" /> Send Email</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
