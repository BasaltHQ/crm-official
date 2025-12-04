"use client";

import React, { useState } from "react";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function PricingPage() {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const [activeTab, setActiveTab] = useState<"individual" | "professional">("individual");

    const plans = {
        individual: [
            {
                title: "Free",
                price: "$0",
                period: "forever",
                description: "Perfect for testing the waters.",
                features: [
                    "Basic CRM Features",
                    "Lead Generation: Manual only",
                    "Email Campaigns: 250 / month",
                    "Community Support",
                    "1 User",
                ],
                buttonText: "Get Started Free",
                buttonVariant: "outline" as const,
                popular: false,
            },
            {
                title: "Individual Basic",
                price: billingCycle === "monthly" ? "$50" : "$576",
                period: billingCycle === "monthly" ? "/ month" : "/ year",
                description: "Essential tools for solo professionals.",
                features: [
                    "Lead Generation: 500 / month",
                    "Email Campaigns: 2,500 / month",
                    "Basic AI Lead Enrichment",
                    "Workflow Automation",
                    "Standard Support",
                ],
                buttonText: "Start Basic",
                buttonVariant: "outline" as const,
                popular: false,
            },
            {
                title: "Individual Pro",
                price: billingCycle === "monthly" ? "$800" : "$9,600",
                period: billingCycle === "monthly" ? "/ month" : "/ year",
                description: "Power user features for maximum growth.",
                features: [
                    "Lead Generation: 2,500 / month",
                    "Email Campaigns: 12,500 / month",
                    "Advanced AI Lead Enrichment",
                    "VoiceHub AI Calling (billed per minute)",
                    "SMS Campaigns add-on",
                    "Priority Support & Advanced Reporting",
                ],
                buttonText: "Start Pro",
                buttonVariant: "primary" as const,
                popular: true,
                badge: "MOST POPULAR",
                glowColor: "cyan",
            },
        ],
        professional: [
            {
                title: "Professional Starter",
                price: billingCycle === "monthly" ? "$3,000" : "$36,000",
                period: billingCycle === "monthly" ? "/ month" : "/ year",
                description: "For small teams ready to scale.",
                features: [
                    "Lead Generation: 12,000 / month",
                    "Email Campaigns: 100,000 / month",
                    "Advanced AI Lead Enrichment",
                    "Multi-user Workflows (up to 5)",
                    "Team Analytics",
                    "Dedicated Support",
                ],
                buttonText: "Get Started",
                buttonVariant: "outline" as const,
                popular: false,
            },
            {
                title: "Professional Growth",
                price: billingCycle === "monthly" ? "$7,500" : "$90,000",
                period: billingCycle === "monthly" ? "/ month" : "/ year",
                description: "Full-scale solution for growing companies.",
                features: [
                    "Lead Generation: 50,000 / month",
                    "Email Campaigns: 400,000 / month",
                    "Advanced VoiceHub Features",
                    "Custom Reporting & Analytics",
                    "Priority 24/7 Support",
                    "API Access (up to 20 users)",
                ],
                buttonText: "Get Started",
                buttonVariant: "primary" as const,
                popular: true,
                badge: "BEST VALUE",
                glowColor: "purple", // Or keep cyan/primary if preferred, using primary for consistency
            },
            {
                title: "Enterprise",
                price: "Custom",
                period: "Pricing",
                description: "Tailored solutions for large organizations.",
                features: [
                    "Unlimited Lead Generation",
                    "Unlimited Email Campaigns",
                    "Custom AI Models",
                    "Unlimited Users",
                    "SLA & SSO",
                    "Dedicated Success Manager",
                ],
                buttonText: "Contact Sales",
                buttonVariant: "outline" as const,
                popular: false,
            },
        ],
    };

    return (
        <div className="min-h-screen bg-[#0F0F1A] text-white font-sans selection:bg-primary/30">
            <MarketingHeader />

            <main className="pt-32 pb-20">
                {/* Hero Section */}
                <section className="text-center px-4 mb-12">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
                        Simple, Transparent <span className="text-primary">Pricing</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                        Choose the plan that fits your business needs. No hidden fees.
                    </p>

                    {/* Tabs */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-white/5 p-1 rounded-full inline-flex">
                            <button
                                onClick={() => setActiveTab("individual")}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "individual"
                                    ? "bg-primary text-primary-foreground shadow-lg"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                Individual & Small Teams
                            </button>
                            <button
                                onClick={() => setActiveTab("professional")}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "professional"
                                    ? "bg-primary text-primary-foreground shadow-lg"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                Professional & Enterprise
                            </button>
                        </div>
                    </div>

                    {/* Monthly/Annual Toggle */}
                    <div className="flex items-center justify-center space-x-4 mb-16">
                        <span className={`text-sm ${billingCycle === "monthly" ? "text-white" : "text-gray-400"}`}>
                            Monthly
                        </span>
                        <button
                            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
                            className="relative w-14 h-8 bg-white/10 rounded-full p-1 transition-colors hover:bg-white/20 focus:outline-none"
                        >
                            <motion.div
                                className="w-6 h-6 bg-primary rounded-full shadow-md"
                                layout
                                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                                animate={{ x: billingCycle === "monthly" ? 0 : 24 }}
                            />
                        </button>
                        <span className={`text-sm ${billingCycle === "annual" ? "text-white" : "text-gray-400"}`}>
                            Annual <span className="text-primary text-xs ml-1">(Save ~20%)</span>
                        </span>
                    </div>
                </section>

                {/* Pricing Cards */}
                <section className="container mx-auto px-4 max-w-7xl mb-24">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8"
                        >
                            {plans[activeTab].map((plan, index) => (
                                <PricingCard key={index} {...plan} />
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </section>

                {/* Feature Comparison Table */}
                <section className="container mx-auto px-4 max-w-7xl mb-24">
                    <h2 className="text-3xl font-bold text-center mb-12">Feature Comparison</h2>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {activeTab === "individual" ? (
                                <IndividualComparisonTable />
                            ) : (
                                <ProfessionalComparisonTable />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </section>

                {/* Add-on Box */}
                <section className="container mx-auto px-4 max-w-4xl">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-sm">
                        <h3 className="text-2xl font-bold mb-6 text-center">Optional Add-ons</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex items-start space-x-4">
                                <div className="bg-primary/20 p-3 rounded-lg">
                                    <Check className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold mb-2">VoiceHub AI Calling</h4>
                                    <p className="text-gray-400 text-sm">
                                        Billed per minute. Scale your outreach with unlimited AI agents available 24/7.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-4">
                                <div className="bg-primary/20 p-3 rounded-lg">
                                    <Check className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold mb-2">SMS Campaigns</h4>
                                    <p className="text-gray-400 text-sm">
                                        Available as an add-on. Reach your customers directly on their phones with high-converting SMS sequences.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <MarketingFooter />
        </div>
    );
}

function PricingCard({
    title,
    price,
    period,
    description,
    features,
    buttonText,
    buttonVariant,
    popular,
    badge,
    glowColor,
}: {
    title: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    buttonText: string;
    buttonVariant: "primary" | "outline";
    popular?: boolean;
    badge?: string;
    glowColor?: string;
}) {
    return (
        <div
            className={`relative p-8 rounded-2xl border flex flex-col text-left h-full transition-all duration-300 hover:transform hover:-translate-y-1 ${popular
                ? "border-primary bg-primary/5 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
        >
            {popular && badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide shadow-lg">
                    {badge}
                </div>
            )}
            <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{title}</h3>
                <p className="text-gray-400 text-sm h-10">{description}</p>
            </div>

            <div className="flex items-baseline mb-8">
                <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                <span className="text-gray-400 ml-2 text-sm font-medium">{period}</span>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-300">
                        <Check className="h-5 w-5 text-primary mr-3 flex-shrink-0 mt-0.5" />
                        <span className="leading-tight">{feature}</span>
                    </li>
                ))}
            </ul>

            <Link href="/dashboard" className="w-full mt-auto">
                <Button
                    className={`w-full py-6 text-lg rounded-full font-semibold transition-all duration-300 ${buttonVariant === "primary"
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                        : "bg-transparent border border-white/20 hover:bg-white/10 text-white"
                        }`}
                >
                    {buttonText}
                </Button>
            </Link>
        </div>
    );
}

function IndividualComparisonTable() {
    const features = [
        {
            category: "Lead Generation",
            values: ["Manual only", "500 / month", "2,500 / month"]
        },
        {
            category: "Email Campaigns",
            values: ["250 / month", "2,500 / month", "12,500 / month"]
        },
        {
            category: "AI Lead Enrichment",
            values: ["—", "Basic", "Advanced"]
        },
        {
            category: "VoiceHub AI Calling",
            values: ["—", "—", "✓ (per-minute billing)"]
        },
        {
            category: "SMS Campaigns",
            values: ["—", "—", "Add-on available"]
        },
        {
            category: "Workflow Automation",
            values: ["—", "✓", "✓"]
        },
        {
            category: "Users",
            values: ["1", "1", "1"]
        },
        {
            category: "Support",
            values: ["Community", "Standard", "Priority"]
        },
        {
            category: "Reporting & Analytics",
            values: ["Basic", "Standard", "Advanced"]
        },
    ];

    return (
        <div className="bg-[#0A0A12] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left p-6 text-gray-400 font-medium">Feature</th>
                            <th className="p-6 text-center font-bold">Free</th>
                            <th className="p-6 text-center font-bold">Individual Basic</th>
                            <th className="p-6 text-center font-bold bg-primary/5 border-l border-r border-primary/30 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
                                <span className="relative text-primary">Individual Pro</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((feature, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-6 text-gray-300 font-medium">{feature.category}</td>
                                <td className="p-6 text-center text-gray-400">{feature.values[0]}</td>
                                <td className="p-6 text-center text-gray-400">{feature.values[1]}</td>
                                <td className="p-6 text-center bg-primary/5 border-l border-r border-primary/20 text-cyan-400 font-medium">
                                    {feature.values[2]}

                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ProfessionalComparisonTable() {
    const features = [
        {
            category: "Lead Generation",
            values: ["12,000 / month", "50,000 / month", "Unlimited"]
        },
        {
            category: "Email Campaigns",
            values: ["100,000 / month", "400,000 / month", "Unlimited"]
        },
        {
            category: "AI Lead Enrichment",
            values: ["Advanced", "Advanced", "Custom AI Models"]
        },
        {
            category: "VoiceHub AI Calling",
            values: ["Standard features", "Advanced features", "Custom integrations"]
        },
        {
            category: "SMS Campaigns",
            values: ["Add-on available", "Add-on available", "Included"]
        },
        {
            category: "Workflow Automation",
            values: ["✓", "✓", "✓ Custom"]
        },
        {
            category: "Users",
            values: ["Up to 5", "Up to 20", "Unlimited"]
        },
        {
            category: "Support",
            values: ["Dedicated", "Priority 24/7", "Dedicated Success Manager"]
        },
        {
            category: "Reporting & Analytics",
            values: ["Team Analytics", "Custom Reporting", "Enterprise Analytics"]
        },
        {
            category: "API Access",
            values: ["—", "✓", "✓ Advanced"]
        },
        {
            category: "Security & Compliance",
            values: ["Standard", "Enhanced", "SLA & SSO"]
        },
    ];

    return (
        <div className="bg-[#0A0A12] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left p-6 text-gray-400 font-medium">Feature</th>
                            <th className="p-6 text-center font-bold">Professional Starter</th>
                            <th className="p-6 text-center font-bold bg-primary/5 border-l border-r border-primary/30 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
                                <span className="relative text-primary">Professional Growth</span>
                            </th>
                            <th className="p-6 text-center font-bold">Enterprise</th>
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((feature, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-6 text-gray-300 font-medium">{feature.category}</td>
                                <td className="p-6 text-center text-gray-400">{feature.values[0]}</td>
                                <td className="p-6 text-center bg-primary/5 border-l border-r border-primary/20 text-cyan-400 font-medium">
                                    {feature.values[1]}
                                </td>
                                <td className="p-6 text-center text-gray-400">{feature.values[2]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
