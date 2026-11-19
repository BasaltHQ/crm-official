import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import Container from "@/app/(routes)/components/ui/Container";
import { AiConfigManager } from "@/components/ai/AiConfigManager";
import { getTeamLeadGenCredits } from "@/lib/scraper/credits";
import { resolveBillingTeamId } from "@/lib/team-billing";
import { LearnLink } from "@/components/ui/LearnLink";

export default async function AdminAiSettingsPage() {
    const session = await getServerSession(authOptions);

    const user = await prismadb.users.findUnique({
        where: { email: session?.user?.email || "" },
        include: { assigned_team: { include: { assigned_plan: true, parent_team: true } } },
    });

    if (!user?.is_admin && !user?.is_account_admin) {
        redirect("/");
    }

    const team = user?.assigned_team;
    const teamId = team?.id;

    if (!teamId) {
        return (
            <Container
                title="AI Settings"
                description="No team found for your account"
            >
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Please contact support to be assigned to a team.
                </div>
            </Container>
        );
    }

    if (team?.team_type === "DEPARTMENT") {
        return (
            <Container
                title="Authorization Locked"
                description="Insufficient Privileges"
            >
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <div className="text-4xl">🔒</div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
                        <p className="text-sm text-muted-foreground max-w-md mt-1">
                            Department administrators do not have access to manage AI configuration. This is managed at the organizational level.
                        </p>
                    </div>
                </div>
            </Container>
        );
    }

    // Plan gating: Only Scale and Enterprise can configure team AI (EXEMPT is secretly bypassed)
    const PLANS_WITH_CUSTOM_AI = ["SCALE", "ENTERPRISE"];
    const planSlug = (team as any)?.assigned_plan?.slug
        || (team as any)?.subscription_plan
        || "STARTER";

    const isSecretlyAllowed = planSlug === "EXEMPT";

    if (!PLANS_WITH_CUSTOM_AI.includes(planSlug) && !isSecretlyAllowed) {
        return (
            <Container
                title="AI Settings"
                description="Custom AI configuration is available on Scale and Enterprise plans"
            >
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <div className="text-4xl">🔒</div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Upgrade to Unlock</h3>
                        <p className="text-sm text-muted-foreground max-w-md mt-1">
                            Custom AI model configuration is available on the <strong>Scale</strong> and <strong>Enterprise</strong> plans.
                            Your team is currently on the <strong>{planSlug}</strong> plan and uses the platform&apos;s default AI configuration.
                        </p>
                    </div>
                </div>
            </Container>
        );
    }

    // Fetch AI data in parallel
    const billingTeamId = await resolveBillingTeamId(teamId);
    console.log("DEBUG AI TOKENS fetch for billingTeamId:", billingTeamId);
    
    const [teamConfig, systemConfigs, activeModels, teamModelRequests] = await Promise.all([
        prismadb.teamAiConfig.findUnique({
            where: { team_id: billingTeamId },
        }),
        prismadb.systemAiConfig.findMany(),
        prismadb.aiModel.findMany({
            where: { isActive: true },
            orderBy: [{ provider: "asc" }, { name: "asc" }],
        }),
        prismadb.customModelRequest.findMany({
            where: { team_id: teamId },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),
    ]);

    // Determine which providers have system keys configured
    const providersWithSystemKey = (systemConfigs as any[])
        .filter((c: any) => c.apiKey && c.apiKey.trim().length > 0)
        .map((c: any) => c.provider);

    // Strip system API keys/ciphertexts before passing to client component
    const maskedSystemConfigs = (systemConfigs as any[]).map((c: any) => ({
        ...c,
        apiKey: c.apiKey ? "********" : null,
    }));

    // Fetch available providers for the request form
    let providerOptions: { slug: string; name: string }[] = [];
    const leadgenCredits = await getTeamLeadGenCredits(teamId);

    try {
        const registeredProviders = await prismadb.aiProviderRegistry.findMany({
            where: { isActive: true },
            orderBy: { slug: "asc" },
            select: { slug: true, name: true },
        });
        providerOptions = registeredProviders;
    } catch {
        providerOptions = Array.from(new Set((activeModels as any[]).map(m => m.provider))).map(p => ({ slug: p, name: p }));
    }

    return (
        <Container
            title="AI Settings"
            description="Configure your team's AI model preferences and API keys"
        >
            <LearnLink
                tab="admin"
                overviewTitle="AI Neural Configuration"
                overviewWhat="The core switching station for choosing which Large Language Models (LLMs) power your CRM's intelligence features."
                overviewWhy="Different tasks require different models. High-volume scraping might use a cheaper, faster model, while complex sales command synthesis requires a high-reasoning model like GPT-4 or Claude 3.5."
                overviewHow="Toggle between 'System Keys' (provided by the platform) or 'Team Keys' (using your own API budget). Select your preferred model for each core function and monitor your LeadGen credit balance."
            />
            <AiConfigManager
                teamId={teamId}
                currentConfig={teamConfig ? {
                    ...teamConfig,
                    apiKey: teamConfig.apiKey ? "********" : null
                } : null}
                models={activeModels}
                providersWithSystemKey={providersWithSystemKey}
                userId={user?.id || ""}
                teamName={user?.assigned_team?.name || ""}
                modelRequests={teamModelRequests as any}
                providerOptions={providerOptions}
                leadgenCredits={leadgenCredits}
                aiTokensBalance={teamConfig && 'ai_token_balance' in teamConfig && teamConfig.ai_token_balance !== null ? Number(teamConfig.ai_token_balance) : 0}
                systemConfigs={maskedSystemConfigs}
            />
        </Container>
    );
}
