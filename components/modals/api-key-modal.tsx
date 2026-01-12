"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, ShieldCheck, ExternalLink } from "lucide-react";

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
    providerName: string;
    providerUrl?: string;
    initialKey?: string;
    isMasked?: boolean;
}

export const ApiKeyModal = ({
    isOpen,
    onClose,
    onSave,
    providerName,
    providerUrl,
    initialKey = "",
    isMasked = false
}: ApiKeyModalProps) => {
    const [apiKey, setApiKey] = useState(initialKey);
    const [showKey, setShowKey] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setApiKey(initialKey);
            setShowKey(false);
        }
    }, [isOpen, initialKey]);

    const handleSave = () => {
        onSave(apiKey);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Key className="w-5 h-5" />
                        </div>
                        Configure {providerName}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {isMasked
                            ? `A custom key is currently configured for ${providerName}. Enter a new key below to replace it.`
                            : `Enter your personal API key to use ${providerName} models. Your key is stored securely and encrypted.`
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey" className="text-zinc-300">
                            {isMasked ? "New API Key" : "API Key"}
                        </Label>
                        <div className="relative">
                            <Input
                                id="apiKey"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={isMasked ? "Enter new key to replace..." : "sk-..."}
                                className="pl-10 pr-10 bg-zinc-900/50 border-zinc-800 focus:ring-primary/50 text-zinc-100"
                            />
                            <ShieldCheck className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {providerUrl && (
                            <div className="flex justify-end">
                                <a
                                    href={providerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                                >
                                    Get connection key
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
                        <p>
                            <strong>Note:</strong> Using your own key grants you full control over usage limits and billing directly with {providerName}.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-end">
                    <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
