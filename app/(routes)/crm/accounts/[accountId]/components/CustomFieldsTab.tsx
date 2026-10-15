"use client";

import React, { useState, useCallback, useMemo } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Check, Pencil, X, DollarSign, Calendar, Type, Hash, Link, Mail, Phone, Plus, Trash2 } from "lucide-react";
import type { CustomFieldDefinition } from "@/lib/crm/custom-field-defaults";

interface CustomFieldsTabProps {
    accountId: string;
    definitions: CustomFieldDefinition[];
    values: Record<string, any>;
    tabName: string;
}

const FIELD_TYPE_ICON: Record<string, any> = {
    text: Type,
    textarea: Type,
    number: Hash,
    date: Calendar,
    currency: DollarSign,
    url: Link,
    email: Mail,
    phone: Phone,
    select: Type,
};

export function CustomFieldsTab({ accountId, definitions, values, tabName }: CustomFieldsTabProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<any>("");
    
    // Collection Edit State
    const [editingCollectionIndex, setEditingCollectionIndex] = useState<number | null>(null);
    const [editCollectionObj, setEditCollectionObj] = useState<any>({});
    
    const [saving, setSaving] = useState(false);

    const tabFields = definitions
        .filter(d => d.tab === tabName)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    const isCollection = tabFields[0]?.isCollection;
    const collectionData: any[] = useMemo(() => {
        return isCollection ? (Array.isArray(values[tabName]) ? values[tabName] : []) : [];
    }, [isCollection, values, tabName]);

    const startEdit = useCallback((key: string, currentValue: any) => {
        setEditingKey(key);
        setEditValue(currentValue ?? "");
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingKey(null);
        setEditValue("");
    }, []);

    const saveField = useCallback(async (key: string) => {
        setSaving(true);
        try {
            const updatedFields = { ...values, [key]: editValue };
            await axios.put("/api/crm/account", {
                id: accountId,
                custom_fields: updatedFields,
            });
            toast({ title: "Saved", description: "Custom field updated successfully" });
            setEditingKey(null);
            router.refresh();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save field" });
        } finally {
            setSaving(false);
        }
    }, [accountId, editValue, values, router, toast]);

    const startCollectionEdit = useCallback((index: number, currentObj: any) => {
        setEditingCollectionIndex(index);
        setEditCollectionObj(currentObj || {});
    }, []);

    const cancelCollectionEdit = useCallback(() => {
        setEditingCollectionIndex(null);
        setEditCollectionObj({});
    }, []);

    const saveCollectionEntry = useCallback(async (index: number) => {
        setSaving(true);
        try {
            const newArray = [...collectionData];
            if (index >= newArray.length) {
                newArray.push(editCollectionObj);
            } else {
                newArray[index] = editCollectionObj;
            }
            const updatedFields = { ...values, [tabName]: newArray };
            await axios.put("/api/crm/account", {
                id: accountId,
                custom_fields: updatedFields,
            });
            toast({ title: "Saved", description: "Entry updated successfully" });
            setEditingCollectionIndex(null);
            router.refresh();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save entry" });
        } finally {
            setSaving(false);
        }
    }, [accountId, collectionData, editCollectionObj, values, tabName, router, toast]);

    const removeCollectionEntry = useCallback(async (index: number) => {
        if (!confirm("Are you sure you want to remove this entry?")) return;
        setSaving(true);
        try {
            const newArray = collectionData.filter((_, i) => i !== index);
            const updatedFields = { ...values, [tabName]: newArray };
            await axios.put("/api/crm/account", {
                id: accountId,
                custom_fields: updatedFields,
            });
            toast({ title: "Removed", description: "Entry removed successfully" });
            router.refresh();
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to remove entry" });
        } finally {
            setSaving(false);
        }
    }, [accountId, collectionData, values, tabName, router, toast]);

    const renderFieldInput = (def: CustomFieldDefinition, isColl: boolean = false) => {
        const val = isColl ? editCollectionObj[def.key] : editValue;
        const setVal = (newVal: any) => isColl ? setEditCollectionObj({ ...editCollectionObj, [def.key]: newVal }) : setEditValue(newVal);
        switch (def.type) {
            case "textarea":
                return (
                    <Textarea
                        value={val || ""}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={def.placeholder}
                        className="min-h-[80px] text-sm bg-background/50 border-white/10"
                        autoFocus={!isColl}
                    />
                );
            case "select":
                return (
                    <Select value={val || ""} onValueChange={setVal}>
                        <SelectTrigger className="h-9 bg-background/50 border-white/10">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            {def.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case "date":
                return (
                    <Input
                        type="date"
                        value={val || ""}
                        onChange={(e) => setVal(e.target.value)}
                        className="h-9 bg-background/50 border-white/10"
                        autoFocus={!isColl}
                    />
                );
            case "number":
                return (
                    <Input
                        type="number"
                        value={val || ""}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={def.placeholder}
                        className="h-9 bg-background/50 border-white/10"
                        autoFocus={!isColl}
                    />
                );
            case "currency":
                return (
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            type="number"
                            step="0.01"
                            value={val || ""}
                            onChange={(e) => setVal(e.target.value)}
                            placeholder={def.placeholder}
                            className="h-9 pl-7 bg-background/50 border-white/10"
                            autoFocus={!isColl}
                        />
                    </div>
                );
            case "url":
                return (
                    <Input
                        type="url"
                        value={val || ""}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={def.placeholder || "https://..."}
                        className="h-9 bg-background/50 border-white/10"
                        autoFocus={!isColl}
                    />
                );
            default:
                return (
                    <Input
                        value={val || ""}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={def.placeholder}
                        className="h-9 bg-background/50 border-white/10"
                        autoFocus={!isColl}
                    />
                );
        }
    };

    const formatDisplayValue = (def: CustomFieldDefinition, value: any) => {
        if (value === null || value === undefined || value === "") {
            return <span className="text-muted-foreground/40 italic text-xs">Not set</span>;
        }
        switch (def.type) {
            case "currency":
                return <span className="font-mono">${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>;
            case "date":
                try {
                    return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
                } catch {
                    return value;
                }
            case "select": {
                const opt = def.options?.find(o => o.value === value);
                return opt?.label || value;
            }
            case "url":
                return (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                        {value}
                    </a>
                );
            default:
                return <span className="whitespace-pre-wrap">{String(value)}</span>;
        }
    };

    if (tabFields.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                    <Type className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground/60 font-medium">No custom fields configured for this tab</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Add fields from the Custom Fields manager</p>
            </div>
        );
    }

    if (isCollection) {
        return (
            <div className="space-y-4">
                {collectionData.length === 0 && editingCollectionIndex === null && (
                    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                        <p className="text-sm text-muted-foreground/60">No entries yet.</p>
                    </div>
                )}
                
                {collectionData.map((item, index) => {
                    const isEditing = editingCollectionIndex === index;
                    
                    return (
                        <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-4 transition-all">
                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Entry #{index + 1}</h4>
                                <div className="flex items-center gap-1">
                                    {!isEditing && (
                                        <>
                                            <Button variant="ghost" size="sm" onClick={() => startCollectionEdit(index, item)} className="h-6 w-6 p-0 text-muted-foreground hover:text-white">
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => removeCollectionEntry(index)} className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10">
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className={isEditing ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6"}>
                                {tabFields.map(def => {
                                    const val = item[def.key];
                                    const Icon = FIELD_TYPE_ICON[def.type] || Type;
                                    
                                    return (
                                        <div key={def.key} className={isEditing ? "space-y-2" : "space-y-1"}>
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 flex items-center justify-center shrink-0">
                                                    <Icon className="w-3 h-3 text-muted-foreground/50" />
                                                </div>
                                                <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">{def.label}</label>
                                            </div>
                                            {isEditing ? (
                                                <div className="pl-6">
                                                    {renderFieldInput(def, true)}
                                                </div>
                                            ) : (
                                                <div className="pl-6 text-sm text-foreground/80">
                                                    {formatDisplayValue(def, val)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {isEditing && (
                                <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-white/5">
                                    <Button size="sm" variant="ghost" onClick={cancelCollectionEdit} className="h-8 text-xs">
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => saveCollectionEntry(index)} disabled={saving} className="h-8 px-4 text-xs">
                                        {saving ? "Saving..." : "Save Entry"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {editingCollectionIndex === collectionData.length && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="mb-4 pb-3 border-b border-white/5">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-widest">New Entry</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {tabFields.map(def => (
                                <div key={def.key} className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">{def.label}</label>
                                    {renderFieldInput(def, true)}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-white/5">
                            <Button size="sm" variant="ghost" onClick={cancelCollectionEdit} className="h-8 text-xs">
                                Cancel
                            </Button>
                            <Button size="sm" onClick={() => saveCollectionEntry(collectionData.length)} disabled={saving} className="h-8 px-4 text-xs">
                                {saving ? "Saving..." : "Save New Entry"}
                            </Button>
                        </div>
                    </div>
                )}
                
                {editingCollectionIndex === null && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => startCollectionEdit(collectionData.length, {})} 
                        className="w-full bg-white/[0.02] border-white/10 hover:bg-white/[0.05] border-dashed text-xs py-5"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add New {tabName} Entry
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {tabFields.map(def => {
                const currentValue = values[def.key];
                const isEditing = editingKey === def.key;
                const Icon = FIELD_TYPE_ICON[def.type] || Type;

                return (
                    <div
                        key={def.key}
                        className={cn(
                            "group rounded-xl border border-transparent transition-all duration-200",
                            isEditing
                                ? "border-primary/20 bg-primary/5 p-4"
                                : "hover:bg-white/[0.02] p-4"
                        )}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-5 w-5 rounded-md bg-muted/20 flex items-center justify-center shrink-0">
                                        <Icon className="w-3 h-3 text-muted-foreground/50" />
                                    </div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                                        {def.label}
                                    </label>
                                    {def.required && (
                                        <span className="text-[9px] text-red-400 font-bold">REQ</span>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="mt-2 space-y-2">
                                        {renderFieldInput(def)}
                                        {def.description && (
                                            <p className="text-[10px] text-muted-foreground/40">{def.description}</p>
                                        )}
                                        <div className="flex items-center gap-1.5 pt-1">
                                            <Button
                                                size="sm"
                                                onClick={() => saveField(def.key)}
                                                disabled={saving}
                                                className="h-7 px-3 text-xs font-bold"
                                            >
                                                <Check className="w-3 h-3 mr-1" />
                                                Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={cancelEdit}
                                                className="h-7 px-3 text-xs"
                                            >
                                                <X className="w-3 h-3 mr-1" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-foreground/80 mt-0.5 pl-7">
                                        {formatDisplayValue(def, currentValue)}
                                    </div>
                                )}
                            </div>

                            {!isEditing && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEdit(def.key, currentValue)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0"
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
