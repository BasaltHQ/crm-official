import React from "react";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prismadb } from "@/lib/prisma";

export const metadata = {
    title: "Blog - Ledger1CRM",
    description: "Latest news, updates, and insights from the Ledger1CRM team.",
};

// Helper to get random color for placeholder if no image
const colors = [
    "bg-blue-900/50", "bg-purple-900/50", "bg-green-900/50",
    "bg-orange-900/50", "bg-pink-900/50", "bg-cyan-900/50"
];

export default async function BlogPage() {
    const posts = await prismadb.blogPost.findMany({
        orderBy: { publishedAt: "desc" },
    });

    return (
        <div className="min-h-screen bg-[#0F0F1A] text-white font-sans selection:bg-primary/30">
            <MarketingHeader />

            <main className="py-20 md:py-32">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-20">
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
                            The Ledger1 <span className="text-primary">Blog</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Insights on AI, sales automation, and the future of work.
                        </p>
                    </div>

                    {posts.length === 0 ? (
                        <div className="text-center text-gray-500 py-20">
                            No posts found. Check back soon!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                            {posts.map((post, i) => (
                                <BlogPost
                                    key={post.id}
                                    category={post.category || "General"}
                                    date={new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    title={post.title}
                                    excerpt={post.excerpt || ""}
                                    imageColor={colors[i % colors.length]}
                                    slug={post.slug}
                                    coverImage={post.coverImage}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <MarketingFooter />
        </div>
    );
}

function BlogPost({ category, date, title, excerpt, imageColor, slug, coverImage }: any) {
    return (
        <Link href={`/blog/${slug}`} className="group">
            <article className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all h-full flex flex-col">
                <div className={`h-48 w-full ${imageColor} relative overflow-hidden`}>
                    {coverImage ? (
                        <img src={coverImage} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20 font-bold text-2xl">
                            {category} Image
                        </div>
                    )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                        <span className="bg-white/10 px-2 py-1 rounded-full uppercase tracking-wider font-medium">{category}</span>
                        <span>{date}</span>
                    </div>
                    <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">{excerpt}</p>
                    <div className="flex items-center text-primary font-medium text-sm group-hover:translate-x-1 transition-transform">
                        Read Article <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                </div>
            </article>
        </Link>
    );
}

