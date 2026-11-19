import { Handle, Position, NodeResizer } from "@xyflow/react";
import { Image as ImageIcon, FileCode, StickyNote, X } from "lucide-react";
import { useState } from "react";
import DOMPurify from "isomorphic-dompurify";

interface MediaNodeProps {
    id: string;
    data: {
        label?: string;
        type?: "note" | "image" | "svg";
        content?: string;
        url?: string;
        width?: number;
        height?: number;
    };
    selected?: boolean;
}

export function MediaNode({ id, data, selected }: MediaNodeProps) {
    const isNote = data.type === "note" || !data.type;
    const isImage = data.type === "image";
    const isSvg = data.type === "svg";

    return (
        <div
            className={`group relative p-1 transition-colors rounded-lg w-full h-full ${selected ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0f1115]" : ""
                }`}
        >
            {selected && (
                <NodeResizer
                    color="#06b6d4"
                    isVisible={selected}
                    minWidth={100}
                    minHeight={40}
                    handleClassName="!w-2 !h-2 !bg-white !border-cyan-500"
                />
            )}

            {/* Control handles for connections if needed, but visually hidden or subtle */}
            <Handle type="target" position={Position.Top} className="opacity-10 group-hover:opacity-100 transition-opacity !bg-cyan-500 !w-3 !h-3" />
            <Handle type="source" position={Position.Bottom} className="opacity-10 group-hover:opacity-100 transition-opacity !bg-cyan-500 !w-3 !h-3" />
            <Handle type="target" position={Position.Left} className="opacity-10 group-hover:opacity-100 transition-opacity !bg-cyan-500 !w-3 !h-3" />
            <Handle type="source" position={Position.Right} className="opacity-10 group-hover:opacity-100 transition-opacity !bg-cyan-500 !w-3 !h-3" />

            <div className={`w-full h-full overflow-hidden rounded-md border-2 ${isNote ? "bg-amber-100/10 border-amber-500/30 text-amber-200" : "bg-white/5 border-white/10"
                }`}>
                {isNote && (
                    <div className="p-4 h-full flex flex-col">
                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                            <StickyNote className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Sticky Note</span>
                        </div>
                        <div className="text-sm font-medium leading-relaxed italic">
                            {data.content || data.label || "Double click to edit note..."}
                        </div>
                    </div>
                )}

                {isImage && (
                    <div className="relative w-full h-full group/media">
                        {data.url ? (
                            <img
                                src={data.url}
                                alt={data.label || "Media"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
                                <ImageIcon className="w-8 h-8" />
                                <span className="text-xs">No image URL</span>
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[10px] text-white opacity-0 group-hover/media:opacity-100 transition-opacity">
                            {data.label || "Image Asset"}
                        </div>
                    </div>
                )}

                {isSvg && (
                    <div className="w-full h-full p-4 flex flex-col items-center justify-center">
                        {data.content ? (
                            <div
                                className="w-full h-full flex items-center justify-center child-svg-full"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(data.content, {
                                        USE_PROFILES: { svg: true, svgFilters: true },
                                    }),
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                <FileCode className="w-8 h-8" />
                                <span className="text-xs">No SVG content</span>
                            </div>
                        )}
                        <div className="text-[10px] text-gray-500 mt-2">SVG Component</div>
                    </div>
                )}
            </div>
        </div>
    );
}
