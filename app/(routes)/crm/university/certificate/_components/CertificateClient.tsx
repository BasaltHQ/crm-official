"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Check, Shield, Printer, ArrowLeft, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface UnlockedPhase {
    id: string;
    title: string;
    level_req: number;
    color: string;
    border: string;
    certHash: string;
}

interface CertProps {
    user: any;
    phaseTitle: string;
    colorClass: string;
    borderClass: string;
    issueDate: string;
    certHash: string;
    unlockedPhases?: UnlockedPhase[];
}

export default function CertificateClient({
    user,
    phaseTitle,
    colorClass,
    borderClass,
    issueDate,
    certHash,
    unlockedPhases = [],
}: CertProps) {
    const [printing, setPrinting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activePhase, setActivePhase] = useState<UnlockedPhase>({
        id: phaseTitle.toLowerCase().replace(/\s+/g, "-"),
        title: phaseTitle,
        level_req: 5,
        color: colorClass,
        border: borderClass,
        certHash,
    });

    useEffect(() => {
        setActivePhase({
            id: phaseTitle.toLowerCase().replace(/\s+/g, "-"),
            title: phaseTitle,
            level_req: 5,
            color: colorClass,
            border: borderClass,
            certHash,
        });
    }, [phaseTitle, colorClass, borderClass, certHash]);

    const handlePrint = () => {
        setPrinting(true);
        setTimeout(() => {
            window.print();
            setPrinting(false);
        }, 300);
    };

    const handleCopyVerification = () => {
        const shareText = `BasaltCRM Certified ${activePhase.title} — ${user.name} (Verification UID: ${activePhase.certHash})`;
        navigator.clipboard.writeText(shareText);
        setCopied(true);
        toast.success("Certificate verification copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 overflow-hidden font-sans print:m-0 print:p-0 print:bg-white print:text-black">
            
            {/* Action Bar (Hidden when printing) */}
            <div className={cn("flex flex-wrap items-center justify-center gap-4 mb-6 print:hidden", printing && "opacity-0")}>
                <button 
                    onClick={() => window.history.back()}
                    className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5 mb-1" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Back</span>
                </button>

                {unlockedPhases.length > 1 && (
                    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/5 border border-white/10">
                        {unlockedPhases.map((phase) => {
                            const isSelected = activePhase.title === phase.title;
                            return (
                                <button
                                    key={phase.id}
                                    onClick={() => setActivePhase(phase)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        isSelected
                                            ? "bg-white text-black shadow-lg"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <Award className="w-3.5 h-3.5" />
                                    {phase.title}
                                </button>
                            );
                        })}
                    </div>
                )}

                <button 
                    onClick={handleCopyVerification}
                    className="flex flex-col items-center justify-center h-14 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-200 transition-colors border border-white/10"
                >
                    {copied ? <Check className="w-5 h-5 mb-1 text-emerald-400" /> : <Copy className="w-5 h-5 mb-1" />}
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                        {copied ? "Copied UID" : "Copy Verification"}
                    </span>
                </button>

                <button 
                    onClick={handlePrint}
                    className="flex flex-col items-center justify-center h-14 px-8 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white transition-colors border border-indigo-400"
                >
                    <Printer className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Print to PDF</span>
                </button>
            </div>

            {/* Certificate Canvas */}
            <div className={cn(
                "relative w-[1100px] h-[800px] flex-shrink-0 bg-zinc-950 border-[16px] rounded-sm print:border-[16px] overflow-hidden shadow-2xl print:shadow-none",
                !printing && activePhase.border
            )}>
                {/* Internal Border Trim */}
                <div className="absolute inset-4 border border-zinc-800/80 print:border-gray-300 pointer-events-none" />
                <div className="absolute inset-[24px] border-2 border-dashed border-zinc-800/50 print:border-gray-200 pointer-events-none" />

                {/* Corner Accents */}
                <div className={cn("absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 rounded-tl-xl", activePhase.border)} />
                <div className={cn("absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 rounded-tr-xl", activePhase.border)} />
                <div className={cn("absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 rounded-bl-xl", activePhase.border)} />
                <div className={cn("absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 rounded-br-xl", activePhase.border)} />

                {/* Subdued background watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] print:opacity-[0.02] pointer-events-none">
                    <Shield className="w-[800px] h-[800px]" />
                </div>

                {/* Content Layout */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-24 px-16 text-center">
                    
                    {/* Header */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <Image src="/CRM-ERP-CMS.png" alt="Basalt Logo" width={48} height={48} className="print:invert" />
                            <h2 className="text-2xl tracking-[0.3em] font-black uppercase opacity-60 print:text-black">BasaltCRM University</h2>
                        </div>
                        <p className="text-gray-500 print:text-gray-400 font-mono text-sm tracking-widest uppercase pb-4">Certificate of Mastery</p>
                    </div>

                    {/* Body */}
                    <div className="space-y-12">
                        <div>
                            <p className="text-lg italic text-gray-400 print:text-gray-500 mb-6">This is to certify that</p>
                            <h1 className="text-6xl font-black capitalize tracking-tight">{user.name}</h1>
                            <div className="w-1/2 h-px bg-white/20 print:bg-black/20 mx-auto mt-6" />
                        </div>

                        <div>
                            <p className="text-lg italic text-gray-400 print:text-gray-500 mb-4">has successfully met standard operational requirements and earned</p>
                            <h2 className={cn(
                                "text-5xl font-black uppercase italic tracking-tighter leading-none bg-gradient-to-r bg-clip-text text-transparent print:text-black",
                                activePhase.color
                            )}>
                                {activePhase.title}
                            </h2>
                        </div>
                    </div>

                    {/* Footer Array */}
                    <div className="flex items-end justify-between w-full mt-10">
                        <div className="text-left space-y-2">
                            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Date of Issue</p>
                            <p className="font-black text-xl">{issueDate}</p>
                            <div className="w-40 h-px bg-white/20 print:bg-black/20 mt-2" />
                        </div>

                        <div className="flex flex-col items-center justify-center mb-[-2rem]">
                            <div className={cn(
                                "w-32 h-32 rounded-full border-8 shadow-2xl flex items-center justify-center bg-zinc-950 print:bg-white print:border-double",
                                activePhase.border
                            )}>
                                <Shield className="w-12 h-12 text-zinc-500 print:text-black opacity-50" />
                            </div>
                        </div>

                        <div className="text-right space-y-2">
                            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Verification UID</p>
                            <p className="font-mono font-bold text-sm tracking-widest bg-white/5 print:bg-black/5 px-3 py-1 rounded-sm">{activePhase.certHash}</p>
                            <div className="w-40 h-px bg-white/20 print:bg-black/20 mt-2 ml-auto" />
                        </div>
                    </div>

                </div>
            </div>

            {/* Print Info Note */}
            <p className={cn("text-gray-500 mt-6 text-sm flex items-center gap-2 print:hidden", printing && "opacity-0")}>
                Ensure "Background Graphics" is enabled in your print dialog dialog.
            </p>
        </div>
    );
}
