"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TableProperties, FileText, Settings, Pen, Loader2, CheckCircle2, AlertCircle, Download, Clock, Database, Layers } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ImportLeadsDialog from "@/app/(routes)/crm/accounts/components/ImportLeadsDialog";
import { toast } from "sonner";

type JobData = {
    id: string;
    fileName: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    progress: number;
    transformType: string;
    totalPages: number;
    createdAt: string;
    error?: string;
    resultData?: {
        extension: string;
        mimeType: string;
        fileName: string;
    };
};

export function JobsClient() {
    const [jobs, setJobs] = useState<JobData[]>([]);
    const [loading, setLoading] = useState(true);
    const [pools, setPools] = useState<any[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);

    const fetchPools = async () => {
        try {
            const res = await fetch("/api/crm/leads/pools");
            if (res.ok) {
                const data = await res.json();
                setPools(data.pools || []);
            }
        } catch (e) {
            console.error("Failed to fetch pools", e);
        }
    };

    const handlePushToCrm = async (jobId: string, fileName: string) => {
        try {
            const url = `/api/transform/jobs/${jobId}/download`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to download file");
            const blob = await res.blob();
            const file = new File([blob], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            setImportFile(file);
            setImportOpen(true);
        } catch (e) {
            toast.error("Failed to load file for CRM import.");
        }
    };

    const fetchJobs = async () => {
        try {
            const res = await fetch("/api/transform/jobs");
            if (res.ok) {
                const data = await res.json();
                setJobs(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        fetchPools();
    }, []);

    // Poll if there are active jobs
    useEffect(() => {
        const hasActive = jobs.some(j => j.status === "QUEUED" || j.status === "PROCESSING");
        if (!hasActive) return;

        const interval = setInterval(() => {
            fetchJobs();
        }, 3000);

        return () => clearInterval(interval);
    }, [jobs]);

    const handleDownload = async (jobId: string, fileName: string) => {
        const url = `/api/transform/jobs/${jobId}/download`;
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName; 
        a.click();
    };

    const getThumbnailConfig = (type: string) => {
        switch (type) {
            case "EXCEL": return { icon: TableProperties, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-500", ext: "XLSX" };
            case "MARKDOWN": return { icon: FileText, bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", ext: "MD" };
            case "JSON": return { icon: Settings, bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500", ext: "JSON" };
            case "TEXT": return { icon: Pen, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", ext: "TXT" };
            default: return { icon: FileText, bg: "bg-white/5", border: "border-white/10", text: "text-white/40", ext: "DOC" };
        }
    };

    return (
        <div className="w-full h-full flex flex-col min-h-0 bg-[#050505]">
            <div className="flex items-center justify-between h-14 px-6 border-b border-white/[0.06] bg-[#0a0a0a] shrink-0">
                <div className="flex items-center gap-2 text-white/80 font-medium">
                    <Layers className="w-4 h-4 text-orange-500" />
                    Extraction Jobs
                </div>
                <div className="text-xs text-white/40">
                    Auto-refreshes active processing tasks
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {loading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        <span className="text-sm text-white/40">Loading workspace history...</span>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                        <Database className="w-8 h-8 text-white/20" />
                        <span className="text-sm text-white/40">No extraction jobs found for your account.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
                        <AnimatePresence>
                            {jobs.map((job, i) => {
                                const config = getThumbnailConfig(job.transformType);
                                const Icon = config.icon;
                                const isFinished = job.status === "COMPLETED" || job.status === "FAILED";

                                return (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.05 }}
                                        className="flex flex-col bg-[#0a0a0a] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/10 transition-colors group relative shadow-2xl"
                                    >
                                        {/* Thumbnail Area */}
                                        <div className={`h-36 ${config.bg} border-b ${config.border} flex items-center justify-center relative overflow-hidden shrink-0`}>
                                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
                                            <Icon className={`w-12 h-12 ${config.text} opacity-20 group-hover:scale-110 transition-transform duration-500`} />
                                            <div className={`absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-black/40 ${config.text} border border-black/20 backdrop-blur-md`}>
                                                {config.ext}
                                            </div>
                                            
                                            {/* Status Badge overlay */}
                                            <div className="absolute top-3 left-3">
                                                {job.status === "QUEUED" && (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-white/10 text-[10px] text-white/50 backdrop-blur-md">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
                                                        QUEUED
                                                    </span>
                                                )}
                                                {job.status === "PROCESSING" && (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-orange-500/20 text-[10px] text-orange-400 backdrop-blur-md">
                                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                                        PROCESSING
                                                    </span>
                                                )}
                                                {job.status === "COMPLETED" && (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-green-500/20 text-[10px] text-green-400 backdrop-blur-md">
                                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                                        COMPLETED
                                                    </span>
                                                )}
                                                {job.status === "FAILED" && (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-red-500/20 text-[10px] text-red-400 backdrop-blur-md">
                                                        <AlertCircle className="w-2.5 h-2.5" />
                                                        FAILED
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Area */}
                                        <div className="p-4 flex flex-col flex-1">
                                            <h3 className="text-sm font-semibold text-white/90 truncate mb-1" title={job.fileName}>
                                                {job.fileName}
                                            </h3>
                                            <div className="flex items-center justify-between text-[11px] text-white/40 mb-4">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                                                </span>
                                                <span>{job.totalPages} {job.totalPages === 1 ? 'Page' : 'Pages'}</span>
                                            </div>

                                            {/* Progress / Error */}
                                            <div className="mt-auto pt-2">
                                                {job.status === "PROCESSING" || job.status === "QUEUED" ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-[10px]">
                                                            <span className="text-white/40">Extraction Progress</span>
                                                            <span className="text-orange-400 font-medium">{job.progress}%</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-orange-500 transition-all duration-500 ease-out relative"
                                                                style={{ width: `${job.progress}%` }}
                                                            >
                                                                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : job.status === "FAILED" ? (
                                                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                                        <p className="text-[10px] text-red-400 line-clamp-2" title={job.error}>
                                                            {job.error || "Unknown error occurred"}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {job.transformType === "EXCEL" && (
                                                            <button
                                                                onClick={() => handlePushToCrm(job.id, `Extracted_${job.fileName}`)}
                                                                className="w-full flex items-center justify-center gap-2 py-2 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors text-xs font-medium text-indigo-400 group-hover:text-indigo-300"
                                                            >
                                                                <Layers className="w-3.5 h-3.5" />
                                                                Push to CRM
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDownload(job.id, `Extracted_${job.fileName}`)}
                                                            className="w-full flex items-center justify-center gap-2 py-2 rounded bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium text-white/80 group-hover:text-white group-hover:bg-white/15"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Download Result
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Hidden wizard trigger/state */}
            <ImportLeadsDialog 
                pools={pools} 
                controlledOpen={importOpen}
                setControlledOpen={setImportOpen}
                preselectedFile={importFile}
                customTrigger={<div className="hidden"></div>}
            />
        </div>
    );
}
