import React, { Suspense } from "react";
import Link from "next/link";
import { FileType2, HelpCircle } from "lucide-react";
import { SidebarNav } from "./_components/SidebarNav";
import { PolicyModalClient } from "./_components/PolicyModalClient";

export default function PdfWizardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-[#0a0a0a] text-white font-sans overflow-hidden">
            <aside className="w-56 border-r border-white/[0.06] bg-[#080808] flex flex-col z-20 relative shrink-0">
                <div className="py-6 flex items-center justify-center border-b border-white/[0.04] shrink-0">
                    <img src="/BasaltLensWide.png" alt="BasaltLens" className="h-10 w-auto object-contain drop-shadow-md" />
                </div>

                <Suspense fallback={<div className="flex-1" />}>
                    <SidebarNav />
                </Suspense>

                <div className="p-4 border-t border-white/[0.04] flex items-center justify-between shrink-0">
                    <img src="/BasaltLens.png" alt="BasaltLens Icon" className="h-8 w-8 object-contain opacity-80 hover:opacity-100 transition-opacity" />
                    <Link href="#" className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors">
                        <HelpCircle className="w-3 h-3" />
                        Docs
                    </Link>
                </div>
            </aside>

            <main className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
                <div className="h-full flex flex-col">
                    {children}
                </div>
            </main>
            <PolicyModalClient />
        </div>
    );
}
