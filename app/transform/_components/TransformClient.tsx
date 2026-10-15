"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, ChevronRight, CheckCircle2, AlertCircle, Loader2, Play, Download, Settings, TableProperties, Maximize2, Minimize2, X, Pen, Layers, Lock, Unlock, ChevronLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConversionPicker } from "./ConversionPicker";
import { DedupModal, GroupAction } from "./DedupModal";
import { detectDuplicates, buildDuplicateMap, mergeAllDuplicates, type DuplicateGroup } from "@/lib/dedup";
import { useRouter } from "next/navigation";

type Step = "SELECT_TOOL" | "UPLOAD" | "ANALYZING" | "REVIEW" | "PROCESSING" | "DONE";
type TransformType = "EXCEL" | "MARKDOWN" | "JSON" | "TEXT" | "CUSTOM";

export function TransformClient() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState<Step>("SELECT_TOOL");
    const [transformType, setTransformType] = useState<TransformType>("EXCEL");
    const [saveHistory, setSaveHistory] = useState<boolean>(false);
    const [file, setFile] = useState<File | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [dataType, setDataType] = useState<"FORM_FIELDS" | "TABULAR" | "MIXED" | null>(null);
    const [boundingBoxes, setBoundingBoxes] = useState<any[]>([]);
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [expandedPanel, setExpandedPanel] = useState<"doc" | "data" | null>(null);
    const [customConversion, setCustomConversion] = useState<{ from: string; to: string } | null>(null);
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [duplicateMap, setDuplicateMap] = useState<Record<number, { groupId: string; references: string; similarity: number }>>({});
    const [dedupSidebarOpen, setDedupSidebarOpen] = useState(false);
    const [dedupSidebarLocked, setDedupSidebarLocked] = useState(false);
    const [colWidths, setColWidths] = useState<Record<string, number>>({});
    const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [showDedupModal, setShowDedupModal] = useState(false);
    const pendingExportRef = useRef(false);
    const router = useRouter();

    // Read ?tool= and ?view= from URL
    useEffect(() => {
        const tool = searchParams.get("tool");
        if (tool && ["EXCEL", "MARKDOWN", "JSON", "TEXT"].includes(tool)) {
            setTransformType(tool as TransformType);
            setStep((prev) => (prev === "SELECT_TOOL" ? "UPLOAD" : prev));
        }
    }, [searchParams]);

    const onDrop = async (acceptedFiles: File[]) => {
        const selected = acceptedFiles[0];
        if (!selected) return;
        if (selected.type.includes("image")) {
            setFile(selected);
            setNumPages(1);
            const arrayBuffer = await selected.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const dataUrl = `data:${selected.type};base64,${base64}`;
            setPreviewImages([dataUrl]);
            setStep("REVIEW");
            return;
        }

        if (selected.type !== "application/pdf") {
            toast.error("Please upload a valid PDF or Image file.");
            return;
        }

        setFile(selected);
        setStep("ANALYZING");

        try {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

            const arrayBuffer = await selected.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = pdf.numPages;
            setNumPages(pages);

            if (pages > 200) {
                toast.error("Document is too large (max 200 pages). Please contact us for custom processing.");
                setStep("UPLOAD");
                setFile(null);
                return;
            }

            const images: string[] = [];
            const pagesToExtract = Math.min(2, pages);
            let firstPageWidth = 0;
            let firstPageHeight = 0;

            for (let i = 1; i <= pagesToExtract; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    if (i === 1) {
                        firstPageWidth = viewport.width;
                        firstPageHeight = viewport.height;
                    }
                    await page.render({ canvasContext: context, viewport, canvas: canvas as any }).promise;
                    images.push(canvas.toDataURL("image/jpeg", 0.8));
                }
            }

            setPreviewImages(images);

            const response = await fetch("/api/transform/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images, imageWidth: firstPageWidth, imageHeight: firstPageHeight }),
            });

            if (!response.ok) {
                throw new Error("Failed to generate preview. The vision model may have timed out.");
            }

            const data = await response.json();
            setDataType(data.dataType || "TABULAR");

            if (data.dataType === "FORM_FIELDS" || (!data.tables?.length && data.formFields?.length)) {
                const formRows = (data.formFields || []).map((f: any) => ({
                    "Field Name": f.label,
                    "Value": f.value
                }));
                setParsedData(formRows);
                setHeaders(["Field Name", "Value"]);
            } else if (data.tables && data.tables.length > 0) {
                const table = data.tables[0];
                const flattenedRows = table.rows.map((row: any) => {
                    const flatObj: any = {};
                    if (row.cells && Array.isArray(row.cells)) {
                        row.cells.forEach((cell: any) => {
                            if (cell.header) flatObj[cell.header] = cell.value || "";
                        });
                    }
                    return flatObj;
                });
                setParsedData(flattenedRows);

                const keys = new Set<string>();
                table.rows.forEach((row: any) => {
                    row.cells?.forEach((cell: any) => {
                        if (cell.header) keys.add(cell.header);
                    });
                });
                setHeaders(Array.from(keys));
            } else {
                setParsedData([]);
                setHeaders([]);
            }

            setBoundingBoxes(data.boundingBoxes || []);
            setStep("REVIEW");

        } catch (error) {
            console.error(error);
            toast.error("Failed to analyze PDF. Please try again.");
            setStep("UPLOAD");
            setFile(null);
        }
    };

    // Run dedup whenever parsedData changes
    useEffect(() => {
        if (parsedData.length > 1 && headers.length > 0) {
            const groups = detectDuplicates(parsedData, headers);
            setDuplicateGroups(groups);
            setDuplicateMap(buildDuplicateMap(groups));
        } else {
            setDuplicateGroups([]);
            setDuplicateMap({});
        }
    }, [parsedData, headers]);

    const handleMergeAll = () => {
        if (duplicateGroups.length === 0) return;
        const merged = mergeAllDuplicates(parsedData, headers, duplicateGroups);
        setParsedData(merged);
        toast.success(`Merged ${duplicateGroups.length} duplicate group(s) into golden records.`);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "image/png": [".png"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/webp": [".webp"]
        },
        maxFiles: 1,
    });


    // Pre-export: check for duplicates and show modal
    const initiateExport = () => {
        if (duplicateGroups.length > 0) {
            setShowDedupModal(true);
            return;
        }
        handleProcess();
    };

    const handleDedupConfirm = (actions: Record<string, "merge" | "keep" | "remove_dupes">) => {
        let updatedData = [...parsedData];

        // Process groups in reverse order to maintain indices
        const sortedGroups = [...duplicateGroups].sort((a, b) => {
            const maxA = Math.max(...a.rowIndices);
            const maxB = Math.max(...b.rowIndices);
            return maxB - maxA;
        });

        for (const group of sortedGroups) {
            const action = actions[group.id] || "keep";
            if (action === "merge") {
                // Merge into golden record (keep first, merge fields)
                const merged = mergeAllDuplicates(updatedData, headers, [group]);
                updatedData = merged;
            } else if (action === "remove_dupes") {
                // Keep first row, remove the rest
                const [keep, ...removeIndices] = group.rowIndices;
                updatedData = updatedData.filter((_, idx) => !removeIndices.includes(idx));
            }
            // "keep" = do nothing
        }

        setParsedData(updatedData);
        setShowDedupModal(false);
        toast.success("Duplicates resolved. Proceeding to export...");

        // Use timeout to let state update before export
        setTimeout(() => { handleProcess(); }, 100);
    };

    const handleProcess = async () => {
        if (!file) return;
        setStep("PROCESSING");
        try {
            // For paid tier, redirect to checkout
            if (numPages > 5 && process.env.NEXT_PUBLIC_LENS_TEST !== 'true') {
                const res = await fetch("/api/transform/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pages: numPages, fileName: file.name, type: transformType })
                });
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                    return;
                }
            }

            // EXCEL: Single-page docs export from parsed table; multi-page use API for full extraction
            if (transformType === "EXCEL" && parsedData.length > 0 && headers.length > 0 && numPages <= 1) {
                const ExcelJS = (await import("exceljs")).default;
                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet("Extracted Data");

                sheet.columns = headers.map(h => ({
                    header: h.toUpperCase(),
                    key: h,
                    width: Math.max(15, h.length + 5),
                }));

                parsedData.forEach(row => {
                    const rowObj: Record<string, string> = {};
                    headers.forEach(h => { rowObj[h] = row[h] || ""; });
                    sheet.addRow(rowObj);
                });

                sheet.getRow(1).font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
                sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };

                headers.forEach((h, colIdx) => {
                    let maxLen = h.length;
                    parsedData.forEach(row => {
                        maxLen = Math.max(maxLen, String(row[h] || "").length);
                    });
                    sheet.getColumn(colIdx + 1).width = Math.min(60, Math.max(12, maxLen + 4));
                });

                for (let i = 2; i <= parsedData.length + 1; i++) {
                    if (i % 2 === 0) {
                        sheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
                    }
                }

                const xlsxBuffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${file.name.replace(/\.[^/.]+$/, "")}_extracted.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                setStep("DONE");
                toast.success("Excel exported from parsed table!");
                return;
            }

            // CUSTOM X→Y: Use deterministic conversion engine (no AI)
            if (customConversion && file) {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("from", customConversion.from);
                fd.append("to", customConversion.to);

                const convertRes = await fetch("/api/transform/convert", {
                    method: "POST",
                    body: fd,
                });

                if (!convertRes.ok) {
                    const err = await convertRes.json();
                    throw new Error(err.error || `Conversion ${customConversion.from} -> ${customConversion.to} failed.`);
                }

                const blob = await convertRes.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const ext = convertRes.headers.get("Content-Disposition")?.match(/filename="[^"]+(\.[^"]+)"/)?.[1] || "";
                a.download = `${file.name.replace(/\.[^/.]+$/, "")}${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                setStep("DONE");
                toast.success(`Converted ${customConversion.from} to ${customConversion.to}!`);
                return;
            }

            // JSON preset: Export parsed table directly as JSON
            if (transformType === "JSON" && parsedData.length > 0) {
                const jsonStr = JSON.stringify(parsedData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${file.name.replace(/\.[^/.]+$/, "")}_extracted.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                setStep("DONE");
                toast.success("JSON exported from parsed table!");
                return;
            }

            // MARKDOWN & TEXT presets: These need AI for semantic understanding
            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", transformType);
            formData.append("saveHistory", saveHistory ? "true" : "false");

            const processRes = await fetch("/api/transform/process", {
                method: "POST",
                body: formData,
            });

            if (!processRes.ok) {
                const err = await processRes.json();
                throw new Error(err.error || "Failed to process document.");
            }

            const { jobId } = await processRes.json();
            
            setStep("DONE");
            toast.success("Document added to batch processor!");
            router.push("/transform/jobs");
        } catch (error: any) {
            toast.error(error.message);
            setStep("REVIEW");
        }
    };

    const handleCellChange = (rowIndex: number, colKey: string, val: string) => {
        const newData = [...parsedData];
        newData[rowIndex][colKey] = val;
        setParsedData(newData);
    };

    // Column resize handlers
    const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = colWidths[col] || 120;
        resizingRef.current = { col, startX, startW };

        const onMove = (ev: MouseEvent) => {
            if (!resizingRef.current) return;
            const activeCol = resizingRef.current.col;
            const delta = ev.clientX - resizingRef.current.startX;
            const newWidth = Math.max(40, resizingRef.current.startW + delta);
            setColWidths(prev => ({ ...prev, [activeCol]: newWidth }));
        };
        const onUp = () => {
            resizingRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [colWidths]);

    const handleAutoFit = useCallback((col: string) => {
        if (!tableRef.current) return;
        const span = document.createElement("span");
        span.style.visibility = "hidden";
        span.style.position = "absolute";
        span.style.whiteSpace = "nowrap";
        span.style.font = "12px ui-monospace, monospace";
        document.body.appendChild(span);
        let maxW = 60;
        span.textContent = col;
        maxW = Math.max(maxW, span.offsetWidth + 32);
        parsedData.forEach(row => {
            span.textContent = String(row[col] || "");
            maxW = Math.max(maxW, span.offsetWidth + 24);
        });
        document.body.removeChild(span);
        setColWidths(prev => ({ ...prev, [col]: maxW }));
    }, [parsedData]);

    const TOOL_LABELS: Record<string, string> = {
        EXCEL: "Tabular Extraction",
        MARKDOWN: "Layout to Markdown",
        JSON: "Receipts to JSON",
        TEXT: "Handwriting & OCR",
        CUSTOM: customConversion ? `${customConversion.from} > ${customConversion.to}` : "Custom",
    };

    const allHeaders = headers;
    const showDedupSidebar = dedupSidebarLocked || dedupSidebarOpen;
    const hasDuplicates = duplicateGroups.length > 0;


    return (
        <div className="w-full h-full flex flex-col min-h-0">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between h-10 px-3 border-b border-white/[0.06] bg-white/[0.02] shrink-0 relative">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Step breadcrumb â€” first item shows the active tool name */}
                    <div className="flex items-center gap-1 text-[11px] text-white/40">
                        {["SELECT_TOOL", "UPLOAD", "REVIEW", "DONE"].map((s, i) => (
                            <React.Fragment key={s}>
                                {i > 0 && <ChevronRight className="w-3 h-3 text-white/15" />}
                                <span className={`${step === s ? "text-orange-400 font-medium" : ""} ${["SELECT_TOOL","UPLOAD","ANALYZING","REVIEW","PROCESSING","DONE"].indexOf(step) > ["SELECT_TOOL","UPLOAD","REVIEW","DONE"].indexOf(s) ? "text-white/60" : ""}`}>
                                    {s === "SELECT_TOOL" ? TOOL_LABELS[transformType] : s === "UPLOAD" ? "Upload" : s === "REVIEW" ? "Review" : "Export"}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* File name */}
                    {file && (
                        <>
                            <div className="w-px h-4 bg-white/10" />
                            <span className="text-[11px] text-white/30 truncate max-w-[200px]">{file.name}</span>
                            <span className="text-[10px] text-white/20">{numPages}p</span>
                        </>
                    )}
                </div>

                {/* Center: Conversion Picker */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <ConversionPicker
                        from={customConversion?.from}
                        to={customConversion?.to}
                        onSelect={(from, to) => {
                            setCustomConversion({ from, to });
                            setTransformType("CUSTOM" as TransformType);
                            if (step === "SELECT_TOOL") setStep("UPLOAD");
                        }}
                    />
                </div>

                {/* Right: Jobs Toggle */}
                <div className="flex items-center justify-end gap-2 pr-2 shrink-0">
                    <button 
                        onClick={() => router.push("/transform/jobs")}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[11px] font-medium transition-colors border border-white/5"
                    >
                        <div className="relative flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5 text-orange-400" />
                            <div className="absolute inset-0 bg-orange-400/20 blur-sm rounded-full animate-pulse" />
                        </div>
                        Current Jobs
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col">
                <AnimatePresence mode="wait">
                    {step === "SELECT_TOOL" && (
                        <motion.div
                            key="select_tool"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex-1 flex items-center justify-center p-6"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                                {[
                                    { id: "EXCEL", icon: <TableProperties className="w-5 h-5" />, title: "Tabular Extraction", desc: "Dense ledgers to Excel (.xlsx)", cost: "$0.05/page" },
                                    { id: "MARKDOWN", icon: <FileText className="w-5 h-5" />, title: "Layout to Markdown", desc: "Reports to clean Markdown (.md)", cost: "$0.02/page" },
                                    { id: "JSON", icon: <Layers className="w-5 h-5" />, title: "Receipts to JSON", desc: "Invoices to API-ready JSON", cost: "$0.02/doc" },
                                    { id: "TEXT", icon: <Pen className="w-5 h-5" />, title: "Handwriting & OCR", desc: "Whiteboards & notes to Text (.txt)", cost: "$0.01/image" }
                                ].map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => {
                                            setTransformType(t.id as TransformType);
                                            setCustomConversion(null); // Ensure custom conversion is cleared for presets
                                            setStep("UPLOAD");
                                        }}
                                        className="p-5 border border-white/10 bg-white/[0.02] rounded-lg hover:bg-white/[0.06] hover:border-orange-500/40 cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="text-white/40 group-hover:text-orange-400 transition-colors">{t.icon}</div>
                                            <h3 className="text-sm font-semibold text-white group-hover:text-orange-400">{t.title}</h3>
                                        </div>
                                        <p className="text-xs text-white/40 mb-3">{t.desc}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-medium px-2 py-0.5 bg-white/5 rounded text-white/50">{t.cost}</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-orange-400" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {step === "UPLOAD" && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex-1 flex items-center justify-center p-6"
                        >
                            <div
                                {...(getRootProps() as any)}
                                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-16 cursor-pointer transition-colors w-full max-w-xl ${isDragActive ? "border-orange-500 bg-orange-500/5" : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                            >
                                <input {...getInputProps()} />
                                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-5">
                                    <UploadCloud className="w-7 h-7 text-white/50" />
                                </div>
                                <h3 className="text-lg font-semibold mb-1">Drop your file here</h3>
                                <p className="text-white/35 text-xs max-w-sm text-center">
                                    Supports PDFs, invoices, and images (PNG, JPG, WEBP).
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {step === "ANALYZING" && (
                        <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-5" />
                            <h3 className="text-lg font-semibold mb-1">Vision AI is Analyzing...</h3>
                            <p className="text-white/35 text-xs">Identifying layout, tables, and extraction points on the first {numPages > 1 ? "2 pages" : "page"}.</p>
                        </motion.div>
                    )}

                    {step === "REVIEW" && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col flex-1 min-h-0 p-3 gap-3"
                        >
                            <div className={`flex-1 min-h-0 grid gap-px bg-white/[0.04] rounded-lg overflow-hidden ${expandedPanel ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
                                {/* Document Preview */}
                                {expandedPanel !== "data" && (
                                    <div className="flex flex-col bg-[#0a0a0a] min-h-0">
                                        <div className="flex items-center justify-between h-8 px-3 bg-white/[0.03] border-b border-white/[0.06] shrink-0">
                                            <div className="flex items-center gap-2 text-[11px] text-white/50">
                                                <FileText className="w-3 h-3" />
                                                <span>Document Preview</span>
                                            </div>
                                            <button onClick={() => setExpandedPanel(expandedPanel === "doc" ? null : "doc")} className="text-white/30 hover:text-white/60 transition-colors">
                                                {expandedPanel === "doc" ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <div className="flex-1 min-h-0 overflow-auto p-3 flex items-start justify-center bg-zinc-950/50">
                                            {previewImages.length > 0 && (
                                                <div className="relative inline-block">
                                                    <img src={previewImages[0]} alt="Page 1" className={`block w-auto ${expandedPanel === "doc" ? "max-h-[85vh]" : "max-h-[70vh]"}`} />
                                                    <style>{`@keyframes lens-marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }`}</style>
                                                    {boundingBoxes.map((box, i) => (
                                                        <div
                                                            key={`box_${i}`}
                                                            className="absolute border-[3px] border-orange-500 bg-orange-500/15 group/box cursor-pointer hover:bg-orange-500/30 hover:border-orange-400 transition-all shadow-[0_0_6px_rgba(249,115,22,0.4)]"
                                                            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }}
                                                        >
                                                            <div className="absolute inset-0 flex items-center overflow-hidden opacity-0 group-hover/box:opacity-100 transition-opacity duration-200 bg-orange-500/85 backdrop-blur-sm z-40">
                                                                <div className="whitespace-nowrap text-white text-[11px] font-bold px-2 tracking-wide" style={{ animation: box.label.length > 20 ? 'lens-marquee 10s linear infinite' : 'none' }}>
                                                                    {box.label}
                                                                    {box.label.length > 20 && <span className="px-8">{box.label}</span>}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setBoundingBoxes(boundingBoxes.filter((_, idx) => idx !== i)); }}
                                                                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity z-50 hover:bg-red-400"
                                                            >X</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Data Table */}
                                {expandedPanel !== "doc" && (
                                    <div className="flex flex-col bg-[#0a0a0a] min-h-0 relative">
                                        <div className="flex items-center justify-between h-8 px-3 bg-white/[0.03] border-b border-white/[0.06] shrink-0">
                                            <div className="flex items-center gap-2 text-[11px] text-white/50">
                                                <TableProperties className="w-3 h-3" />
                                                <span>Parsed Data</span>
                                                <span className="text-[10px] text-white/25">{parsedData.length} rows</span>
                                                {hasDuplicates && (
                                                    <span className="text-[10px] text-orange-400 ml-1">{duplicateGroups.length} dup group(s)</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {hasDuplicates && (
                                                    <button onClick={handleMergeAll} className="text-[10px] text-orange-400 hover:text-orange-300 font-medium transition-colors">
                                                        Merge All
                                                    </button>
                                                )}
                                                <button onClick={() => setExpandedPanel(expandedPanel === "data" ? null : "data")} className="text-white/30 hover:text-white/60 transition-colors">
                                                    {expandedPanel === "data" ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Table + Floating Dedup Sidebar wrapper */}
                                        <div className="flex-1 min-h-0 flex relative">
                                            {/* Scrollable Table */}
                                            <div
                                                className="flex-1 min-h-0 overflow-auto"
                                                style={{ marginRight: showDedupSidebar ? 200 : 16 }}
                                                onScroll={(e) => {
                                                    const sidebar = document.getElementById("dedup-sidebar-scroll");
                                                    if (sidebar) sidebar.scrollTop = e.currentTarget.scrollTop;
                                                }}
                                                id="data-table-scroll"
                                            >
                                                <table ref={tableRef} className="text-xs text-left font-mono" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                                                    <thead className="text-[10px] uppercase text-white/40 sticky top-0 z-10 bg-[#0d0d0d]">
                                                        <tr>
                                                            <th className="px-2 py-2 font-medium border-b border-white/[0.06] w-[40px] text-center">#</th>
                                                            {allHeaders.map((h, i) => (
                                                                <th key={i} className="px-3 py-2 font-medium border-b border-white/[0.06] whitespace-nowrap relative group/th" style={{ width: colWidths[h] || "auto", minWidth: 60 }}>
                                                                    {h}
                                                                    <div
                                                                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize bg-transparent hover:bg-orange-500/40 group-hover/th:bg-orange-500/20 transition-colors"
                                                                        onMouseDown={(e) => handleResizeStart(h, e)}
                                                                        onDoubleClick={() => handleAutoFit(h)}
                                                                    />
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {parsedData.map((row, rIdx) => (
                                                            <tr key={rIdx} className={`border-b border-white/[0.04] ${rIdx % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.04]`} style={{ height: 30 }}>
                                                                <td className="px-2 py-1.5 text-center text-white/25 text-[10px]">{rIdx + 1}</td>
                                                                {allHeaders.map((h, cIdx) => (
                                                                    <td key={cIdx} className="px-1 py-0.5" style={{ width: colWidths[h] || "auto", maxWidth: colWidths[h] || "none", overflow: "hidden" }}>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full bg-transparent border border-transparent hover:border-white/15 focus:border-orange-500 focus:bg-black/50 rounded px-2 py-1 text-xs outline-none transition-all font-mono"
                                                                            value={row[h] || ""}
                                                                            onChange={(e) => handleCellChange(rIdx, h, e.target.value)}
                                                                        />
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                        {parsedData.length === 0 && (
                                                            <tr>
                                                                <td colSpan={allHeaders.length + 1} className="px-4 py-8 text-center text-white/30 italic text-xs">
                                                                    No data rows identified.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Floating Potential Duplicates Sidebar */}
                                            <div
                                                className={`absolute top-0 right-0 bottom-0 border-l border-white/[0.06] bg-[#080808] z-20 flex flex-col transition-all duration-200 ${showDedupSidebar ? "w-[200px]" : "w-[16px]"}`}
                                                onMouseEnter={() => !dedupSidebarLocked && setDedupSidebarOpen(true)}
                                                onMouseLeave={() => !dedupSidebarLocked && setDedupSidebarOpen(false)}
                                            >
                                                {/* Sidebar Header */}
                                                <div
                                                    className={`shrink-0 border-b border-white/[0.06] cursor-pointer flex items-center transition-all ${showDedupSidebar ? "h-8 px-2" : "h-8 justify-center"}`}
                                                    onClick={() => setDedupSidebarLocked(!dedupSidebarLocked)}
                                                >
                                                    {showDedupSidebar ? (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
                                                            {dedupSidebarLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                                            Potential Duplicates
                                                        </div>
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-sm bg-orange-500/40" />
                                                    )}
                                                </div>

                                                {/* Sidebar Rows */}
                                                <div className="flex-1 overflow-hidden" id="dedup-sidebar-scroll">
                                                    {parsedData.map((_, rIdx) => {
                                                        const dupEntry = duplicateMap[rIdx];
                                                        const hasDup = !!dupEntry;
                                                        const isExact = hasDup ? dupEntry.similarity >= 1.0 : false;
                                                        return (
                                                            <div
                                                                key={rIdx}
                                                                className={`flex items-center border-b border-white/[0.04] transition-all ${showDedupSidebar ? "px-2" : "justify-center"}`}
                                                                style={{ height: 30 }}
                                                            >
                                                                {showDedupSidebar ? (
                                                                    hasDup ? (
                                                                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                                                                            <div className={`w-2 h-2 rounded-sm shrink-0 ${isExact ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]"}`} />
                                                                            <span className={`shrink-0 ${isExact ? "text-red-400" : "text-orange-400"}`}>
                                                                                {isExact ? "Exact" : `${Math.round(dupEntry.similarity * 100)}%`}
                                                                            </span>
                                                                            <span className="text-white/25 truncate">{dupEntry.references}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-white/10">-</span>
                                                                    )
                                                                ) : (
                                                                    hasDup ? (
                                                                        <div className={`w-2 h-2 rounded-sm ${isExact ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]"}`} />
                                                                    ) : null
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Bar */}
                            <div className="flex items-center justify-between h-10 px-3 bg-white/[0.02] border border-white/[0.06] rounded-lg shrink-0">
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={() => setSaveHistory(!saveHistory)}
                                        className="flex items-center gap-2 cursor-pointer group"
                                    >
                                        <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${saveHistory ? 'bg-orange-500' : 'bg-white/15'}`}>
                                            <motion.div className="w-3 h-3 bg-white rounded-full" animate={{ x: saveHistory ? 12 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                                        </div>
                                        <span className="text-[11px] text-white/40 group-hover:text-white/60">Vault</span>
                                    </div>

                                    {numPages > 5 && process.env.NEXT_PUBLIC_LENS_TEST !== 'true' && (
                                        <>
                                            <div className="w-px h-4 bg-white/10" />
                                            <span className="text-[11px] text-orange-400 font-medium">${(numPages * 0.05).toFixed(2)} ({numPages}p)</span>
                                        </>
                                    )}

                                    {numPages <= 5 && (
                                        <>
                                            <div className="w-px h-4 bg-white/10" />
                                            <div className="flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                <span className="text-[11px] text-white/35">Free tier</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <Button
                                    onClick={initiateExport}
                                    size="sm"
                                    className="h-7 bg-white text-black hover:bg-white/90 text-xs font-medium px-4"
                                >
                                    {numPages > 5 && process.env.NEXT_PUBLIC_LENS_TEST !== 'true' ? "Pay & Process" : "Process Document"}
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === "PROCESSING" && (
                        <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-5" />
                            <h3 className="text-lg font-semibold mb-1">Processing Full Document...</h3>
                            <p className="text-white/35 text-xs">Please keep this window open while we stream the conversion.</p>
                        </motion.div>
                    )}

                    {step === "DONE" && (
                        <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-5">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Processing Complete</h3>
                            <p className="text-white/35 text-xs mb-6 text-center">Your file has been generated and should start downloading automatically.</p>
                            <Button variant="outline" size="sm" onClick={() => { setStep("UPLOAD"); setFile(null); }}>
                                Process Another Document
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between h-6 px-3 border-t border-white/[0.06] bg-white/[0.015] shrink-0 text-[10px] text-white/25">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500/70" /> Ready</span>
                    {dataType && <span>{dataType === "TABULAR" ? "Table" : dataType === "FORM_FIELDS" ? "Form" : "Mixed"}</span>}
                    {parsedData.length > 0 && <span>{parsedData.length} rows x {headers.length} cols</span>}
                </div>
                <span>BasaltLens AI</span>
            </div>
            {/* Dedup Resolution Modal */}
            <DedupModal
                open={showDedupModal}
                onClose={() => setShowDedupModal(false)}
                onConfirm={handleDedupConfirm}
                groups={duplicateGroups}
                parsedData={parsedData}
                headers={headers}
            />
        </div>
    );
}
