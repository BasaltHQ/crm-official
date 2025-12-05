"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash, Edit, Save, X, Sparkles } from "lucide-react";
import { MarkdownEditor } from "../_components/MarkdownEditor";
import { generateBlogPost } from "@/actions/cms/generate-blog-post";

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    category: string;
    coverImage: string;
    publishedAt: string;
}

export default function BlogAdminPage() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
    const [saving, setSaving] = useState(false);

    // AI Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [aiTopic, setAiTopic] = useState("");

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await fetch("/api/blog");
            const data = await res.json();
            setPosts(data);
        } catch (error) {
            toast.error("Failed to fetch posts");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingPost?.title || !editingPost?.slug) {
            toast.error("Title and Slug are required");
            return;
        }

        try {
            setSaving(true);
            const method = editingPost.id ? "PUT" : "POST";
            const res = await fetch("/api/blog", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingPost),
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success("Post saved successfully");
            setEditingPost(null);
            fetchPosts();
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this post?")) return;

        try {
            const res = await fetch(`/api/blog?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Post deleted");
            fetchPosts();
        } catch (error) {
            toast.error("Failed to delete post");
        }
    };

    const handleAiGenerate = async () => {
        if (!aiTopic.trim()) {
            toast.error("Please enter a topic");
            return;
        }

        try {
            setIsGenerating(true);
            const generatedData = await generateBlogPost(aiTopic);

            setEditingPost(prev => ({
                ...prev,
                title: generatedData.title,
                slug: generatedData.slug,
                excerpt: generatedData.excerpt,
                category: generatedData.category,
                content: generatedData.content,
            }));

            toast.success("Blog post generated successfully!");
            setShowAiPrompt(false);
            setAiTopic("");
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate blog post. Please check your Azure OpenAI configuration.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    if (editingPost) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-6 relative">
                {/* AI Prompt Modal */}
                {showAiPrompt && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                        <div className="bg-[#0F0F1A] border border-blue-500/20 p-8 rounded-2xl w-full max-w-lg shadow-2xl shadow-blue-500/10 relative overflow-hidden">
                            {/* Background Glow */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

                            {/* Content */}
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-2 flex items-center gap-3 text-white">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Sparkles className="h-5 w-5 text-blue-400" />
                                    </div>
                                    AI Content Generator
                                </h3>
                                <p className="text-slate-400 mb-6 leading-relaxed">
                                    Transform your ideas into a complete blog post. Enter a topic below and let our AI handle the writing, formatting, and SEO.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Topic or Concept</label>
                                        <input
                                            autoFocus
                                            className="w-full p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
                                            placeholder="e.g. The impact of AI agents on modern sales workflows..."
                                            value={aiTopic}
                                            onChange={(e) => setAiTopic(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <button
                                            onClick={() => setShowAiPrompt(false)}
                                            className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAiGenerate}
                                            disabled={isGenerating}
                                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    Generate Post
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{editingPost.id ? "Edit Post" : "New Post"}</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAiPrompt(true)}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2 mr-2"
                        >
                            <Sparkles className="h-4 w-4" /> Generate with AI
                        </button>
                        <button onClick={() => setEditingPost(null)} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
                        </button>
                    </div>
                </div>

                {!editingPost.title && !editingPost.content && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-blue-500" />
                                Draft with AI
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Generate a complete blog post from a simple topic or idea.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAiPrompt(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
                        >
                            Generate Draft
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingPost.title || ""}
                            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Slug</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingPost.slug || ""}
                            onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingPost.category || ""}
                            onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Cover Image URL</label>
                        <input
                            className="w-full p-2 border rounded bg-background"
                            value={editingPost.coverImage || ""}
                            onChange={(e) => setEditingPost({ ...editingPost, coverImage: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Excerpt</label>
                    <textarea
                        className="w-full p-2 border rounded bg-background h-20"
                        value={editingPost.excerpt || ""}
                        onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Content (Markdown)</label>
                    <MarkdownEditor
                        value={editingPost.content || ""}
                        onChange={(val) => setEditingPost({ ...editingPost, content: val })}
                        className="min-h-[400px]"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Blog Management</h1>
                <button
                    onClick={() => setEditingPost({})}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> New Post
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <div key={post.id} className="bg-white dark:bg-slate-950 border rounded-lg p-6 space-y-4 hover:border-blue-500 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded-full">
                                    {post.category || "Uncategorized"}
                                </span>
                                <h3 className="text-xl font-bold mt-2 line-clamp-2">{post.title}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingPost(post)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                                    <Edit className="h-4 w-4 text-gray-500" />
                                </button>
                                <button onClick={() => handleDelete(post.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                                    <Trash className="h-4 w-4 text-red-500" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3">{post.excerpt}</p>
                        <div className="text-xs text-gray-400">
                            {new Date(post.publishedAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
