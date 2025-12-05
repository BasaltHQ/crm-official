import React from "react";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import Link from "next/link";
import { BookOpen, Video, FileText } from "lucide-react";
import { prismadb } from "@/lib/prisma";

export const metadata = {
    title: "Documentation - Ledger1CRM",
    description: "Guides, tutorials, and API reference for Ledger1CRM.",
};

export default async function DocsPage() {
    const docs = await prismadb.docArticle.findMany({
        orderBy: { order: "asc" },
    });

    // Group by category
    const docsByCategory = docs.reduce((acc: any, doc: any) => {
        (acc[doc.category] = acc[doc.category] || []).push(doc);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[#0F0F1A] text-white font-sans selection:bg-primary/30">
            <MarketingHeader />

            <main className="py-20 md:py-32">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                            Knowledge <span className="text-primary">Base</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Everything you need to know about Ledger1CRM.
                        </p>
                    </div>

                    {docs.length === 0 ? (
                        <div className="text-center text-gray-500 py-20">
                            No documentation available yet.
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
                            {Object.entries(docsByCategory).map(([category, articles]: [string, any]) => (
                                <div key={category} className="space-y-6">
                                    <h2 className="text-2xl font-bold border-b border-white/10 pb-4 flex items-center">
                                        <BookOpen className="mr-3 h-6 w-6 text-primary" />
                                        {category}
                                    </h2>
                                    <ul className="space-y-4">
                                        {articles.map((doc: any) => (
                                            <li key={doc.id}>
                                                <Link href={`/docs/${doc.slug}`} className="group flex items-start p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-white/10 transition-all">
                                                    <div className="mt-1 mr-4 text-gray-400 group-hover:text-primary transition-colors">
                                                        {doc.videoUrl ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{doc.title}</h3>
                                                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                                            {/* Simple excerpt from content if needed, or just title is fine */}
                                                            Click to read more...
                                                        </p>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <MarketingFooter />
        </div>
    );
}
