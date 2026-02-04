"use client";

import * as React from "react";
import { useState } from "react";
import { Send, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface EmailComposeSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTo?: string;
    defaultSubject?: string;
    contactName?: string;
    accountName?: string;
}

export function EmailComposeSheet({
    open,
    onOpenChange,
    defaultTo = "",
    defaultSubject = "",
    contactName = "",
    accountName = "",
}: EmailComposeSheetProps) {
    const [isSending, setIsSending] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isWriting, setIsWriting] = useState(false);
    const [writePrompt, setWritePrompt] = useState("");
    const [enhanceInstruction, setEnhanceInstruction] = useState("");
    const [formData, setFormData] = useState({
        to: defaultTo,
        subject: defaultSubject,
        body: "",
    });

    // Reset form when opened with new defaults
    React.useEffect(() => {
        if (open) {
            setFormData({
                to: defaultTo,
                subject: defaultSubject || (accountName ? `Regarding ${accountName}` : ""),
                body: "",
            });
            setWritePrompt("");
            setEnhanceInstruction("");
        }
    }, [open, defaultTo, defaultSubject, accountName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.to || !formData.subject || !formData.body) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsSending(true);

        try {
            const response = await fetch("/api/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: formData.to,
                    subject: formData.subject,
                    text: formData.body,
                    html: `<div style="font-family: sans-serif; line-height: 1.6;">${formData.body.replace(/\n/g, "<br>")}</div>`,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to send email");
            }

            toast.success("Email sent successfully!");
            setFormData({ to: "", subject: "", body: "" });
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to send email. Please try again.");
            console.error("[EMAIL_SEND_ERROR]", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleWriteWithAI = async () => {
        if (!writePrompt.trim()) {
            toast.error("Please describe what you want to write");
            return;
        }

        setIsWriting(true);

        try {
            const context = contactName
                ? `Writing an email to ${contactName}${accountName ? ` from ${accountName}` : ""}.`
                : accountName ? `Writing an email regarding ${accountName}.` : "";

            const response = await fetch("/api/ai/enhance-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: formData.subject || "New Email",
                    message: "",
                    instruction: `${context} Write a professional email that: ${writePrompt}. Keep it concise and clear.`,
                }),
            });

            if (!response.ok) throw new Error("AI generation failed");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                    setFormData(prev => ({ ...prev, body: result }));
                }
            }

            toast.success("Email drafted with AI!");
            setWritePrompt("");
        } catch (error) {
            toast.error("Failed to generate with AI");
            console.error("[AI_WRITE_ERROR]", error);
        } finally {
            setIsWriting(false);
        }
    };

    const handleEnhanceWithAI = async () => {
        if (!formData.body.trim()) {
            toast.error("Please write some content to enhance");
            return;
        }

        setIsEnhancing(true);

        try {
            const response = await fetch("/api/ai/enhance-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject: formData.subject,
                    message: formData.body,
                    instruction: enhanceInstruction || "Improve clarity, tone, and professionalism while keeping the message concise.",
                }),
            });

            if (!response.ok) throw new Error("AI enhancement failed");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let result = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    result += decoder.decode(value, { stream: true });
                    setFormData(prev => ({ ...prev, body: result }));
                }
            }

            toast.success("Email enhanced with AI!");
            setEnhanceInstruction("");
        } catch (error) {
            toast.error("Failed to enhance with AI");
            console.error("[AI_ENHANCE_ERROR]", error);
        } finally {
            setIsEnhancing(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] flex flex-col">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Send Email
                    </SheetTitle>
                    <SheetDescription>
                        {contactName
                            ? `Compose an email to ${contactName}`
                            : "Compose and send an external email"
                        }
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="to">To</Label>
                        <Input
                            id="to"
                            type="email"
                            placeholder="recipient@example.com"
                            value={formData.to}
                            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                            disabled={!!defaultTo}
                            className={defaultTo ? "bg-muted" : ""}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            id="subject"
                            placeholder="Email subject"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="body">Message</Label>
                            <div className="flex items-center gap-1">
                                {/* Write with AI */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-primary hover:text-primary"
                                            disabled={isWriting || isEnhancing}
                                        >
                                            <Wand2 className="h-3.5 w-3.5" />
                                            Write with AI
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72" align="end">
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">What should the email say?</Label>
                                            <Textarea
                                                placeholder="e.g., Follow up on our meeting, thank them for their time..."
                                                className="min-h-[80px] text-sm"
                                                value={writePrompt}
                                                onChange={(e) => setWritePrompt(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="w-full gap-2"
                                                onClick={handleWriteWithAI}
                                                disabled={isWriting || !writePrompt.trim()}
                                            >
                                                {isWriting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Wand2 className="h-4 w-4" />
                                                )}
                                                Generate Draft
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                {/* Enhance with AI */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-primary hover:text-primary"
                                            disabled={isWriting || isEnhancing || !formData.body.trim()}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Enhance
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72" align="end">
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">How to improve? (optional)</Label>
                                            <Input
                                                placeholder="e.g., Make it more formal"
                                                className="text-sm"
                                                value={enhanceInstruction}
                                                onChange={(e) => setEnhanceInstruction(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="w-full gap-2"
                                                onClick={handleEnhanceWithAI}
                                                disabled={isEnhancing}
                                            >
                                                {isEnhancing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                                Enhance Message
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <Textarea
                            id="body"
                            placeholder="Write your message..."
                            className="flex-1 min-h-[200px] resize-none"
                            value={formData.body}
                            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                        />
                    </div>

                    <SheetFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSending || isWriting || isEnhancing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSending || isWriting || isEnhancing || !formData.to || !formData.subject || !formData.body}
                            className="gap-2"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Send Email
                                </>
                            )}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
