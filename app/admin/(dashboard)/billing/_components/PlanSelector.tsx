"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Crown,
    Zap,
    CreditCard,
    Hexagon,
    Check,
    ArrowRight,
    Loader2,
    ExternalLink,
    Sparkles,
    Users,
    HardDrive,
    Mail,
    Search,
    Brain,
    Shield,
} from "lucide-react";
import { toast } from "sonner";

// ─── Plan Config (client‑side constants) ─────────────────────────────────────
const SURGE_DISCOUNT = 5;
const ANNUAL_DISCOUNT = 20;

const PLANS = [
    {
        slug: "STARTER",
        name: "Starter",
        monthlyPrice: 0,
        features: ["Up to 2 free seats", "50 MB storage", "500K AI tokens/mo", "100 LeadGen credits", "1,000 emails/mo"],
        highlights: ["CRM Core", "Dashboard", "Contacts", "Tasks"],
        icon: Shield,
        color: "zinc",
        gradient: "from-zinc-500 to-zinc-700",
    },
    {
        slug: "GROWTH",
        name: "Growth",
        monthlyPrice: 29,
        features: ["Billed per active seat", "5 GB storage", "5M AI tokens/mo", "1,000 LeadGen credits", "5,000 emails/mo", "5 active quests"],
        highlights: ["Everything in Starter", "Documents & Invoicing", "Reports & AI Lab", "Email Campaigns", "Custom Themes"],
        icon: Zap,
        color: "indigo",
        gradient: "from-indigo-500 to-violet-600",
        popular: false,
    },
    {
        slug: "SCALE",
        name: "Scale",
        monthlyPrice: 79,
        features: ["Billed per active seat", "50 GB storage", "20M AI tokens/mo", "5,000 LeadGen credits", "25,000 emails/mo", "1,000 SMS/mo", "100 voice min/mo"],
        highlights: ["Everything in Growth", "All Premium Features", "SMS & Voice AI", "Advanced Analytics"],
        icon: Crown,
        color: "amber",
        gradient: "from-amber-500 to-orange-600",
        popular: true,
    },
    {
        slug: "ENTERPRISE",
        name: "Enterprise",
        monthlyPrice: 0,
        features: ["Unlimited seats", "Unlimited storage", "Unlimited AI tokens", "Unlimited LeadGen", "Unlimited emails", "Unlimited quests"],
        highlights: ["Everything in Pro", "Dedicated Support", "Custom Integrations", "SLA Guarantee"],
        icon: Hexagon,
        color: "emerald",
        gradient: "from-emerald-500 to-teal-600",
        enterprise: true,
    },
] as const;

const TOPUP = { price: 9.99, tokens: 6_000_000 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function annualPrice(monthly: number) {
    return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT / 100));
}
function annualMonthly(monthly: number) {
    return Math.round((annualPrice(monthly) / 12) * 100) / 100;
}
function surgePrice(price: number) {
    return Math.round(price * (1 - SURGE_DISCOUNT / 100) * 100) / 100;
}
function formatTokens(n: number) {
    if (n < 0) return "Unlimited";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
}

// ─── Component ────────────────────────────────────────────────────────────────
interface PlanSelectorProps {
    subscription: any;
    teamId: string;
    isPlatformAdmin?: boolean;
}

export function PlanSelector({ subscription, teamId, isPlatformAdmin = false }: PlanSelectorProps) {
    const [isAnnual, setIsAnnual] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);
    const [tokenUnlimited, setTokenUnlimited] = useState(false);
    const [seatQuantity, setSeatQuantity] = useState(1);

    const currentPlan = subscription?.plan_name || "FREE";
    const INTERNAL_SLUGS = ["basalt", "basalthq", "ledger1"];
    const teamSlug = subscription?.team?.slug?.toLowerCase() || "";
    const isInternalTeam = INTERNAL_SLUGS.includes(teamSlug);
    const isExempt = isPlatformAdmin || currentPlan === "PLATFORM_ADMIN" || currentPlan === "EXEMPT" || (isInternalTeam && subscription?.last_charge_status === "SYSTEM_FREE_TIER");
    const surgeAvailable = process.env.NEXT_PUBLIC_SURGE_BILLING_ENABLED === "true";

    useEffect(() => {
        fetch("/api/ai/tokens/balance")
            .then(r => r.json())
            .then(d => {
                setTokenBalance(d.balance);
                setTokenUnlimited(d.unlimited);
            })
            .catch(() => { });
    }, []);

    async function handleCheckout(method: "stripe" | "surge", planSlug: string, interval: "monthly" | "annual") {
        const key = `${method}-${planSlug}-${interval}`;
        setLoading(key);
        try {
            const endpoint = method === "stripe"
                ? "/api/billing/stripe/checkout"
                : "/api/billing/surge/checkout";

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planSlug, interval, quantity: seatQuantity }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create checkout");

            if (data.url) {
                window.location.assign(data.url);
            }
        } catch (err: any) {
            toast.error(err.message || "Checkout failed");
        } finally {
            setLoading(null);
        }
    }

    async function handleTopUp(method: "stripe" | "surge") {
        const key = `topup-${method}`;
        setLoading(key);
        try {
            const endpoint = method === "stripe"
                ? "/api/billing/stripe/checkout"
                : "/api/billing/surge/checkout";

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topUp: true }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create checkout");

            if (data.url) {
                window.location.assign(data.url);
            }
        } catch (err: any) {
            toast.error(err.message || "Top-up failed");
        } finally {
            setLoading(null);
        }
    }

    async function handleManageSubscription() {
        setLoading("portal");
        try {
            const res = await fetch("/api/billing/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to open portal");
            if (data.url) window.location.assign(data.url);
        } catch (err: any) {
            toast.error(err.message || "Could not open billing portal");
        } finally {
            setLoading(null);
        }
    }

    const currentPlanIndex = PLANS.findIndex(p => p.slug === currentPlan);

    return (
        <div className="space-y-8">
            {/* ── Current Plan Banner ── */}
            {subscription && !isExempt && (
                <Card className="bg-gradient-to-r from-indigo-950/40 to-violet-950/40 border-indigo-500/20 overflow-hidden">
                    <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <div className="text-[10px] text-indigo-400/60 uppercase tracking-[0.2em] font-bold mb-1">Current Plan</div>
                            <div className="text-xl font-bold text-white">{subscription.plan_name?.replace(/_/g, " ") || "Free"}</div>
                            <div className="text-xs text-zinc-400 mt-1">
                                {subscription.status === "ACTIVE" && (
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/20 mr-2 text-[10px]">Active</Badge>
                                )}
                                {subscription.interval && <span>${subscription.amount?.toFixed(2)} / {subscription.interval}</span>}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/50 gap-2"
                            onClick={handleManageSubscription}
                            disabled={loading === "portal"}
                        >
                            {loading === "portal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            Manage Subscription
                        </Button>
                    </CardContent>
                </Card>
            )}

            {isExempt && (
                <Card className="bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border-emerald-500/20">
                    <CardContent className="p-5">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20 text-[10px]">Platform Exempt</Badge>
                        <div className="text-xl font-bold text-white mt-2">Unlimited Access</div>
                        <div className="text-xs text-zinc-400 mt-1">Your account has unrestricted access to all features.</div>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 gap-4">
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium transition-colors ${!isAnnual ? "text-white" : "text-zinc-500"}`}>Monthly</span>
                    <button
                        onClick={() => setIsAnnual(!isAnnual)}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isAnnual ? "bg-indigo-600" : "bg-zinc-700"}`}
                    >
                        <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-transform duration-300 ${isAnnual ? "translate-x-7" : "translate-x-0.5"}`} />
                    </button>
                    <span className={`text-sm font-medium transition-colors ${isAnnual ? "text-white" : "text-zinc-500"}`}>
                        Annual
                        <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/20 text-[9px]">Save {ANNUAL_DISCOUNT}%</Badge>
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Seats Required
                    </span>
                    <input 
                        type="number" 
                        min="1" 
                        max="1000"
                        value={seatQuantity}
                        onChange={(e) => setSeatQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded-md py-1 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* ── Plan Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {PLANS.map((plan, idx) => {
                    const isCurrent = !isExempt && plan.slug === currentPlan;
                    const isUpgrade = !isExempt && idx > currentPlanIndex && currentPlanIndex >= 0;
                    const isDowngrade = !isExempt && idx < currentPlanIndex;
                    const isEnterprise = "enterprise" in plan && plan.enterprise;
                    const isPopular = "popular" in plan && plan.popular;

                    const monthlyDisplayPrice = plan.monthlyPrice * seatQuantity;
                    const displayPrice = isAnnual ? annualMonthly(plan.monthlyPrice) * seatQuantity : monthlyDisplayPrice;
                    const totalAnnual = annualPrice(plan.monthlyPrice) * seatQuantity;

                    const stripePrice = isAnnual ? totalAnnual : monthlyDisplayPrice;
                    const surgePriceVal = surgePrice(stripePrice);

                    const loadingStripe = loading === `stripe-${plan.slug}-${isAnnual ? "annual" : "monthly"}`;
                    const loadingSurge = loading === `surge-${plan.slug}-${isAnnual ? "annual" : "monthly"}`;

                    const Icon = plan.icon;

                    return (
                        <Card
                            key={plan.slug}
                            className={`relative overflow-hidden transition-all duration-300 ${isCurrent
                                    ? "border-indigo-500/50 bg-indigo-950/20 ring-1 ring-indigo-500/20"
                                    : isPopular
                                        ? "border-amber-500/30 bg-zinc-900/80 hover:border-amber-500/50"
                                        : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                                }`}
                        >
                            {isPopular && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
                            )}
                            {isCurrent && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
                            )}

                            <CardContent className="p-5 space-y-4">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${plan.gradient} mb-3`}>
                                            <Icon className="w-4.5 h-4.5 text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                    </div>
                                    {isCurrent && (
                                        <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/20 text-[9px]">Current</Badge>
                                    )}
                                    {isPopular && !isCurrent && (
                                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/20 text-[9px]">Popular</Badge>
                                    )}
                                </div>

                                {/* Pricing */}
                                {!isEnterprise ? (
                                    <div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-white tracking-tight">
                                                ${displayPrice > 0 ? displayPrice : 0}
                                            </span>
                                            <span className="text-sm text-zinc-500">/mo</span>
                                        </div>
                                        {isAnnual && plan.monthlyPrice > 0 && (
                                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                                <span className="line-through text-zinc-600">${plan.monthlyPrice * seatQuantity}/mo</span>
                                                {" · "}${totalAnnual}/yr billed annually
                                                {seatQuantity > 1 && ` for ${seatQuantity} seats`}
                                            </div>
                                        )}
                                        {!isAnnual && plan.monthlyPrice > 0 && seatQuantity > 1 && (
                                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                                Billed monthly for {seatQuantity} seats
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-2xl font-black text-white tracking-tight">Custom</div>
                                        <div className="text-[10px] text-zinc-500 mt-0.5">Tailored to your organization</div>
                                    </div>
                                )}

                                {/* Features */}
                                <div className="space-y-1.5 pt-2 border-t border-zinc-800/50">
                                    {plan.features.map((f) => (
                                        <div key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                                            {f}
                                        </div>
                                    ))}
                                </div>

                                {/* Highlights */}
                                <div className="space-y-1 pt-2">
                                    {plan.highlights.map((h) => (
                                        <div key={h} className="text-[10px] text-zinc-500 font-medium">{h}</div>
                                    ))}
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 space-y-2">
                                    {isCurrent ? (
                                        <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 cursor-default" disabled>
                                            Current Plan
                                        </Button>
                                    ) : isEnterprise ? (
                                        <Button
                                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 gap-2"
                                            onClick={() => window.open("mailto:sales@basalthq.com?subject=Enterprise Inquiry", "_blank")}
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            Contact Sales
                                        </Button>
                                    ) : plan.monthlyPrice === 0 ? (
                                        <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 cursor-default" disabled>
                                            Free Forever
                                        </Button>
                                    ) : (
                                        <>
                                            {/* Stripe Button */}
                                            <Button
                                                className={`w-full gap-2 text-white border-0 ${isUpgrade
                                                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500"
                                                        : "bg-zinc-800 hover:bg-zinc-700"
                                                    }`}
                                                onClick={() => handleCheckout("stripe", plan.slug, isAnnual ? "annual" : "monthly")}
                                                disabled={!!loading}
                                            >
                                                {loadingStripe ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                )}
                                                <span className="flex-1 text-left">
                                                    {isDowngrade ? "Downgrade" : isUpgrade ? "Upgrade" : "Subscribe"} — ${stripePrice}
                                                </span>
                                            </Button>

                                            {/* Surge Button */}
                                            <Button
                                                variant="outline"
                                                className={`w-full gap-2 ${surgeAvailable ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/40" : "border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50"}`}
                                                onClick={() => surgeAvailable && handleCheckout("surge", plan.slug, isAnnual ? "annual" : "monthly")}
                                                disabled={!!loading || !surgeAvailable}
                                            >
                                                {loadingSurge ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Hexagon className="w-3.5 h-3.5" />
                                                )}
                                                <span className="flex-1 text-left">
                                                    Surge — ${surgePriceVal}
                                                </span>
                                                {surgeAvailable ? (
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/20 text-[8px] px-1">{SURGE_DISCOUNT}% OFF</Badge>
                                                ) : (
                                                    <Badge className="bg-zinc-700/50 text-zinc-500 border-zinc-600/30 text-[8px] px-1">Coming Soon</Badge>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ── AI Token Top-Up ── */}
            <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
                <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 shrink-0">
                                <Brain className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">AI Token Top-Up</h3>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Add {formatTokens(TOPUP.tokens)} tokens to your balance instantly.
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">Current Balance</div>
                                    <Badge className={`text-[10px] ${tokenUnlimited
                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                                            : "bg-violet-500/20 text-violet-400 border-violet-500/20"
                                        }`}>
                                        {tokenBalance === null ? "..." : tokenUnlimited ? "Unlimited" : formatTokens(tokenBalance)}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            {/* Stripe Top-Up */}
                            <Button
                                className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
                                onClick={() => handleTopUp("stripe")}
                                disabled={!!loading || tokenUnlimited}
                            >
                                {loading === "topup-stripe" ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <CreditCard className="w-3.5 h-3.5" />
                                )}
                                ${TOPUP.price} — {formatTokens(TOPUP.tokens)}
                            </Button>

                            {/* Surge Top-Up */}
                            <Button
                                variant="outline"
                                className={`gap-2 ${surgeAvailable ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500/40" : "border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50"}`}
                                onClick={() => surgeAvailable && handleTopUp("surge")}
                                disabled={!!loading || tokenUnlimited || !surgeAvailable}
                            >
                                {loading === "topup-surge" ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Hexagon className="w-3.5 h-3.5" />
                                )}
                                ${surgePrice(TOPUP.price)} — Surge
                                {surgeAvailable ? (
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/20 text-[8px] px-1">{SURGE_DISCOUNT}% OFF</Badge>
                                ) : (
                                    <Badge className="bg-zinc-700/50 text-zinc-500 border-zinc-600/30 text-[8px] px-1">Coming Soon</Badge>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
