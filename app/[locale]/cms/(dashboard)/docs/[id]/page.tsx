"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Loader2, Trash, Save, ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { Sparkles } from "lucide-react";

export default function DocEditorPage({ params }: { params: { id: string, locale: string } }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        title: "",
        slug: "",
        category: "",
        order: 0,
        videoUrl: "",
        content: "",
    });

    useEffect(() => {
        const init = async () => {
            try {
                // Fetch categories
                const response = await axios.get('/api/docs/categories');
                setExistingCategories(response.data);

                if (params.id !== "new") {
                    const docResponse = await axios.get(`/api/docs/${params.id}`);
                    setFormData(docResponse.data);
                }
            } catch (error) {
                console.error(error);
                if (params.id !== "new") toast.error("Failed to fetch article");
            } finally {
                setFetching(false);
            }
        };

        init();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (params.id === "new") {
                await axios.post("/api/docs", formData);
                toast.success("Created successfully");
            } else {
                await axios.patch(`/api/docs/${params.id}`, formData);
                toast.success("Saved changes");
            }
            router.refresh(); // Refresh so sidebar updates if title/category changed
            // params.locale might not be available in client component props automatically without layout passing it, 
            // but we can infer it or just use simple router push which handles relative paths?? 
            // Better to use window.location or just assumption. For now assume push handled by relative if not starting with /
            // Actually router.push('/' + params.locale + '/cms/docs') if we had it.
            // Let's use window.location.pathname split to get locale if needed, OR just hard refresh.
            // Simplest: router.push(window.location.pathname.split('/').slice(0, 3).join('/') + '/docs');
            router.refresh();
            if (params.id === "new") {
                const newPath = window.location.pathname.replace('/new', '');
                router.push(newPath);
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure?")) return;
        setLoading(true);
        try {
            await axios.delete(`/api/docs/${params.id}`);
            toast.success("Deleted");
            router.push("/cms/docs");
            router.refresh();
        } catch (error) {
            toast.error("Failed to delete");
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
            {/* Toolbar Header */}
            <div className="h-16 border-b px-6 flex items-center justify-between bg-card/50 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        className="text-lg font-bold bg-transparent border-none shadow-none focus-visible:ring-0 px-0 h-auto placeholder:text-muted-foreground/50 w-[400px]"
                        placeholder="Untitled Article"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {params.id !== "new" && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash className="h-4 w-4" />
                        </Button>
                    )}
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Button type="button" variant="outline" className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]" onClick={() => toast("AI Co-pilot: Suggesting content structure...")}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        AI Assist
                    </Button>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_350px]">
                {/* Editor Column */}
                <div className="flex flex-col border-r h-full min-h-0 bg-background">
                    <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between px-4 border-b h-10 bg-muted/20">
                            <TabsList className="h-8 bg-transparent p-0">
                                <TabsTrigger value="editor" className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 text-xs">Write</TabsTrigger>
                                <TabsTrigger value="preview" className="h-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 text-xs">Preview</TabsTrigger>
                            </TabsList>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Markdown Content</span>
                        </div>

                        <TabsContent value="editor" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col relative">
                            <Textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                required
                                className="flex-1 w-full resize-none border-0 focus-visible:ring-0 p-6 font-mono text-sm leading-relaxed bg-transparent"
                                placeholder="# Start writing..."
                            />
                        </TabsContent>
                        <TabsContent value="preview" className="flex-1 min-h-0 mt-0 overflow-y-auto p-8 prose prose-sm dark:prose-invert max-w-none">
                            {/* Simple preview logic, ideally reuse a component */}
                            <div className="text-muted-foreground text-center mt-20">
                                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                Preview content would render here.
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Settings Sidebar Column */}
                <div className="bg-muted/10 p-6 space-y-6 overflow-y-auto h-full border-l shadow-inner-lg">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Properties</h3>

                        <div className="space-y-2">
                            <Label className="text-xs">Category</Label>
                            <Input
                                list="categories-list"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                required
                                className="bg-background"
                                placeholder="Select or type new category..."
                            />
                            <datalist id="categories-list">
                                {existingCategories.map((cat) => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">URL Slug</Label>
                            <Input
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                required
                                className="font-mono text-xs bg-background"
                                placeholder="my-article-slug"
                            />
                            <p className="text-[10px] text-muted-foreground truncate">/docs/{formData.slug || '...'}</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Sort Order</Label>
                            <Input
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                required
                                className="bg-background"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Video Embed</Label>
                            <Input
                                value={formData.videoUrl || ""}
                                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                className="bg-background text-xs"
                                placeholder="Youtube URL"
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="pt-2">
                        <Link href={`/docs/${formData.slug}`} target="_blank" className="text-xs flex items-center gap-2 text-blue-500 hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            View on live site
                        </Link>
                    </div>
                </div>
            </div>
        </form>
    );
}
