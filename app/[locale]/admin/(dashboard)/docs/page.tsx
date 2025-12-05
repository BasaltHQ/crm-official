"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash, Edit, Save, Video } from "lucide-react";
import { MarkdownEditor } from "../_components/MarkdownEditor";

interface DocArticle {
    id: string;
    title: string;
    slug: string;
    category: string;
    content: string;
    videoUrl: string;
    order: number;
}

export default function DocsAdminPage() {
    const [docs, setDocs] = useState<DocArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingDoc, setEditingDoc] = useState<Partial<DocArticle> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchDocs();
    }, []);

    const fetchDocs = async () => {
        try {
            const res = await fetch("/api/docs");
            const data = await res.json();
            setDocs(data);
        } catch (error) {
            toast.error("Failed to fetch docs");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingDoc?.title || !editingDoc?.slug) {
            toast.error("Title and Slug are required");
            return;
        }

        try {
            setSaving(true);
            const method = editingDoc.id ? "PUT" : "POST";
            const res = await fetch("/api/docs", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingDoc),
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success("Article saved successfully");
            setEditingDoc(null);
            fetchDocs();
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this article?")) return;

        try {
            const res = await fetch(`/api/docs?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Article deleted");
            fetchDocs();
        } catch (error) {
            toast.error("Failed to delete article");
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    if (editingDoc) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{editingDoc.id ? "Edit Article" : "New Article"}</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingDoc(null)} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingDoc.title || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Slug</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingDoc.slug || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, slug: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingDoc.category || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Order</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded bg-background"
                            value={editingDoc.order || 0}
                            onChange={(e) => setEditingDoc({ ...editingDoc, order: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Video className="h-4 w-4" /> Video URL (YouTube/Vimeo)
                        </label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={editingDoc.videoUrl || ""}
                            onChange={(e) => setEditingDoc({ ...editingDoc, videoUrl: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Content (Markdown)</label>
                    <MarkdownEditor
                        value={editingDoc.content || ""}
                        onChange={(val) => setEditingDoc({ ...editingDoc, content: val })}
                        className="min-h-[400px]"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Documentation Management</h1>
                <button
                    onClick={() => setEditingDoc({ order: 0 })}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> New Article
                </button>
            </div>

            <div className="space-y-6">
                {/* Group by category */}
                {Object.entries(docs.reduce((acc, doc) => {
                    (acc[doc.category] = acc[doc.category] || []).push(doc);
                    return acc;
                }, {} as Record<string, DocArticle[]>)).map(([category, categoryDocs]) => (
                    <div key={category} className="space-y-3">
                        <h2 className="text-xl font-semibold border-b pb-2">{category}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categoryDocs.map((doc) => (
                                <div key={doc.id} className="bg-white dark:bg-slate-950 border rounded-lg p-4 flex justify-between items-center hover:border-blue-500 transition-colors">
                                    <div>
                                        <h3 className="font-medium">{doc.title}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>/{doc.slug}</span>
                                            {doc.videoUrl && <span className="flex items-center gap-1 text-blue-500"><Video className="h-3 w-3" /> Video</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingDoc(doc)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                                            <Edit className="h-4 w-4 text-gray-500" />
                                        </button>
                                        <button onClick={() => handleDelete(doc.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                                            <Trash className="h-4 w-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
