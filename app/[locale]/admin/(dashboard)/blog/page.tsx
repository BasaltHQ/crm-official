"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash, Edit, Save, X } from "lucide-react";
import { MarkdownEditor } from "../_components/MarkdownEditor";

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

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    if (editingPost) {
        return (
            <div className="p-8 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{editingPost.id ? "Edit Post" : "New Post"}</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingPost(null)} className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
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
