import React from "react";
import MarketingHeader from "../../components/MarketingHeader";
import MarketingFooter from "../../components/MarketingFooter";
import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";
import { prismadb } from "@/lib/prisma";
import { notFound } from "next/navigation";

// Basic markdown renderer component (since we couldn't install react-markdown)
// In a real scenario, we'd use react-markdown. Here we'll use a simple parser for demo purposes
// or just render raw text if complex.
function MarkdownRenderer({ content }: { content: string }) {
    // This is a very simplified renderer. 
    // Ideally, we would use `react-markdown` here.
    const lines = content.split('\n');
    return (
        <div className="prose prose-invert max-w-none">
            {lines.map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.substring(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-6 mb-3">{line.substring(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.substring(4)}</h3>;
                if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-primary pl-4 italic my-4 text-gray-300">{line.substring(2)}</blockquote>;
                if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc mb-1">{line.substring(2)}</li>;
                if (line.startsWith('1. ')) return <li key={i} className="ml-4 list-decimal mb-1">{line.substring(3)}</li>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="mb-4 text-gray-300 leading-relaxed">{line}</p>;
            })}
        </div>
    );
}

function VideoEmbed({ url }: { url: string }) {
    // Simple embed for YouTube
    let embedUrl = "";
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const videoId = url.includes("v=") ? url.split("v=")[1].split("&")[0] : url.split("/").pop();
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("vimeo.com")) {
        const videoId = url.split("/").pop();
        embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    if (!embedUrl) return null;

    return (
        <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl mb-8">
            <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const doc = await prismadb.docArticle.findUnique({
        where: { slug: params.slug },
    });

    if (!doc) return { title: "Article Not Found" };

    return {
        title: `${doc.title} - Documentation`,
        description: `Read about ${doc.title} in the Ledger1CRM knowledge base.`,
    };
}

export default async function DocDetailPage({ params }: { params: { slug: string } }) {
    const doc = await prismadb.docArticle.findUnique({
        where: { slug: params.slug },
    });

    if (!doc) notFound();

    return (
        <div className="min-h-screen bg-[#0F0F1A] text-white font-sans selection:bg-primary/30">
            <MarketingHeader />

            <main className="py-20 md:py-32">
                <div className="container mx-auto px-4 max-w-4xl">
                    <Link href="/docs" className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Documentation
                    </Link>

                    <article>
                        <header className="mb-10">
                            <div className="flex items-center gap-2 text-sm text-primary font-medium mb-4 uppercase tracking-wider">
                                <span>{doc.category}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">{doc.title}</h1>
                        </header>

                        {doc.videoUrl && (
                            <div className="mb-10">
                                <div className="flex items-center gap-2 text-gray-400 mb-4">
                                    <Video className="h-5 w-5 text-primary" />
                                    <span className="font-medium">Video Tutorial</span>
                                </div>
                                <VideoEmbed url={doc.videoUrl} />
                            </div>
                        )}

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12">
                            <MarkdownRenderer content={doc.content} />
                        </div>
                    </article>
                </div>
            </main>

            <MarketingFooter />
        </div>
    );
}
