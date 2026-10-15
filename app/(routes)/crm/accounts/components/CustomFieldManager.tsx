"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Settings2, PackagePlus, Eye, Save, ChevronDown, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { CUSTOM_FIELD_TEMPLATE_PACKS, mergeTemplateFields, groupFieldsByTab, type CustomFieldDefinition } from "@/lib/crm/custom-field-defaults";

export function CustomFieldManager() {
    const router = useRouter();
    const { toast } = useToast();
    const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [templatePackOpen, setTemplatePackOpen] = useState(false);
    const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchFields = async () => {
            setLoading(true);
            try {
                const res = await axios.get("/api/crm/account/custom-fields");
                setFields(res.data.definitions || []);
            } catch (err) {
                toast({ variant: "destructive", title: "Error", description: "Failed to load custom fields" });
            } finally {
                setLoading(false);
            }
        };

        fetchFields();
    }, [toast]);

    const saveFields = async (updatedFields: CustomFieldDefinition[]) => {
        setSaving(true);
        try {
            await axios.put("/api/crm/account/custom-fields", { definitions: updatedFields });
            setFields(updatedFields);
            toast({ title: "Saved", description: "Custom fields updated successfully" });
            router.refresh();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: err.response?.data || "Failed to save custom fields"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlankField = () => {
        const newField: CustomFieldDefinition = {
            key: `custom_${Date.now()}`,
            label: "New Field",
            type: "text",
            tab: "Details",
            order: fields.length,
        };
        const updated = [...fields, newField];
        setFields(updated);
    };

    const handleApplyTemplate = (templateFields: CustomFieldDefinition[]) => {
        const updated = mergeTemplateFields(fields, templateFields);
        setFields(updated);
        saveFields(updated);
        setTemplatePackOpen(false);
    };

    const updateField = (index: number, updates: Partial<CustomFieldDefinition>) => {
        const updated = [...fields];
        updated[index] = { ...updated[index], ...updates };

        // Auto-generate key from label if key is mostly pristine (starts with custom_)
        if (updates.label && updated[index].key.startsWith("custom_")) {
            updated[index].key = updates.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
        }

        setFields(updated);
    };

    const removeField = (index: number) => {
        const updated = fields.filter((_, i) => i !== index);
        setFields(updated);
        saveFields(updated);
    };

    const removeTabGroup = (e: React.MouseEvent, tabName: string) => {
        e.stopPropagation(); // Prevent accordion toggle
        if (!confirm(`Are you sure you want to remove all fields in the "${tabName}" group?`)) return;
        
        const updated = fields.filter(f => f.tab !== tabName);
        setFields(updated);
        saveFields(updated);
    };

    const handleSaveClick = () => {
        saveFields(fields);
    };

    const toggleTab = (tabName: string) => {
        setExpandedTabs(prev => ({
            ...prev,
            [tabName]: prev[tabName] === undefined ? false : !prev[tabName]
        }));
    };

    const toggleCollectionMode = (e: React.MouseEvent, tabName: string) => {
        e.stopPropagation(); // Prevent accordion toggle
        // See if it is currently a collection by checking any field
        const isCurrentlyCollection = fields.some(f => f.tab === tabName && f.isCollection);
        
        const updated = fields.map(f => {
            if (f.tab === tabName) {
                return { ...f, isCollection: !isCurrentlyCollection };
            }
            return f;
        });
        setFields(updated);
        saveFields(updated);
    };

    const groupedFields = groupFieldsByTab(fields);

    return (
        <Card className="bg-background border-white/5">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary" />
                        Account Custom Fields
                    </CardTitle>
                    <CardDescription>
                        Define additional data fields to track on company accounts. Fields are grouped by Tabs in the Account Detail view.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={templatePackOpen} onOpenChange={setTemplatePackOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-primary/5 border-primary/20 text-primary">
                                <PackagePlus className="w-4 h-4 mr-2" />
                                Add Template Pack
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-card border-white/10">
                            <DialogHeader>
                                <DialogTitle>Custom Field Templates</DialogTitle>
                                <DialogDescription>Instantly add pre-configured fields for common CRM workflows.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                {CUSTOM_FIELD_TEMPLATE_PACKS.map(pack => (
                                    <div key={pack.id} className="border border-white/10 rounded-xl p-4 bg-background/50 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => handleApplyTemplate(pack.fields)}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                                <PackagePlus className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground">{pack.name}</h4>
                                                <p className="text-xs text-muted-foreground">{pack.fields.length} fields on "{pack.fields[0]?.tab}" tab</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2">{pack.description}</p>
                                        <div className="mt-3 flex gap-1 flex-wrap">
                                            {pack.fields.slice(0, 3).map(f => (
                                                <span key={f.key} className="text-[9px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-white/50">{f.label}</span>
                                            ))}
                                            {pack.fields.length > 3 && <span className="text-[9px] uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-white/50">+{pack.fields.length - 3} more</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={handleAddBlankField} className="border-white/10">
                        <Plus className="w-4 h-4 mr-2" />
                        Blank Field
                    </Button>
                    <Button size="sm" onClick={handleSaveClick} disabled={saving || loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <div className="h-16 w-full bg-muted/20 animate-pulse rounded-md" />
                        <div className="h-16 w-full bg-muted/20 animate-pulse rounded-md" />
                    </div>
                ) : fields.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/20 mx-auto flex items-center justify-center mb-4">
                            <Settings2 className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">No Custom Fields</h4>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">You haven't added any custom fields yet. Start from scratch or use a template pack to track deeper account metrics.</p>
                        <Button variant="outline" onClick={() => setTemplatePackOpen(true)}>
                            <PackagePlus className="w-4 h-4 mr-2" />
                            Browse Templates
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8 p-6">
                        {Object.entries(groupedFields).map(([tabName, tabFields]) => {
                            const isExpanded = expandedTabs[tabName] !== false; // true by default
                            return (
                            <div key={tabName} className="space-y-4">
                                <div 
                                    className="group flex items-center justify-between pb-2 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors"
                                    onClick={() => toggleTab(tabName)}
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                        <h3 className="text-sm font-bold tracking-wide text-foreground">Tab: {tabName}</h3>
                                        <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{tabFields.length} fields</span>
                                        {tabFields[0]?.isCollection && (
                                            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded uppercase tracking-wider font-bold ml-2">Repeatable</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button 
                                            variant={tabFields[0]?.isCollection ? "default" : "ghost"} 
                                            size="sm" 
                                            className={`h-7 text-xs transition-opacity ${tabFields[0]?.isCollection ? "bg-indigo-500 hover:bg-indigo-600 text-white" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-white/10"}`}
                                            onClick={(e) => toggleCollectionMode(e, tabName)}
                                        >
                                            <ListTree className="w-3.5 h-3.5 mr-1" />
                                            {tabFields[0]?.isCollection ? "Collection" : "Make Repeatable"}
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => removeTabGroup(e, tabName)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                                            Remove Group
                                        </Button>
                                    </div>
                                </div>
                                {isExpanded && (
                                <div className="space-y-3">
                                    {tabFields.map((field) => {
                                        const originalIndex = fields.findIndex(f => f.key === field.key);
                                        return (
                                            <div key={field.key} className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-background shadow-sm group hover:border-white/10 transition-colors">
                                                <div className="pt-2 cursor-grab opacity-30 group-hover:opacity-100">
                                                    <GripVertical className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-3 space-y-1.5">
                                                        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Label</label>
                                                        <Input
                                                            value={field.label}
                                                            onChange={(e) => updateField(originalIndex, { label: e.target.value })}
                                                            className="h-8 text-xs bg-black/20"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-3 space-y-1.5">
                                                        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Internal Key</label>
                                                        <Input
                                                            value={field.key}
                                                            onChange={(e) => updateField(originalIndex, { key: e.target.value })}
                                                            className="h-8 text-xs bg-black/20 font-mono"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1.5">
                                                        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Type</label>
                                                        <Select value={field.type} onValueChange={(val: any) => updateField(originalIndex, { type: val })}>
                                                            <SelectTrigger className="h-8 text-xs bg-black/20">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="text">Text (short)</SelectItem>
                                                                <SelectItem value="textarea">Text (long)</SelectItem>
                                                                <SelectItem value="number">Number</SelectItem>
                                                                <SelectItem value="currency">Currency</SelectItem>
                                                                <SelectItem value="date">Date</SelectItem>
                                                                <SelectItem value="select">Dropdown</SelectItem>
                                                                <SelectItem value="url">URL Link</SelectItem>
                                                                <SelectItem value="email">Email</SelectItem>
                                                                <SelectItem value="phone">Phone</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="md:col-span-3 space-y-1.5">
                                                        <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Target Tab</label>
                                                        <Input
                                                            value={field.tab}
                                                            onChange={(e) => updateField(originalIndex, { tab: e.target.value })}
                                                            className="h-8 text-xs bg-black/20"
                                                            placeholder="e.g. Activity, Sales"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-1 flex items-end justify-end">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => removeField(originalIndex)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="md:col-span-12">
                                                        <Input
                                                            value={field.description || ""}
                                                            onChange={(e) => updateField(originalIndex, { description: e.target.value })}
                                                            placeholder="Help text for the user (optional)"
                                                            className="h-8 text-xs bg-transparent border-dashed border-white/10 italic text-muted-foreground/70"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                )}
                            </div>
                        )})}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
