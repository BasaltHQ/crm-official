import { prismadb } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Layers, Zap, Clock } from "lucide-react";
import Link from "next/link";

export default async function CMSDocsOverviewPage(props: { params: Promise<{ locale: string }> }) {
    const params = await props.params;
    const docs = await prismadb.docArticle.findMany();
    const totalDocs = docs.length;
    const categories = new Set(docs.map(d => d.category)).size;
    const recentDocs = await prismadb.docArticle.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5
    });

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Documentation Center</h1>
                <p className="text-muted-foreground mt-2 text-lg">Manage your entire knowledge base from one unified interface.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
                        <BookOpen className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{totalDocs}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Published to public site
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
                        <Layers className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{categories}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Organized topics
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">API Endpoints</CardTitle>
                        <Zap className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Documented routes
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">Recently Updated</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {recentDocs.map((doc) => (
                        <Link
                            key={doc.id}
                            href={`/${params.locale}/cms/docs/${doc.id}`}
                            className="block"
                        >
                            <div className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50">
                                <div>
                                    <h4 className="font-semibold text-foreground">{doc.title}</h4>
                                    <p className="text-sm text-muted-foreground">{doc.category} • {doc.slug}</p>
                                </div>
                                <div className="text-sm text-muted-foreground font-mono">
                                    {new Date(doc.updatedAt).toLocaleDateString()}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
