import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    BrainCircuit,
    Bot,
    Sparkles,
    ShieldCheck,
    Globe,
    Zap,
    Calendar,
    ArrowRight,
    TrendingUp,
    Lock,
} from "lucide-react";
import GeometricBackground from "./components/GeometricBackground";
import AbstractDashboard from "./components/AbstractDashboard";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
    title: "Ledger1CRM | The Open Source AI CRM for Sales & Support",
    description: "Ledger1CRM is the ultimate open-source AI CRM. Automate sales with predictive AI and handle customer support with autonomous agents. Self-hosted and secure.",
    keywords: ["AI CRM", "Open Source CRM", "Sales AI", "Customer Support Bot", "SME CRM", "Self-Hosted CRM", "Next.js CRM"],
    openGraph: {
        title: "Ledger1CRM | AI Sales & Support Engine",
        description: "Empower your SME with Fortune 500 intelligence. The only CRM that closes deals and solves tickets autonomously.",
        type: "website",
        url: "https://ledger1crm.com",
        images: [
            {
                url: "/api/og?title=Ledger1CRM&description=The%20AI%20Sales%20%26%20Support%20Engine",
                width: 1200,
                height: 630,
                alt: "Ledger1CRM Dashboard",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Ledger1CRM | AI-Powered Growth",
        description: "Automate your sales and support with the world's most advanced open-source AI CRM.",
        images: ["/api/og?title=Ledger1CRM&description=The%20AI%20Sales%20%26%20Support%20Engine"],
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Ledger1CRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Open Source Community Edition"
    },
    "featureList": ["Predictive Sales AI", "Autonomous Support Agents", "Open Source", "Self-Hosted"],
    "description": "An open-source AI CRM that combines predictive sales analytics with autonomous customer support agents."
};

export default function LandingPage() {
    const demoLink =
        "https://calendar.google.com/appointments/schedules/AcZssZ2Vduqr0QBnEAM50SeixE8a7kXuKt62zEFjQCQ8_xvoO6iF3hluVQHpaM6RYWMGB110_zM3MUF0";

    return (
        <div className="dark min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
            {/* Header */}
            <header className="px-4 lg:px-6 h-20 flex items-center border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <Link className="flex items-center justify-center" href="#">
                    <Image
                        src="/logo.png"
                        alt="Ledger1CRM Logo"
                        width={180}
                        height={50}
                        className="object-contain h-10 w-auto brightness-200 contrast-125"
                        priority
                    />
                </Link>
                <nav className="ml-auto flex gap-6 items-center">
                    <Link
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                        href="/compare"
                    >
                        Competitors
                    </Link>
                    <Link
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                        href="/industry"
                    >
                        Industries
                    </Link>
                    <Link
                        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                        href="/location"
                    >
                        Locations
                    </Link>
                    <Link href={demoLink} target="_blank">
                        <Button variant="outline" className="hidden sm:flex border-primary/50 text-primary hover:bg-primary/10 hover:text-primary-foreground">
                            Schedule Demo
                        </Button>
                    </Link>
                    <Link href="/dashboard">
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(6,182,212,0.5)]">Login</Button>
                    </Link>
                </nav>
            </header>

            <main className="flex-1 relative">
                {/* Hero Section */}
                <section className="w-full py-20 md:py-32 lg:py-48 relative overflow-hidden">
                    <GeometricBackground />
                    <div className="container px-4 md:px-6 relative z-10">
                        <div className="flex flex-col items-center space-y-8 text-center">
                            <div className="space-y-6 max-w-4xl">
                                <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    <span>Powered by State-of-the-Art AI Models</span>
                                </div>
                                <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/50 drop-shadow-2xl">
                                    The AI CRM Empowering SMEs with <br />
                                    <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-teal-500">Fortune 500 Intelligence</span>
                                </h1>
                                <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed">
                                    Level the playing field. Access the same advanced predictive analytics, automation, and intelligence used by industry giants—at a fraction of the cost.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-6 min-w-[300px] justify-center pt-4">
                                <Link href={demoLink} target="_blank">
                                    <Button size="lg" className="h-14 px-10 text-lg w-full sm:w-auto shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:shadow-[0_0_50px_rgba(6,182,212,0.8)] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">
                                        Schedule a Demo
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </Link>
                                <Link href="/dashboard">
                                    <Button variant="outline" size="lg" className="h-14 px-10 text-lg w-full sm:w-auto border-white/20 hover:bg-white/10 hover:text-white rounded-full backdrop-blur-sm">
                                        Get Started Free
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Advantage Section */}
                <section id="ai-features" className="w-full py-24 md:py-32 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
                    <div className="container px-4 md:px-6 relative">
                        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                The AI Advantage
                            </h2>
                            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed">
                                Don't just manage data. Leverage it. Our AI engine transforms your CRM into a growth engine.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FeatureCard
                                icon={<BrainCircuit className="h-12 w-12 text-cyan-400" />}
                                title="Predictive Sales AI"
                                description="Stop guessing. Our AI analyzes historical data to predict which leads are most likely to close, helping you focus on what matters."
                            />
                            <FeatureCard
                                icon={<Bot className="h-12 w-12 text-teal-400" />}
                                title="Automated Workflows"
                                description="Let AI handle the busy work. From email follow-ups to data entry, automate repetitive tasks and reclaim your time."
                            />
                            <FeatureCard
                                icon={<TrendingUp className="h-12 w-12 text-emerald-400" />}
                                title="Smart Insights"
                                description="Get real-time, actionable insights. Ask questions in plain English and get data-driven answers instantly."
                            />
                        </div>
                    </div>
                </section>

                {/* Enterprise Grade Section */}
                <section id="enterprise" className="w-full py-24 md:py-32 bg-black/40 backdrop-blur-sm border-y border-white/5">
                    <div className="container px-4 md:px-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                                    Sales Engine.<br />
                                    <span className="text-primary">Support Hero.</span>
                                </h2>
                                <p className="text-muted-foreground md:text-xl leading-relaxed">
                                    One platform to rule them all. Watch as our AI autonomously closes deals while simultaneously delighting your existing customers with instant support.
                                </p>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4 group">
                                        <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
                                            <Globe className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl mb-1 group-hover:text-primary transition-colors">Open Source & Self-Hosted</h3>
                                            <p className="text-muted-foreground">
                                                Maintain full sovereignty over your data. Deploy on your own infrastructure or use our secure cloud.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 group">
                                        <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
                                            <Lock className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl mb-1 group-hover:text-primary transition-colors">Bank-Grade Security</h3>
                                            <p className="text-muted-foreground">
                                                End-to-end encryption, role-based access control (RBAC), and SOC2 compliant infrastructure.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 group">
                                        <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
                                            <Zap className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl mb-1 group-hover:text-primary transition-colors">Limitless Integrations</h3>
                                            <p className="text-muted-foreground">
                                                Connect seamlessly with your existing stack. AWS, Google Workspace, Slack, and 5000+ apps via Zapier.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative h-[500px] lg:h-[600px] w-full rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.15)] border border-white/10 bg-black/50 backdrop-blur-xl flex items-center justify-center group">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                                <AbstractDashboard />
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="w-full py-24 md:py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5" />
                    <div className="container px-4 md:px-6 relative z-10">
                        <div className="flex flex-col items-center justify-center space-y-8 text-center">
                            <div className="space-y-4 max-w-3xl">
                                <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                                    Ready to Dominate Your Market?
                                </h2>
                                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                                    Join thousands of forward-thinking businesses using Ledger1CRM to scale smarter, faster, and more securely.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-6">
                                <Link href={demoLink} target="_blank">
                                    <Button size="lg" className="h-14 px-10 text-lg font-semibold shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all">
                                        <Calendar className="mr-2 h-5 w-5" />
                                        Schedule a Demo
                                    </Button>
                                </Link>
                                <Link href="/dashboard">
                                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg border-white/20 hover:bg-white/10 hover:text-white rounded-full backdrop-blur-sm">
                                        Start Free Trial
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="flex flex-col gap-8 sm:flex-row py-12 w-full shrink-0 items-center px-4 md:px-6 border-t border-white/10 bg-black/40 backdrop-blur-lg">
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} Ledger1CRM. All rights reserved.
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        Empowering SMEs with the future of CRM technology.
                    </p>
                </div>
                <nav className="sm:ml-auto flex gap-8">
                    <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="#">
                        Terms
                    </Link>
                    <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="#">
                        Privacy
                    </Link>
                    <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="#">
                        Support
                    </Link>
                    <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="#">
                        Twitter
                    </Link>
                </nav>
            </footer>
        </div>
    );
}

function FeatureCard({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Card className="border border-white/5 shadow-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all duration-500 bg-white/5 backdrop-blur-md group hover:-translate-y-1">
            <CardHeader>
                <div className="mb-4 p-4 rounded-2xl bg-white/5 w-fit group-hover:bg-primary/10 transition-colors ring-1 ring-white/10 group-hover:ring-primary/30">{icon}</div>
                <CardTitle className="text-2xl group-hover:text-primary transition-colors">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="text-base leading-relaxed text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">{description}</CardDescription>
            </CardContent>
        </Card>
    );
}
