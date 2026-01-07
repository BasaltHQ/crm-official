import React, { Suspense } from "react";
import Container from "@/app/[locale]/(routes)/components/ui/Container";

import { getTeams } from "@/actions/teams/get-teams";
import { getPlans } from "@/actions/plans/plan-actions";
import PartnersView from "./_components/PartnersView";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prismadb } from "@/lib/prisma";
import Link from "next/link";
import { Key, DollarSign, List } from "lucide-react";
import { NavigationCard } from "./_components/NavigationCard";
import { CreateTeamCard } from "./_components/CreateTeamCard";
import { SeedTeamCard } from "./_components/SeedTeamCard";

const PartnersPage = async () => {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return redirect("/");
    }

    const user = await (prismadb.users as any).findUnique({
        where: { id: session.user.id },
        include: { assigned_team: true }
    });

    if (!user) {
        return redirect("/");
    }

    const isInternalTeam = user.assigned_team?.slug === "ledger1";
    const isAdmin = user.is_admin;

    if (!isAdmin && !isInternalTeam) {
        return redirect("/");
    }

    const [teams, plans] = await Promise.all([
        getTeams(),
        getPlans()
    ]);

    const cards = [
        {
            title: "System Keys",
            description: "Manage AI system keys & defaults",
            icon: Key,
            color: "from-cyan-500/20 to-blue-500/20",
            iconColor: "text-cyan-400",
            href: "/partners/ai-system-config"
        },
        {
            title: "Model Pricing",
            description: "Configure AI model pricing",
            icon: DollarSign,
            color: "from-emerald-500/20 to-green-500/20",
            iconColor: "text-emerald-400",
            href: "/partners/ai-pricing"
        }
    ];





    return (
        <Container
            title="Partners"
            description="Manage your Teams and CRM Instances"
        >
            <div className="p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3 flex-shrink-0">
                    <CreateTeamCard availablePlans={plans as any} />
                    {cards.map((card, index) => (
                        <Link key={index} href={card.href} className="block h-full">
                            <NavigationCard card={card} />
                        </Link>
                    ))}
                    <SeedTeamCard />
                    <Link href="/partners/plans" className="block h-full">
                        <NavigationCard
                            card={{
                                title: "Manage Plans",
                                description: "Configure subscription plans",
                                icon: List,
                                color: "from-purple-500/20 to-pink-500/20",
                                iconColor: "text-purple-400"
                            } as any}
                        />
                    </Link>
                </div>


                <Suspense fallback={<div>Loading teams...</div>}>
                    <PartnersView initialTeams={teams as any} availablePlans={plans as any} />
                </Suspense>
            </div>
        </Container>
    );
};

export default PartnersPage;
