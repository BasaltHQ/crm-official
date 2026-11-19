
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { redirect } from "next/navigation";
import { SurgeSettingsForm } from "./_components/SurgeSettingsForm";
import { MercurySettingsForm } from "./_components/MercurySettingsForm";
import { CloudflareSettingsForm } from "./_components/CloudflareSettingsForm";
import { ShopifySettingsForm, WooCommerceSettingsForm } from "./_components/ECommerceSettingsForm";
import { TwilioSettingsForm } from "./_components/TwilioSettingsForm";
import { LearnLink } from "@/components/ui/LearnLink";
import Container from "@/app/(routes)/components/ui/Container";
import { getSubscriptionPlan } from "@/lib/subscription";
import { Lock } from "lucide-react";
import { IntegrationLockedCard } from "@/components/IntegrationLockedCard";
import { UpgradeTag } from "@/components/ui/UpgradeTag";
import { maskFields, SECRET_FIELDS } from "@/lib/encryption";

export default async function IntegrationsSettingsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/");

    const teamInfo = await getCurrentUserTeamId();
    if (!teamInfo?.isAdmin || !teamInfo.teamId) redirect("/");

    const rawIntegration = await prismadb.tenant_Integrations.findUnique({
        where: { tenant_id: teamInfo.teamId }
    });
    const integration = maskFields(rawIntegration, SECRET_FIELDS.Tenant_Integrations);

    const rawCaptchaConfig = await (prismadb as any).teamCaptchaConfig.findUnique({
        where: { team_id: teamInfo.teamId }
    });
    const captchaConfig = maskFields(rawCaptchaConfig, SECRET_FIELDS.TeamCaptchaConfig);

    const team = await prismadb.team.findUnique({
        where: { id: teamInfo.teamId },
        include: { assigned_plan: true }
    });

    let features: string[] = [];
    if (team?.assigned_plan) {
        features = team.assigned_plan.features;
    } else {
        features = getSubscriptionPlan(String(team?.subscription_plan || "FREE")).features;
    }
    if (team?.module_overrides) {
        features = Array.from(new Set([...features, ...team.module_overrides]));
    }
    
    const hasFeature = (f: string) => features.includes("all") || features.includes(f);

    const hasOutreach = hasFeature("outreach") || hasFeature("emails");
    const hasInvoice = hasFeature("invoice");
    const hasSms = hasFeature("sms");
    const hasProducts = hasFeature("products");

    return (
        <Container 
            title="Integrations" 
            description="Connect your CRM to external services for payments, commerce, and security." 
            fluid
        >
            <LearnLink
                tab="admin"
                overviewTitle="External Service Integrations"
                overviewWhat="The configuration terminal for linking your CRM to third-party providers like payment gateways (Mercury/Surge) and infrastructure security (Cloudflare)."
                overviewWhy="Authenticating these services here unlocks automated financial tracking and advanced bot protection across your entire team's LeadGen forms and outreach sequences."
                overviewHow="Locate your API keys or Access Tokens in the provider's dashboard, paste them into the appropriate card below, and hit 'Save Integration' to activate the link."
            />

            {/* Payments & E-Commerce */}
            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight">Payments & E-Commerce</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Crypto + Inventory
                        </span>
                    </div>
                    {!hasOutreach && (
                        <UpgradeTag planName="Growth" className="mt-0" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">Accept payments and manage product inventory in one platform. Products sync bidirectionally.</p>
                <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr transition-all duration-300`}>
                    {hasOutreach ? (
                        <SurgeSettingsForm initialData={integration} />
                    ) : (
                        <IntegrationLockedCard title="Payments" planName="Growth" />
                    )}
                </div>
            </div>

            {/* Banking & Invoicing */}
            <div className="pt-2 border-t border-primary/10 relative mt-6">
                <div className="flex items-center justify-between mb-4 pt-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight">Banking & Invoicing</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Payments Only
                        </span>
                    </div>
                    {!hasInvoice && (
                        <UpgradeTag planName="Growth" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">Connect your banking provider for payment processing and financial tracking.</p>
                <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr transition-all duration-300`}>
                    {hasInvoice ? (
                        <MercurySettingsForm initialData={integration} />
                    ) : (
                        <IntegrationLockedCard title="Banking" planName="Growth" />
                    )}
                </div>
            </div>

            {/* Security */}
            <div className="pt-2 border-t border-primary/10 mt-6">
                <div className="flex items-center gap-3 mb-4 pt-4">
                    <h3 className="text-xl font-semibold tracking-tight">Security & Bot Protection</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        Captcha
                    </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">Protect your LeadGen forms and outreach sequences from spam and bot traffic.</p>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                    <CloudflareSettingsForm
                        teamId={teamInfo.teamId}
                        initialConfig={captchaConfig}
                    />
                </div>
            </div>

            {/* Voice & Telephony */}
            <div className="pt-2 border-t border-primary/10 relative mt-6">
                <div className="flex items-center justify-between mb-4 pt-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight">Voice & Telephony</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            Outbound Dialing
                        </span>
                    </div>
                    {!hasSms && (
                        <UpgradeTag planName="Scale" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">Connect your Twilio number for AI-powered outbound calling via ElevenLabs agents.</p>
                <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr transition-all duration-300`}>
                    {hasSms ? (
                        <TwilioSettingsForm initialData={integration} />
                    ) : (
                        <IntegrationLockedCard title="Telephony" planName="Scale" />
                    )}
                </div>
            </div>

            {/* E-Commerce Platforms */}
            <div className="pt-2 border-t border-primary/10 relative mt-6">
                <div className="flex items-center justify-between mb-4 pt-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight">E-Commerce Platforms</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Product Sync
                        </span>
                    </div>
                    {!hasProducts && (
                        <UpgradeTag planName="Growth" />
                    )}
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">Connect your online stores to import and sync product catalogs. Edits in the CRM auto-push back to each store.</p>
                <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr transition-all duration-300`}>
                    {hasProducts ? (
                        <>
                            <ShopifySettingsForm initialData={integration} />
                            <WooCommerceSettingsForm initialData={integration} />
                        </>
                    ) : (
                        <IntegrationLockedCard title="E-Commerce" planName="Growth" />
                    )}
                </div>
            </div>
        </Container>
    );
}
