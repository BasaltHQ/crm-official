"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupOrganization } from "@/actions/teams/setup-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Building2, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { signOut } from "next-auth/react";
import { clearImpersonation } from "@/actions/teams/switch-team";

export default function SetupOrganizationPage() {
    const [companyName, setCompanyName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) return;

        setIsLoading(true);
        try {
            const res = await setupOrganization(companyName);
            if (res?.error) {
                toast({ variant: "destructive", title: "Setup Failed", description: res.error });
            } else if (res?.success) {
                toast({ 
                    title: "Organization Created", 
                    description: "Welcome to BasaltCRM! Redirecting to your dashboard..." 
                });
                
                // Hard refresh to reload the NextAuth session so layout.tsx picks up the new team ID
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.href = "/dashboard";
            }
        } catch (error) {
            toast({ variant: "destructive", title: "System Error", description: "Failed to create organization." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full flex justify-center mb-8 z-10">
                <img src="/BasaltCRMWide.png" alt="BasaltCRM logo" className="h-10 sm:h-12 w-auto opacity-90" />
            </div>

            <Card className="w-full max-w-md shadow-2xl border-white/10 backdrop-blur-md bg-black/60 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="space-y-3 text-center pb-6 pt-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-2 shadow-inner">
                        <Building2 className="w-7 h-7 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight">
                        Setup Organization
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-sm leading-relaxed px-4">
                        Your account currently doesn't belong to any active workspace. Please create a new organization to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-8">
                    <form onSubmit={onSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider ml-1">
                                Organization Name
                            </label>
                            <Input
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="e.g. Acme Corp"
                                disabled={isLoading}
                                className="h-12 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
                                required
                                autoFocus
                            />
                        </div>
                        <Button 
                            type="submit" 
                            className="w-full h-12 font-semibold text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 group" 
                            disabled={isLoading || !companyName.trim()}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Rocket className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                            )}
                            {isLoading ? "Provisioning..." : "Launch Workspace"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t border-white/5 pt-4 pb-6 bg-white/[0.02]">
                    <Button 
                        variant="ghost" 
                        className="text-xs text-muted-foreground hover:text-white"
                        onClick={async () => { await clearImpersonation(); signOut({ callbackUrl: "/sign-in" }); }}
                        disabled={isLoading}
                    >
                        Sign out and use a different account
                    </Button>
                </CardFooter>
            </Card>
            
            <p className="mt-8 text-xs text-gray-500 z-10">
                Secure enterprise workspace provisioning
            </p>
        </div>
    );
}
