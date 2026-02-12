
"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    CreditCard,
    ShieldCheck,
    Sparkles,
    Clock,
    CheckCircle2,
    Calendar,
    ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BillingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PLANS = [
    {
        name: "Testing Plan",
        monthly: 2,
        annual: 24,
        features: ["Uptime Monitoring", "Test Integration"]
    },
    {
        name: "Individual Basic",
        monthly: 50,
        annual: 576,
        features: ["500 Leads / mo", "Basic Enrichment"]
    },
    {
        name: "Individual Pro",
        monthly: 800,
        annual: 9600,
        features: ["2,500 Leads / mo", "VoiceHub Access"],
        popular: true
    }
];

import { saveSubscription } from "@/actions/billing/save-subscription";

export const BillingModal = ({ isOpen, onClose }: BillingModalProps) => {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const [selectedPlan, setSelectedPlan] = useState(PLANS[2]);
    const [loading, setLoading] = useState(false);
    const [wallet, setWallet] = useState("");

    // Calculate dynamic billing day
    const signupDay = new Date().getDate();
    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const billingDayStr = `${getOrdinal(signupDay)} of each month`;

    const originalPrice = billingCycle === "monthly" ? selectedPlan.monthly : selectedPlan.annual;
    const hasDiscount = wallet.startsWith("0x") && wallet.length === 42;
    const finalPrice = hasDiscount ? originalPrice * 0.95 : originalPrice;

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await saveSubscription({
                planName: selectedPlan.name,
                amount: finalPrice,
                billingDay: signupDay,
                customerWallet: wallet.startsWith("0x") ? wallet : undefined,
                discountApplied: hasDiscount,
                interval: billingCycle
            });

            if (res.error) {
                toast.error(res.error);
                setLoading(false);
            } else if (res.url) {
                toast.success("Redirecting to BasaltSURGE Secure Portal...");
                window.location.href = res.url;
            } else {
                toast.success(`Subscription Plan Updated!`);
                onClose();
                setLoading(false);
            }
        } catch (error) {
            toast.error("Subscription failed.");
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-[#09090b] border-zinc-800 p-0 overflow-hidden text-white shadow-2xl">
                <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                    {/* Sidebar / Plan Selector */}
                    <div className="w-full md:w-80 bg-zinc-950/50 border-r border-zinc-800 p-6 flex flex-col">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="flex items-center gap-2 text-xl tracking-tight font-bold">
                                <Sparkles className="text-cyan-400 w-5 h-5" />
                                Subscriptions
                            </DialogTitle>
                            <DialogDescription className="text-zinc-500 text-xs">
                                Dynamic pricing via BasaltSURGE Hybrid Rails.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex bg-zinc-900 rounded-lg p-1 mb-4 border border-zinc-800 shadow-inner">
                            <button
                                onClick={() => setBillingCycle("monthly")}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    billingCycle === "monthly" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle("annual")}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    billingCycle === "annual" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Annual
                                <span className="ml-1 text-[10px] text-cyan-400 bg-cyan-400/10 px-1 rounded">-20%</span>
                            </button>
                        </div>

                        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                            {PLANS.map((plan) => (
                                <button
                                    key={plan.name}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border transition-all relative group",
                                        selectedPlan.name === plan.name
                                            ? "border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_20px_rgba(79,70,229,0.05)]"
                                            : "border-zinc-800 bg-transparent hover:border-zinc-700"
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-xs font-bold tracking-tight">{plan.name}</span>
                                        {plan.popular && (
                                            <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-black tracking-tighter uppercase">PRO</span>
                                        )}
                                    </div>
                                    <div className="text-xl font-mono font-bold tracking-tighter">
                                        ${billingCycle === "monthly" ? plan.monthly : plan.annual}
                                        <span className="text-[10px] text-zinc-500 font-sans ml-1 lowercase tracking-normal font-normal">/ {billingCycle === "monthly" ? 'mo' : 'yr'}</span>
                                    </div>
                                    {selectedPlan.name === plan.name && (
                                        <div className="absolute left-[-1px] top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Hybrid Wallet Address (0x)</Label>
                                <Input
                                    placeholder="0x..."
                                    value={wallet}
                                    onChange={(e) => setWallet(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 h-9 text-xs font-mono focus:border-cyan-500/50"
                                />
                                {hasDiscount && (
                                    <p className="text-[10px] text-cyan-400 font-bold animate-pulse">
                                        ✨ 5% Web3 Discount Applied!
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
                                <span>Powered by</span>
                                <Image src="/Surge32.png" width={14} height={14} alt="Surge" className="grayscale opacity-40" />
                                <span>BasaltSURGE</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content / Payment Method */}
                    <div className="flex-1 p-8 bg-[#09090b]">
                        <div className="max-w-md mx-auto h-full flex flex-col">
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold mb-2 flex items-center gap-3 tracking-tight">
                                    <CreditCard className="text-indigo-400" />
                                    Payment Method
                                </h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">
                                    Funds are settled in USDC on Base. We check your wallet balance first, falling back to this card if USDC is insufficient.
                                </p>
                            </div>

                            <Card className="bg-zinc-900 border-zinc-800 mb-6 overflow-hidden shadow-xl">
                                <CardContent className="p-6">
                                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2">
                                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                                        </div>
                                        <div className="space-y-2 max-w-[300px]">
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Secure Payment Portal</h4>
                                            <p className="text-xs text-zinc-500 leading-relaxed">
                                                To ensure strict <strong>PCI Compliance</strong> and security, you will be redirected to the BasaltSURGE Safe Portal to complete your transaction and vault your card.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                <div className="bg-indigo-500/10 px-6 py-3 flex items-center gap-2 border-t border-indigo-500/20">
                                    <Clock className="text-indigo-400 w-4 h-4" />
                                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">PCI-Compliant Portal Redirect</span>
                                </div>
                            </Card>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-center text-xs p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="text-zinc-500 w-4 h-4" />
                                        <span className="font-medium">Next Billing Day</span>
                                    </div>
                                    <span className="font-bold text-cyan-400">{billingDayStr}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-zinc-500 w-4 h-4" />
                                        <span className="font-medium">Summary</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-white">{selectedPlan.name}</div>
                                        <div className="text-[10px] text-zinc-500">
                                            {hasDiscount ? (
                                                <span className="text-cyan-400 font-bold">${finalPrice.toFixed(2)} (5% off)</span>
                                            ) : (
                                                `$${originalPrice.toFixed(2)}`
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto">
                                <Button
                                    className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all group overflow-hidden relative"
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    {loading ? "Processing..." : (
                                        <>
                                            Activate {selectedPlan.name}
                                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>
                                <p className="text-center text-[10px] text-zinc-500 mt-4 leading-relaxed px-4">
                                    By subscribing, you enable BasaltSURGE Hybrid Rails. Charges are processed in USDC via Base network automation with Coinbase Onramp fallback.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
