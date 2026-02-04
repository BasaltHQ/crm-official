"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Sparkles, Loader2, ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { saveReport } from "@/actions/reports/save-report";
import { toast } from "sonner";

interface AISummaryModalProps {
  data: any;
}

export function AISummaryModal({ data }: AISummaryModalProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced options state
  const [reportType, setReportType] = useState("executive");
  const [formatStyle, setFormatStyle] = useState("detailed");
  const [includeRevenue, setIncludeRevenue] = useState(true);
  const [includeLeads, setIncludeLeads] = useState(true);
  const [includeOpps, setIncludeOpps] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);

  const { complete, completion, isLoading } = useCompletion({
    api: "/api/reports/generate",
  });

  const handleSave = async () => {
    if (!completion || !title) {
      toast.error("Please provide a title and generate content first.");
      return;
    }

    setIsSaving(true);
    const res = await saveReport({
      title,
      content: completion,
      prompt,
      filters: {
        ...data,
        reportType,
        formatStyle,
        sections: { includeRevenue, includeLeads, includeOpps, includeTasks }
      }
    });
    setIsSaving(false);

    if (res.success) {
      toast.success("Report saved successfully!");
      setOpen(false);
      // Reset form
      setPrompt("");
      setTitle("");
    } else {
      toast.error("Failed to save report.");
    }
  };

  const handleGenerate = () => {
    // Build enhanced prompt with advanced options
    const sections = [];
    if (includeRevenue) sections.push("revenue");
    if (includeLeads) sections.push("leads");
    if (includeOpps) sections.push("opportunities");
    if (includeTasks) sections.push("tasks");

    complete("", {
      body: {
        data: data,
        userPrompt: prompt,
        reportType,
        formatStyle,
        includeSections: sections
      }
    });
  };

  const resetForm = () => {
    setPrompt("");
    setTitle("");
    setAdvancedOpen(false);
    setReportType("executive");
    setFormatStyle("detailed");
    setIncludeRevenue(true);
    setIncludeLeads(true);
    setIncludeOpps(true);
    setIncludeTasks(true);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Sparkles className="w-4 h-4 mr-2" />
          Create AI Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] bg-card text-card-foreground border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-500" />
            AI Report Generator
          </DialogTitle>
          <DialogDescription>
            Create a custom insight report powered by AI based on your current dashboard data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Advanced Options - Collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto border border-border/50 hover:bg-muted/50">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="w-4 h-4" />
                  Advanced Options
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4 px-1">
              {/* Report Type */}
              <div className="grid gap-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive Summary</SelectItem>
                    <SelectItem value="trend">Trend Analysis</SelectItem>
                    <SelectItem value="performance">Performance Review</SelectItem>
                    <SelectItem value="forecast">Forecast Report</SelectItem>
                    <SelectItem value="comparison">Period Comparison</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format Style */}
              <div className="grid gap-2">
                <Label>Format Style</Label>
                <Select value={formatStyle} onValueChange={setFormatStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detailed">Detailed Narrative</SelectItem>
                    <SelectItem value="brief">Brief Summary</SelectItem>
                    <SelectItem value="bullets">Bullet Points</SelectItem>
                    <SelectItem value="metrics">Metrics Focused</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Include Sections */}
              <div className="grid gap-3">
                <Label>Include in Report</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="revenue"
                      checked={includeRevenue}
                      onCheckedChange={(checked) => setIncludeRevenue(checked as boolean)}
                    />
                    <label htmlFor="revenue" className="text-sm cursor-pointer">Revenue Data</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="leads"
                      checked={includeLeads}
                      onCheckedChange={(checked) => setIncludeLeads(checked as boolean)}
                    />
                    <label htmlFor="leads" className="text-sm cursor-pointer">Leads Data</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="opps"
                      checked={includeOpps}
                      onCheckedChange={(checked) => setIncludeOpps(checked as boolean)}
                    />
                    <label htmlFor="opps" className="text-sm cursor-pointer">Opportunities</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tasks"
                      checked={includeTasks}
                      onCheckedChange={(checked) => setIncludeTasks(checked as boolean)}
                    />
                    <label htmlFor="tasks" className="text-sm cursor-pointer">Tasks Data</label>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Custom Focus Prompt */}
          <div className="grid gap-2">
            <Label htmlFor="prompt">Custom Focus (Optional)</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., Focus on the drop in leads compared to last month and suggest marketing adjustments."
              value={prompt}
              onChange={(e: any) => setPrompt(e.target.value)}
              className="resize-none h-24"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground animate-pulse">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing report data...
            </div>
          )}

          {/* Generated Report Display */}
          {completion && (
            <div className="rounded-md bg-muted/50 p-4 max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert">
              {completion.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!completion ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={handleGenerate} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                <Sparkles className="w-4 h-4 mr-2" />
                {isLoading ? "Generating..." : "Generate Report"}
              </Button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Report Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Button onClick={handleSave} disabled={isSaving} variant="secondary">
                  {isSaving ? "Saving..." : "Save to Library"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Close</Button>
                <Button variant="ghost" onClick={handleGenerate} disabled={isLoading} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
