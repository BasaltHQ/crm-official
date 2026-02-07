"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Loader2, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Use the slug we assigned in the JSON config
const FORM_SLUG = "crecoin-airdrop-season-2";

export default function AirdropLandingPage() {
    const [form, setForm] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const fetchForm = useCallback(async () => {
        try {
            const res = await fetch(`/api/forms/public/${FORM_SLUG}`);
            if (!res.ok) throw new Error("Form not found");
            const data = await res.json();
            setForm(data);

            // Track View
            await fetch(`/api/forms/${data.id}/view`, {
                method: "POST",
                body: JSON.stringify({
                    referrer: document.referrer,
                    user_agent: navigator.userAgent
                })
            }).catch(() => { }); // Silent fail for tracking

        } catch (err) {
            setError("The airdrop form is currently being initialized. Please refresh in a moment.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchForm();
    }, [fetchForm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/forms/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    form_id: form.id,
                    data: formData
                })
            });

            if (!res.ok) throw new Error("Submission failed");

            setSubmitted(true);
            toast.success("Airdrop application submitted!");

        } catch (err) {
            toast.error("Failed to submit form. Please verify your entries.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (fieldName: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#F54029]/30">
            {/* Navigation / Header */}
            <header className="py-6 px-6 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="relative w-40 h-10">
                        <Image
                            src="/BasaltCRMWide.png"
                            alt="Crecoin x BasaltCRM"
                            fill
                            className="object-contain filter grayscale invert brightness-200"
                        />
                    </div>
                    <a
                        href="https://crecoin.co"
                        target="_blank"
                        className="text-xs font-mono tracking-widest text-[#F54029] hover:text-[#ff6b57] transition-colors flex items-center gap-2"
                    >
                        CRECOIN.CO <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
                {/* Hero section */}
                <div className="text-center mb-16 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F54029]/10 border border-[#F54029]/20 mb-4 scale-90 md:scale-100">
                        <span className="w-2 h-2 bg-[#F54029] rounded-full animate-pulse" />
                        <span className="text-[10px] font-mono tracking-[0.2em] text-[#F54029] uppercase">
                            Airdrop Round 2 is Live
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        BLAST OFF TO <br />
                        <span className="bg-gradient-to-r from-[#F54029] to-[#ff8c00] bg-clip-text text-transparent">
                            JUPITER VERIFIED
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        The real heat is on YOU. Jump in deep, promote like crazy, and rack up those bonuses.
                        The harder you go, the bigger your stack.
                    </p>
                </div>

                {/* Form Section */}
                <div className="relative">
                    {/* Decorative glows */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#F54029]/10 rounded-full blur-[80px]" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-500/5 rounded-full blur-[80px]" />

                    <div className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                        {loading ? (
                            <div className="py-32 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="h-10 w-10 animate-spin text-[#F54029]" />
                                <p className="text-gray-500 font-mono text-sm tracking-widest">LOADING FORM ENGINE...</p>
                            </div>
                        ) : error ? (
                            <div className="py-24 px-8 text-center space-y-4">
                                <p className="text-[#F54029] font-mono">{error}</p>
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="bg-white/10 hover:bg-white/20 text-white"
                                >
                                    Try Again
                                </Button>
                            </div>
                        ) : submitted ? (
                            <div className="py-24 px-8 text-center space-y-6">
                                <div className="h-16 w-16 rounded-full bg-[#F54029]/10 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="h-8 w-8 text-[#F54029]" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold">APPLICATION RECEIVED</h2>
                                    <p className="text-gray-400">
                                        {form.success_message || "Thank you for joining the mission. Stay tuned on socials!"}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => window.location.href = "https://crecoin.co"}
                                    className="h-12 px-8 bg-[#F54029] hover:bg-[#ff6b57] text-white font-bold tracking-widest rounded-xl"
                                >
                                    BACK TO MISSION CONTROL
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="divide-y divide-white/5">
                                <div className="p-8 md:p-10 space-y-10">
                                    {form.fields.map((field: any, index: number) => (
                                        <div key={field.id} className="space-y-4 group">
                                            <div className="flex items-start justify-between">
                                                <Label
                                                    htmlFor={field.id}
                                                    className="text-sm font-medium text-gray-300 group-focus-within:text-[#F54029] transition-colors"
                                                >
                                                    <span className="text-[#F54029] mr-2 font-mono">{String(index + 1).padStart(2, '0')}.</span>
                                                    {field.label}
                                                    {field.is_required && <span className="text-[#F54029] ml-1">*</span>}
                                                </Label>
                                            </div>

                                            {field.field_type === 'TEXTAREA' ? (
                                                <Textarea
                                                    id={field.id}
                                                    required={field.is_required}
                                                    placeholder={field.placeholder}
                                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                                    className="min-h-[100px] bg-white/[0.03] border-white/10 focus:border-[#F54029]/50 focus:ring-[#F54029]/20 transition-all rounded-xl"
                                                />
                                            ) : field.field_type === 'TEXT' || field.field_type === 'EMAIL' || field.field_type === 'PHONE' ? (
                                                <Input
                                                    id={field.id}
                                                    type={field.field_type.toLowerCase()}
                                                    required={field.is_required}
                                                    placeholder={field.placeholder}
                                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                                    className="h-12 bg-white/[0.03] border-white/10 focus:border-[#F54029]/50 focus:ring-[#F54029]/20 transition-all rounded-xl"
                                                />
                                            ) : field.field_type === 'CONSENT' ? (
                                                <div className="flex items-start space-x-3 pt-2">
                                                    <Checkbox
                                                        id={field.id}
                                                        required={field.is_required}
                                                        onCheckedChange={(checked) => handleInputChange(field.name, checked)}
                                                        className="mt-1 border-white/20 data-[state=checked]:bg-[#F54029] data-[state=checked]:border-[#F54029]"
                                                    />
                                                    <label
                                                        htmlFor={field.id}
                                                        className="text-sm text-gray-400 cursor-pointer select-none leading-relaxed"
                                                    >
                                                        {field.label}
                                                    </label>
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>

                                <div className="p-8 md:p-10 bg-white/[0.01]">
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full h-14 bg-[#F54029] hover:bg-[#ff6b57] text-white text-lg font-bold tracking-[0.2em] rounded-2xl shadow-[0_0_30px_rgba(245,64,41,0.2)] hover:shadow-[0_0_50px_rgba(245,64,41,0.4)] transition-all duration-300"
                                    >
                                        {submitting ? (
                                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                        ) : (
                                            "SUBMIT APPLICATION"
                                        )}
                                    </Button>
                                    <p className="mt-6 text-center text-xs text-gray-500 font-mono tracking-widest uppercase">
                                        SECURE ON-CHAIN VERIFICATION ENABLED
                                    </p>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left space-y-2">
                        <p className="text-xs font-mono text-gray-500 tracking-widest uppercase">Powered by</p>
                        <p className="font-bold tracking-tight text-white/80">BasaltCRM Engine</p>
                    </div>
                    <div className="flex gap-6">
                        <a href="https://x.com/CREcoinSOL" className="text-gray-500 hover:text-white transition-colors">X (Twitter)</a>
                        <a href="https://discord.gg/AWtkJtsZCz" className="text-gray-500 hover:text-white transition-colors">Discord</a>
                        <a href="https://linkedin.com/company/crecoinfoundation/" className="text-gray-500 hover:text-white transition-colors">LinkedIn</a>
                    </div>
                </div>
            </main>
        </div>
    );
}
