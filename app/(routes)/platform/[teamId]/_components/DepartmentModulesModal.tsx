"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Layers, Check, X as XIcon, Lock, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CRM_MODULES, CrmModule } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    departmentId: string;
    departmentName: string;
}

function getAllModuleIds(modules: CrmModule[]): string[] {
    let ids: string[] = [];
    modules.forEach(m => {
        ids.push(m.id);
        if (m.children) ids = [...ids, ...getAllModuleIds(m.children)];
    });
    return ids;
}

export function DepartmentModulesModal({ isOpen, onClose, departmentId, departmentName }: Props) {
    const [selected, setSelected] = useState<string[]>([]);
    const [parentLimits, setParentLimits] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const isSuperAdmin = parentLimits.includes('all');

    const allModuleIds = useMemo(() => getAllModuleIds(CRM_MODULES), []);

    useEffect(() => {
        if (isOpen && departmentId) {
            setIsFetching(true);
            fetch(`/api/departments/${departmentId}/modules`)
                .then((res) => res.json())
                .then((data) => {
                    setSelected(data.modules || []);
                    setParentLimits(data.parentLimits || []);
                })
                .catch(() => toast.error("Failed to load modules"))
                .finally(() => setIsFetching(false));
        }
    }, [isOpen, departmentId]);

    const toggleModule = (moduleId: string, children?: CrmModule[]) => {
        setSelected((prev) => {
            const isSelected = prev.includes(moduleId);
            let next = new Set(prev);

            if (isSelected) {
                // Deselect current and all children gracefully
                next.delete(moduleId);
                if (children) {
                    const childIds = getAllModuleIds(children);
                    childIds.forEach(id => next.delete(id));
                }
            } else {
                // Select current
                next.add(moduleId);
                // We do NOT auto-select all children unless they want it, but for UI simplicity,
                // selecting a parent doesn't force select children unless they specifically click them?
                // Actually, often checking a parent auto-checks children. Let's keep it simple: just check what they clicked.
            }
            return Array.from(next);
        });
    };

    const selectAll = () => setSelected(
        allModuleIds.filter(id => isSuperAdmin || parentLimits.includes(id) || parentLimits.includes(`${id}.view`))
    );
    
    const clearAll = () => setSelected([]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/departments/${departmentId}/modules`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modules: selected }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to save modules");
            } else {
                toast.success(`Module access updated for ${departmentName}`);
                onClose();
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const renderModule = (mod: CrmModule, depth: number = 0) => {
        const isActive = selected.includes(mod.id);
        const isLocked = !isSuperAdmin && !parentLimits.includes(mod.id) && !parentLimits.includes(`${mod.id}.view`);

        return (
            <div key={mod.id} className={cn("flex flex-col w-full", depth > 0 && "pl-6 border-l-2 border-border/40 ml-4 py-0.5 mt-1")}>
                <button
                    type="button"
                    onClick={(e) => {
                        if (isLocked) {
                            e.preventDefault();
                            toast.error("Organization must upgrade to enable this module.");
                            return;
                        }
                        toggleModule(mod.id, mod.children);
                    }}
                    className={cn(
                        "flex items-center justify-between p-2 rounded-lg border border-transparent text-left transition-all duration-200 group",
                        depth === 0 ? "bg-card/50 hover:bg-muted/40 mb-1 border-border/50" : "hover:bg-muted/30",
                        isActive && depth === 0 && "bg-primary/5 border-primary/20",
                        isLocked && "opacity-60 grayscale cursor-not-allowed hidden md:flex"
                    )}
                >
                    <div className="flex items-center gap-3">
                        {depth === 0 && (
                            <div
                                className={cn(
                                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0",
                                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}
                            >
                                <Layers className="w-3.5 h-3.5" />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <p className={cn("font-medium", depth === 0 ? "text-sm" : "text-xs")}>{mod.name}</p>
                                {isLocked && (
                                    <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-[2px] rounded flex items-center gap-1 border border-border/50 uppercase font-bold w-fit leading-tight mt-0.5 shadow-sm">
                                        <Lock className="w-2.5 h-2.5" />
                                        Upgrade
                                    </span>
                                )}
                            </div>
                            {mod.description && depth === 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Selected Indicator */}
                        <div
                            className={cn(
                                "w-4 h-4 rounded-sm border flex items-center justify-center transition-all shrink-0 shadow-sm",
                                isActive ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background",
                                isLocked ? "border-muted-foreground/10" : ""
                            )}
                        >
                            {isActive && <Check className="w-3 h-3" />}
                            {isLocked && !isActive && <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />}
                        </div>
                    </div>
                </button>
                
                {mod.children && mod.children.length > 0 && (
                    <div className="flex flex-col w-full">
                        {mod.children.map((child: string | CrmModule) => {
                             // Assuming children is typed as CrmModule[] based on role-permissions.ts
                             return renderModule(child as CrmModule, depth + 1);
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed">
                        Department Modules
                    </DialogTitle>
                    <DialogDescription className="mt-1.5">
                        Configure granular feature access for <strong>{departmentName}</strong> personnel.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 flex items-center justify-between pb-3 border-b shrink-0 bg-background/50 z-10 relative">
                    <Badge variant="secondary" className="text-xs font-mono">
                        {selected.length} / {allModuleIds.length} nodes enabled
                    </Badge>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7 hover:bg-primary/10 hover:text-primary">
                            Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 hover:bg-destructive/10 hover:text-destructive">
                            Clear All
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {isFetching ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-medium animate-pulse">
                            Loading module registry...
                        </div>
                    ) : (
                        <ScrollArea className="h-full px-6 py-4 custom-scrollbar">
                            <div className="grid gap-2 pb-8">
                                {CRM_MODULES.map((mod) => renderModule(mod))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-4 border-t shrink-0 bg-background/50 backdrop-blur-md">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || isFetching} className="min-w-[140px] font-semibold">
                        {isLoading ? "Saving Pipeline..." : "Save Configuration"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
