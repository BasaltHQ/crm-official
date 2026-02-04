"use client";

import { useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Node,
    Edge,
    BackgroundVariant,
    Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Save,
    Play,
    Pause,
    Loader2,
} from "lucide-react";
import { activateWorkflow, pauseWorkflow, updateWorkflow } from "@/actions/crm/workflows";
import { toast } from "sonner";

// Custom node components
import { TriggerNode } from "./nodes/TriggerNode";
import { DelayNode } from "./nodes/DelayNode";
import { ActionNode } from "./nodes/ActionNode";
import { NodePalette } from "./NodePalette";

interface Workflow {
    id: string;
    name: string;
    description: string | null;
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
    trigger_type: string;
    nodes: unknown;
    edges: unknown;
}

interface WorkflowEditorProps {
    workflow: Workflow;
}

// Use Record<string, any> to satisfy React Flow's flexible node type requirements
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
    trigger: TriggerNode,
    delay: DelayNode,
    action: ActionNode,
};

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [activating, setActivating] = useState(false);

    // Parse nodes and edges from workflow
    const initialNodes = useMemo(() => {
        try {
            return (workflow.nodes as Node[]) || [];
        } catch {
            return [];
        }
    }, [workflow.nodes]);

    const initialEdges = useMemo(() => {
        try {
            return (workflow.edges as Edge[]) || [];
        } catch {
            return [];
        }
    }, [workflow.edges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const handleSave = async () => {
        setSaving(true);
        // Cast nodes/edges to JSON-compatible format
        const result = await updateWorkflow(workflow.id, {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
        });

        if (result.success) {
            toast.success("Workflow saved");
        } else {
            toast.error(result.error || "Failed to save");
        }
        setSaving(false);
    };

    const handleToggleStatus = async () => {
        setActivating(true);

        // Save first before activating
        await updateWorkflow(workflow.id, {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges))
        });

        const result = workflow.status === "ACTIVE"
            ? await pauseWorkflow(workflow.id)
            : await activateWorkflow(workflow.id);

        if (result.success) {
            toast.success(workflow.status === "ACTIVE" ? "Workflow paused" : "Workflow activated");
            router.refresh();
        } else {
            toast.error(result.error || "Failed to update status");
        }
        setActivating(false);
    };

    const addNode = (type: string, label: string) => {
        const newNode: Node = {
            id: `${type}-${Date.now()}`,
            type,
            position: {
                x: 250 + Math.random() * 100,
                y: 150 + nodes.length * 100
            },
            data: { label },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const statusBadge: Record<string, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
        DRAFT: { label: "Draft", variant: "secondary" },
        ACTIVE: { label: "Active", variant: "default" },
        PAUSED: { label: "Paused", variant: "outline" },
        ARCHIVED: { label: "Archived", variant: "destructive" },
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-card">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/crm/workflows")}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold">{workflow.name}</h1>
                            <Badge variant={statusBadge[workflow.status]?.variant || "secondary"}>
                                {statusBadge[workflow.status]?.label || workflow.status}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {workflow.description || "No description"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                    <Button
                        onClick={handleToggleStatus}
                        disabled={activating}
                        variant={workflow.status === "ACTIVE" ? "outline" : "default"}
                    >
                        {activating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : workflow.status === "ACTIVE" ? (
                            <Pause className="mr-2 h-4 w-4" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        {workflow.status === "ACTIVE" ? "Pause" : "Activate"}
                    </Button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    snapToGrid
                    snapGrid={[15, 15]}
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: "#f97316", strokeWidth: 2 },
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                    <Controls />

                    {/* Node Palette */}
                    <Panel position="top-left" className="m-4">
                        <NodePalette onAddNode={addNode} />
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
}
