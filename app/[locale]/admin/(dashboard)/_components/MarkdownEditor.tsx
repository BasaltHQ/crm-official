"use client";

import { useState } from "react";
import {
    Bold, Italic, List, ListOrdered, Link as LinkIcon,
    Heading1, Heading2, Quote, Code, Eye, Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function MarkdownEditor({ value, onChange, className }: MarkdownEditorProps) {
    const [isPreview, setIsPreview] = useState(false);

    const insertText = (before: string, after: string = "") => {
        const textarea = document.getElementById("markdown-editor") as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

        onChange(newText);

        // Restore selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    return (
        <div className={cn("border rounded-md overflow-hidden bg-white dark:bg-slate-950", className)}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-gray-50 dark:bg-slate-900 overflow-x-auto">
                <ToolbarButton onClick={() => setIsPreview(false)} active={!isPreview} icon={<Edit2 className="h-4 w-4" />} title="Edit" />
                <ToolbarButton onClick={() => setIsPreview(true)} active={isPreview} icon={<Eye className="h-4 w-4" />} title="Preview" />
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2" />

                <ToolbarButton onClick={() => insertText("**", "**")} icon={<Bold className="h-4 w-4" />} title="Bold" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("*", "*")} icon={<Italic className="h-4 w-4" />} title="Italic" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("# ")} icon={<Heading1 className="h-4 w-4" />} title="Heading 1" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("## ")} icon={<Heading2 className="h-4 w-4" />} title="Heading 2" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("> ")} icon={<Quote className="h-4 w-4" />} title="Quote" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("```\n", "\n```")} icon={<Code className="h-4 w-4" />} title="Code Block" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("[", "](url)")} icon={<LinkIcon className="h-4 w-4" />} title="Link" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("- ")} icon={<List className="h-4 w-4" />} title="Bullet List" disabled={isPreview} />
                <ToolbarButton onClick={() => insertText("1. ")} icon={<ListOrdered className="h-4 w-4" />} title="Ordered List" disabled={isPreview} />
            </div>

            {/* Editor / Preview */}
            <div className="min-h-[300px]">
                {isPreview ? (
                    <div className="p-4 prose dark:prose-invert max-w-none">
                        <BasicMarkdownPreview content={value} />
                    </div>
                ) : (
                    <textarea
                        id="markdown-editor"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-full min-h-[300px] p-4 bg-transparent resize-y focus:outline-none font-mono text-sm"
                        placeholder="Write some markdown..."
                    />
                )}
            </div>
        </div>
    );
}

function ToolbarButton({ onClick, icon, title, active, disabled }: any) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors",
                active && "bg-gray-200 dark:bg-slate-800 text-primary",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {icon}
        </button>
    );
}

function BasicMarkdownPreview({ content }: { content: string }) {
    // Very basic regex-based markdown parser for preview
    // In a real app, use react-markdown
    const lines = content.split('\n');
    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold">{line.substring(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold">{line.substring(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold">{line.substring(4)}</h3>;
                if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-gray-300 pl-4 italic">{line.substring(2)}</blockquote>;
                if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{line.substring(2)}</li>;
                if (line.startsWith('1. ')) return <li key={i} className="ml-4 list-decimal">{line.substring(3)}</li>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i}>{line}</p>;
            })}
        </div>
    );
}
