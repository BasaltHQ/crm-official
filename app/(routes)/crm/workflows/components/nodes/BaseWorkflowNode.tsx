import { Handle, Position, NodeResizer, useNodeId, useReactFlow } from "@xyflow/react";
import { LucideIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BaseWorkflowNode — Composition Pattern: Compound Component
 *
 * Extracts the shared structure from 7 workflow node components:
 * TriggerNode, ActionNode, ConditionNode, DelayNode, ScreenNode,
 * UpdateRecordNode, and MediaNode.
 *
 * Each node had identical code for:
 *   - Shape calculation (rounded/capsule/square)
 *   - NodeResizer rendering when selected
 *   - Handle positioning (top/bottom)
 *   - Icon + label layout
 *
 * This reduces ~350 lines of duplicated code to a single configurable
 * component, and makes adding new node types trivial.
 */

export type NodeShape = "rounded" | "capsule" | "square";

interface HandleConfig {
    type: "source" | "target";
    position: Position;
    id?: string;
    style?: React.CSSProperties;
    className: string;
}

interface BaseWorkflowNodeProps {
    // Node data
    label?: string;
    defaultLabel: string;
    selected?: boolean;

    // Theming
    nodeType: string;          // e.g. "Trigger", "Action", "Decision"
    icon: LucideIcon;
    shape?: NodeShape;
    bgColor: string;           // Unused in new design (kept for compatibility)
    borderColor: string;       // Unused in new design (kept for compatibility)
    accentColor: string;       // e.g. "text-emerald-400" (for icon and text)
    labelColor: string;        // e.g. "text-emerald-50" (for main label text)
    resizerColor: string;      // e.g. "#10b981" (Used for glow)
    resizerBorderClass: string; // e.g. "!border-emerald-500"

    // Icon background
    iconBgColor: string;       // Unused in new design (kept for compatibility)

    // Handles
    handles: HandleConfig[];

    // Optional footer (e.g. True/False labels on ConditionNode)
    footer?: React.ReactNode;

    // Additional content (e.g. field list on ScreenNode)
    children?: React.ReactNode;

    // Layout variant (mostly unused in terminal layout, but kept)
    layout?: "row" | "column";  
}

export function BaseWorkflowNode({
    label,
    defaultLabel,
    selected,
    nodeType,
    icon: Icon,
    shape = "rounded",
    accentColor,
    resizerColor,
    resizerBorderClass,
    handles,
    footer,
    children,
    layout = "row",
}: BaseWorkflowNodeProps) {
    const nodeId = useNodeId();
    const { setNodes, setEdges } = useReactFlow();

    const shapeClass =
        shape === "capsule" ? "rounded-[30px]" :
            shape === "square" ? "rounded-none" :
                "rounded-xl";

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (nodeId) {
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
        }
    };

    return (
        <div 
            className={cn(
                "group font-mono relative transition-colors duration-500 w-full h-full min-w-[240px] min-h-[150px]",
            )}
        >
            {/* Visual Shell (with overflow hidden to clip gradients, but leaves handles outside untouched) */}
            <div className={cn(
                "absolute inset-0 bg-[#050608]/90 backdrop-blur-xl border overflow-hidden flex flex-col",
                shapeClass,
                selected ? "border-white/20" : "border-white/5 group-hover:border-white/10"
            )}
            style={{
                boxShadow: selected 
                    ? `0 0 40px -5px ${resizerColor}60, inset 0 0 20px -10px ${resizerColor}30` 
                    : `0 0 15px -5px ${resizerColor}20, inset 0 0 10px -10px ${resizerColor}10`,
            }}>
                
                {/* Ambient Animated Overlay */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
                
                {/* Top Accent Bar */}
                <div className="absolute top-0 left-0 w-full h-[2px] z-20" style={{ background: `linear-gradient(90deg, transparent, ${resizerColor}, transparent)` }} />

                {/* Terminal Header */}
                <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 blur-[8px] opacity-60" style={{ backgroundColor: resizerColor }} />
                            <Icon className={cn("h-4 w-4 relative z-10 drop-shadow-[0_0_5px_currentColor]", accentColor)} />
                        </div>
                        <div className="flex flex-col">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate max-w-[160px] drop-shadow-md">
                                {label || defaultLabel}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_5px_currentColor]" style={{ backgroundColor: resizerColor, color: resizerColor }} />
                                <span className="text-[8px] text-white/30 uppercase tracking-widest font-semibold">{nodeType}</span>
                            </div>
                        </div>
                    </div>
                    <div onClick={handleDelete} className="p-1.5 rounded bg-black/40 hover:bg-rose-500/20 cursor-pointer text-white/30 hover:text-rose-400 transition-all border border-white/5 hover:border-rose-500/30">
                        <Trash2 className="w-3 h-3" />
                    </div>
                </div>

                {/* Main Terminal Body */}
                <div className="relative z-10 p-4 flex-1 flex flex-col gap-3 min-h-[60px]">
                    {children ? children : (
                        <div className="flex-1 border border-white/5 rounded-lg bg-black/40 shadow-inner flex items-center justify-center p-4 relative overflow-hidden group-hover:border-white/10 transition-colors">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                            <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-white/20 relative z-10 mix-blend-screen pointer-events-none">
                                {"// NO CONF ARGS"}
                            </span>
                        </div>
                    )}
                </div>

                {/* Common Action Footer button if no children supplied */}
                {!children && (
                    <div className="px-4 pb-4 relative z-10">
                        <div 
                            className="w-full py-2.5 rounded hover:brightness-125 transition-all text-[9.5px] font-black uppercase tracking-[0.2em] text-center border shadow-[inset_0_1px_rgba(255,255,255,0.1)] cursor-pointer backdrop-blur-md relative overflow-hidden group/btn"
                            style={{
                                background: `linear-gradient(180deg, ${resizerColor}20, ${resizerColor}05)`,
                                borderColor: `${resizerColor}40`,
                                color: resizerColor,
                                textShadow: `0 0 10px ${resizerColor}80`
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover/btn:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                            Execute Module
                        </div>
                    </div>
                )}

                {/* Optional footer */}
                {footer}
            </div>

            {/* React Flow UI layering (MUST BE OUTSIDE OF OVERFLOW:HIDDEN) */}
            {selected && (
                <NodeResizer
                    color={resizerColor}
                    isVisible={selected}
                    minWidth={240}
                    minHeight={150}
                    lineClassName="hidden"
                    handleClassName={cn("!w-2 !h-2 !bg-[#050608] !border-2 !z-50", resizerBorderClass)}
                />
            )}

            {/* Render all handles */}
            {handles.map((handle, idx) => {
                // Strip out buggy transform classes that override React Flow's inline translation
                const safeClassName = handle.className
                    .replace('!bg-', '')
                    .replace('border-', '')
                    .replace('hover:!scale-125', '')
                    .replace('transition-transform', '')
                    .replace(' hover:!scale-125 ', '')
                    .replace(' transition-transform ', '');

                return (
                    <Handle
                        key={handle.id || `${handle.type}-${handle.position}-${idx}`}
                        type={handle.type}
                        position={handle.position}
                        id={handle.id}
                        style={{
                            ...handle.style,
                            backgroundColor: '#050608',
                            borderColor: resizerColor,
                            borderWidth: '2px',
                            width: '14px',
                            height: '14px',
                            boxShadow: `0 0 8px ${resizerColor}80`
                        }}
                        className={cn(safeClassName, "!z-50 transition-all hover:brightness-150 hover:shadow-[0_0_15px_currentColor]")}
                    />
                );
            })}
        </div>
    );
}
