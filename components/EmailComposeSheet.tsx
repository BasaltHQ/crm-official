"use client";

import * as React from "react";
import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
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
                        <Label htmlFor="body">Message</Label>
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
                            disabled={isSending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSending || !formData.to || !formData.subject || !formData.body}
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
