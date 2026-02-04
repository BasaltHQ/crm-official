"use client";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Trash2, Calendar, Eye, FolderOpen } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteReport } from "@/actions/reports/delete-report";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SavedReport {
    id: string;
    title: string;
    content: string;
    prompt?: string | null;
    createdAt: Date;
}

interface CustomReportsPanelProps {
    savedReports: SavedReport[];
}

export function CustomReportsPanel({ savedReports }: CustomReportsPanelProps) {
    const [open, setOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
    const [reportToDelete, setReportToDelete] = useState<SavedReport | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleDelete = async () => {
        if (!reportToDelete) return;

        startTransition(async () => {
            const result = await deleteReport(reportToDelete.id);
            if (result.success) {
                toast.success("Report deleted successfully");
                setReportToDelete(null);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to delete report");
            }
        });
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Custom Reports
                        {savedReports.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {savedReports.length}
                            </span>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Your Custom Reports
                        </SheetTitle>
                        <SheetDescription>
                            View and manage your AI-generated custom reports.
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea className="h-[calc(100vh-150px)] mt-6 pr-4">
                        {savedReports.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <FileText className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium">No reports yet</p>
                                <p className="text-sm mt-1">
                                    Generate and save your first AI report to see it here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {savedReports.map((report) => (
                                    <div
                                        key={report.id}
                                        className="group relative rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm truncate">
                                                    {report.title}
                                                </h4>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(report.createdAt)}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                                    {report.content.substring(0, 120)}...
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setSelectedReport(report)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => setReportToDelete(report)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </SheetContent>
            </Sheet>

            {/* View Report Dialog */}
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>{selectedReport?.title}</DialogTitle>
                        <DialogDescription>
                            Created on {selectedReport && formatDate(selectedReport.createdAt)}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[50vh] pr-4">
                        <div className="prose prose-sm dark:prose-invert">
                            {selectedReport?.content.split('\n').map((line, i) => (
                                <p key={i} className="mb-2">{line}</p>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedReport(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Report</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{reportToDelete?.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isPending}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
