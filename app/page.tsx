export const dynamic = "force-dynamic";
import { Metadata } from "next";
import BasaltLanding from "@/components/basalt-marketing/BasaltLanding";
import BasaltFooter from "@/components/basaltcrm-landing/BasaltFooter";

export const metadata: Metadata = {
    title: "BasaltCRM – AI Sales & Support Engine",
    description: "Automated prospecting, social intelligence, and 24/7 AI agents that never sleep.",
    keywords: ["AI CRM", "Sales AI", "Customer Support Bot", "SME CRM", "Next.js CRM"],
    openGraph: {
        title: "BasaltCRM – AI Sales & Support Engine",
        description: "Automated prospecting, social intelligence, and 24/7 AI agents that never sleep.",
        type: "website",
        url: "https://crm.basalthq.com",
    },
    twitter: {
        card: "summary_large_image",
        title: "BasaltCRM – AI Sales & Support Engine",
        description: "Automated prospecting, social intelligence, and 24/7 AI agents that never sleep.",
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "BasaltCRM",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Community Edition"
    },
    "featureList": ["Predictive Sales AI", "Autonomous Support Agents"],
    "description": "An AI CRM that combines predictive sales analytics with autonomous customer support agents."
};

export default function LandingPage() {
    return (
        <div className="dark min-h-screen bg-black text-white">
            <BasaltLanding productId="crm" footer={<BasaltFooter />} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
        </div>
    );
}

