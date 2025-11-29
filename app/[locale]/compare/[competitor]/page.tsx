import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, XCircle, Shield, LineChart, PlugZap, CheckCircle, Wrench, FileText } from "lucide-react";
import GeometricBackground from "@/app/[locale]/components/GeometricBackground";
import competitors from "@/data/competitors.json";
import MarketingHeader from "@/app/[locale]/components/MarketingHeader";
import MarketingFooter from "@/app/[locale]/components/MarketingFooter";

type Props = {
    params: Promise<{ competitor: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const competitor = competitors.find((c) => c.slug === params.competitor);
    if (!competitor) return {};

    const title = `Ledger1CRM vs ${competitor.name} | The Best Alternative`;
    const description = `Compare Ledger1CRM vs ${competitor.name}. See why businesses are switching for better AI features, lower costs, and superior support.`;
    const ogUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/api/og`);
    ogUrl.searchParams.set("title", `Ledger1CRM vs ${competitor.name}`);
    ogUrl.searchParams.set("description", "The Smarter, AI-Native Alternative");
    ogUrl.searchParams.set("type", "competitor");
    ogUrl.searchParams.set("badge", "Better Alternative");

    return {
        title,
        description,
        keywords: [`${competitor.name} alternative`, "AI CRM", "CRM comparison", competitor.name],
        openGraph: {
            title,
            description,
            type: "website",
            url: `${process.env.NEXT_PUBLIC_APP_URL}/compare/${params.competitor}`,
            images: [
                {
                    url: ogUrl.toString(),
                    width: 1200,
                    height: 630,
                    alt: `Ledger1CRM vs ${competitor.name}`,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogUrl.toString()],
        },
    };
}

export async function generateStaticParams() {
    return competitors.map((c) => ({
        competitor: c.slug,
    }));
}

/**
 * Static base content rendered consistently across all compare pages,
 * regardless of the SEO landing variant. Competitor data is used only for hero/context.
 */
const STATIC = {
    parityMatrix: [
        { feature: "Predictive AI for Sales", ours: "Included", theirs: "Often add-on / limited" },
        { feature: "Autonomous Support Agents", ours: "Included", theirs: "Varies by plan" },
        { feature: "Open API & Webhooks", ours: "Open & documented", theirs: "Limited / proprietary" },
        { feature: "Cloud-native SaaS", ours: "Fully managed cloud", theirs: "Varies by vendor" },
        { feature: "Pricing Model", ours: "Flat rate per org", theirs: "Per-seat / usage tiers" },
        { feature: "Data Residency Options", ours: "EU/US options", theirs: "Limited / premium" }
    ],
    migrationGuide: [
        "Discovery: map current pipelines, entities, and automations",
        "Export data from current CRM (CSV/API)",
        "Normalize and validate schemas (accounts, contacts, deals, tasks, documents)",
        "Import into Ledger1CRM with field mappings",
        "Recreate pipelines and automation triggers",
        "Set up integrations (email, calendar, voice, documents)",
        "User training, parallel run, and cutover",
        "Decommission legacy system"
    ],
    integrations: {
        email_calendar: ["Gmail", "Outlook 365", "Google Calendar", "iCal"],
        communications: ["Twilio/Voice", "WhatsApp", "SMS", "Slack"],
        documents: ["Google Drive", "Dropbox", "DocuSign", "Adobe Sign"],
        marketing: ["HubSpot forms", "Meta Lead Ads", "Google Ads"],
        data: ["Snowflake", "BigQuery", "S3", "CSV import/export"]
    },
    compliance: {
        regions: ["GDPR (EU/UK)", "CCPA/CPRA (US)", "PIPEDA (CA)", "LGPD (BR)", "PDPA (SG/MY)", "POPIA (ZA)"],
        capabilities: [
            "Consent tracking and audit trails",
            "Data subject rights tooling (export/delete/rectify)",
            "Encryption at rest and in transit",
            "Configurable retention policies",
            "Access controls and approvals"
        ]
    },
    security: {
        certifications: ["SOC 2 Type II (patterns)", "ISO 27001 aligned practices"],
        controls: [
            "RBAC and SSO/SAML/OIDC",
            "Field-level permissions",
            "API keys with scoped tokens",
            "IP allowlists and session policies"
        ]
    },
    pricingOverview: {
        model: "Flat rate per organization, unlimited users and contacts",
        includes: [
            "Core CRM modules",
            "AI agents (sales, support, scheduling)",
            "Dashboards and analytics",
            "Open API access"
        ],
        optional: ["Premium support SLA", "Dedicated region hosting", "Professional services"]
    },
    support_sla: {
        standard: "Business hours support, 24–48h response, knowledge base access",
        premium: "24/7 support, 1–4h response, dedicated CSM, quarterly reviews"
    },
    faqs: [
        { q: "How long does migration take?", a: "Typical migrations complete in days, depending on data volume and customization." },
        { q: "Do you offer self-hosting?", a: "Ledger1CRM is a cloud-native SaaS and does not support self-hosting." },
        { q: "Is there an API?", a: "Yes. REST and Webhooks with scoped tokens and rate limits." },
        { q: "How does AI train?", a: "AI uses organization-specific signals; no cross-tenant data mixing." }
    ]
};

function BulletList({ items }: { items: string[] }) {
    return (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {items.map((it, idx) => (
                <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{it}</span>
                </li>
            ))}
        </ul>
    );
}

export default async function CompetitorPage(props: Props) {
    const params = await props.params;
    const competitor = competitors.find((c) => c.slug === params.competitor);

    if (!competitor) {
        notFound();
    }

    const primaryCta = { label: "Switch Now", url: "https://calendar.google.com/appointments/schedules/AcZssZ2Vduqr0QBnEAM50SeixE8a7kXuKt62zEFjQCQ8_xvoO6iF3hluVQHpaM6RYWMGB110_zM3MUF0" };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <MarketingHeader />
            {/* Hero */}
            <section className="relative w-full py-20 md:py-32 overflow-hidden">
                <GeometricBackground />
                <div className="container px-4 md:px-6 relative z-10 text-center">
                    <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm mb-6">
                        <span>Better than {competitor.name}</span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/50 drop-shadow-2xl mb-6">
                        {competitor.comparison_title}
                    </h1>
                    <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl leading-relaxed mb-8">
                        {competitor.comparison_text}
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link href={primaryCta.url} target="_blank">
                            <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
                                {primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Feature Parity Matrix */}
            <section className="py-20 bg-black/40 backdrop-blur-sm">
                <div className="container px-4 md:px-6 max-w-4xl">
                    <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/50">
                        <div className="grid grid-cols-3 p-6 border-b border-white/10 bg-white/5">
                            <div className="font-bold text-lg">Feature</div>
                            <div className="font-bold text-lg text-center text-primary">Ledger1CRM</div>
                            <div className="font-bold text-lg text-center text-muted-foreground">{competitor.name}</div>
                        </div>
                        {STATIC.parityMatrix.map((row, idx) => (
                            <div key={idx} className={"grid grid-cols-3 p-6 border-b border-white/10 items-center hover:bg-white/5 transition-colors"}>
                                <div>{row.feature}</div>
                                <div className="text-center flex justify-center items-center gap-2">
                                    <CheckCircle2 className="text-green-500" />
                                    <span className="text-green-400 font-medium">{row.ours}</span>
                                </div>
                                <div className="text-center text-muted-foreground">{row.theirs}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Switch */}
            <section className="py-20">
                <div className="container px-4 md:px-6">
                    <div className="grid lg:grid-cols-3 gap-10">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <PlugZap className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold">Capabilities</h3>
                            </div>
                            <BulletList items={[
                                "AI-native workflows for sales, support, and success",
                                "Custom pipelines and automation triggers",
                                "Omnichannel capture and outreach"
                            ]} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <LineChart className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold">Analytics</h3>
                            </div>
                            <BulletList items={[
                                "Forecasting and KPI dashboards",
                                "Attribution and campaign ROI",
                                "Cohort analysis and churn risk"
                            ]} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold">Security</h3>
                            </div>
                            <BulletList items={[
                                "RBAC, SSO/SAML/OIDC, field-level permissions",
                                "Encryption at rest/in transit",
                                "API keys with scoped tokens and IP allowlists"
                            ]} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Migration Guide */}
            <section className="py-20 bg-muted/30">
                <div className="container px-4 md:px-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Wrench className="w-6 h-6 text-primary" />
                        <h2 className="text-3xl font-bold">Migration Guide</h2>
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {STATIC.migrationGuide.map((step, idx) => (
                            <li key={idx} className="rounded-lg border p-4 flex items-start gap-3">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">{idx + 1}</span>
                                <span className="text-muted-foreground">{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Integrations */}
            <section className="py-20">
                <div className="container px-4 md:px-6">
                    <div className="flex items-center gap-2 mb-4">
                        <PlugZap className="w-6 h-6 text-primary" />
                        <h2 className="text-3xl font-bold">Integrations</h2>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="rounded-lg border p-6">
                            <h3 className="font-semibold mb-3">Email & Calendar</h3>
                            <BulletList items={STATIC.integrations.email_calendar} />
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="font-semibold mb-3">Communications</h3>
                            <BulletList items={STATIC.integrations.communications} />
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="font-semibold mb-3">Documents</h3>
                            <BulletList items={STATIC.integrations.documents} />
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="font-semibold mb-3">Marketing</h3>
                            <BulletList items={STATIC.integrations.marketing} />
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="font-semibold mb-3">Data Platforms</h3>
                            <BulletList items={STATIC.integrations.data} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Compliance & Security */}
            <section className="py-20 bg-muted/30">
                <div className="container px-4 md:px-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold">Compliance</h3>
                            </div>
                            <BulletList items={STATIC.compliance.regions} />
                            <div className="mt-6">
                                <h4 className="font-semibold mb-2">Capabilities</h4>
                                <BulletList items={STATIC.compliance.capabilities} />
                            </div>
                        </div>
                        <div className="rounded-lg border p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold">Security</h3>
                            </div>
                            <h4 className="font-semibold mb-2">Certifications</h4>
                            <BulletList items={STATIC.security.certifications} />
                            <div className="mt-6">
                                <h4 className="font-semibold mb-2">Controls</h4>
                                <BulletList items={STATIC.security.controls} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Overview */}
            <section className="py-20">
                <div className="container px-4 md:px-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-6 h-6 text-primary" />
                        <h2 className="text-3xl font-bold">Pricing Overview</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="rounded-lg border p-6">
                            <h3 className="text-xl font-semibold mb-2">Model</h3>
                            <p className="text-muted-foreground">{STATIC.pricingOverview.model}</p>
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="text-xl font-semibold mb-2">Includes</h3>
                            <BulletList items={STATIC.pricingOverview.includes} />
                        </div>
                        <div className="rounded-lg border p-6 md:col-span-2">
                            <h3 className="text-xl font-semibold mb-2">Optional</h3>
                            <BulletList items={STATIC.pricingOverview.optional} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Support & SLA */}
            <section className="py-20 bg-muted/30">
                <div className="container px-4 md:px-6">
                    <h2 className="text-3xl font-bold mb-6">Support & SLA</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="rounded-lg border p-6">
                            <h3 className="text-xl font-semibold mb-2">Standard</h3>
                            <p className="text-muted-foreground">{STATIC.support_sla.standard}</p>
                        </div>
                        <div className="rounded-lg border p-6">
                            <h3 className="text-xl font-semibold mb-2">Premium</h3>
                            <p className="text-muted-foreground">{STATIC.support_sla.premium}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <section className="py-20">
                <div className="container px-4 md:px-6">
                    <h2 className="text-3xl font-bold mb-10">Frequently Asked Questions</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        {STATIC.faqs.map((faq, idx) => (
                            <div key={idx} className="rounded-lg border p-6">
                                <h3 className="font-semibold mb-2">{faq.q}</h3>
                                <p className="text-muted-foreground">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-black/40 backdrop-blur-sm">
                <div className="container px-4 md:px-6 text-center">
                    <h2 className="text-3xl font-bold mb-6">Ready to Switch?</h2>
                    <p className="text-muted-foreground mb-8">
                        Seamless migration, AI-native workflows, and predictable pricing make Ledger1CRM the smartest choice.
                    </p>
                    <div className="flex justify-center">
                        <Link href={primaryCta.url} target="_blank">
                            <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
                                {primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
            <MarketingFooter />
        </div>
    );
}
