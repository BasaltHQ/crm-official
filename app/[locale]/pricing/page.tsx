// @ts-nocheck
export const dynamic = "force-dynamic";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import PricingClient from "./PricingClient";

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#0F0F1A] text-white font-sans selection:bg-primary/30">
            <MarketingHeader />
            <PricingClient />
            <MarketingFooter />
        </div>
    );
}
