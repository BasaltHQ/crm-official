
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { saveIntegrationSettings } from "@/actions/admin/save-integration-settings";
import { useRouter } from "next/navigation";

interface Props {
    initialData: any;
}

export const SurgeSettingsForm = ({ initialData }: Props) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Convert boolean if string, or use default
    // Prisma boolean is strict boolean usually
    const [enabled, setEnabled] = useState(initialData?.surge_enabled || false);
    const [secretKey, setSecretKey] = useState(initialData?.surge_api_key || "");
    const [merchantId, setMerchantId] = useState(initialData?.surge_merchant_id || "");

    const onSave = async () => {
        setLoading(true);
        const formData = new FormData();
        if (enabled) formData.append("surge_enabled", "on");
        formData.append("surge_api_key", secretKey);
        formData.append("surge_merchant_id", merchantId);

        const result = await saveIntegrationSettings(formData);

        if (result?.success) {
            toast.success("Surge settings saved!");
            router.refresh();
        } else {
            toast.error(result?.error || "Failed to save.");
        }
        setLoading(false);
    };

    return (
        <Card className="border border-indigo-500/20 bg-indigo-500/5 shadow-none w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Coins className="w-5 h-5 text-indigo-400" />
                        Surge.co (BasaltSurge)
                    </CardTitle>
                    <CardDescription className="text-muted-foreground/80">
                        Accept crypto payments (USDC on Base).
                    </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                    <Label htmlFor="surge-mode" className="text-xs text-muted-foreground">
                        {enabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch id="surge-mode" checked={enabled} onCheckedChange={setEnabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {enabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid gap-2">
                            <Label htmlFor="surge-secret">Secret Key (sk_live...)</Label>
                            <Input
                                id="surge-secret"
                                type="password"
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                placeholder="sk_live_..."
                                className="bg-background/50 border-indigo-500/20 font-mono text-sm"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="surge-id">Account ID (key_...)</Label>
                            <Input
                                id="surge-id"
                                value={merchantId}
                                onChange={(e) => setMerchantId(e.target.value)}
                                placeholder="key_..."
                                className="bg-background/50 border-indigo-500/20 font-mono text-sm"
                            />
                        </div>
                    </div>
                )}
                <div className="flex justify-end pt-2">
                    <Button
                        onClick={onSave}
                        disabled={loading}
                        variant={enabled ? "default" : "secondary"}
                        className={enabled ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                    >
                        {loading ? "Saving..." : "Save Settings"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
