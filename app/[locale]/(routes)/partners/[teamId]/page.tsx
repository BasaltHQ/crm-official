import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageSquare } from "lucide-react";

import Container from "@/app/[locale]/(routes)/components/ui/Container";
import TeamDetailsView from "./_components/TeamDetailsView";

import { getCurrentUserTeamId } from "@/lib/team-utils";
import { getTeam } from "@/actions/teams/get-team";
import { getPlans } from "@/actions/plans/plan-actions";


const TeamDetailsPage = async ({ params }: { params: Promise<{ teamId: string }> }) => {
    const resolvedParams = await params;
    const [team, plans] = await Promise.all([
        getTeam(resolvedParams.teamId),
        getPlans()
    ]);
    const currentUserInfo = await getCurrentUserTeamId();

    if (!team) {
        return notFound();
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center space-x-4 mb-4">
                <Link href="/partners" className="btn btn-ghost btn-sm">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                </Link>
                <h2 className="text-3xl font-bold tracking-tight">{team.name}</h2>
            </div>

            <TeamDetailsView
                team={team}
                availablePlans={plans}
                currentUserInfo={currentUserInfo}
            />
        </div>
    );
};

export default TeamDetailsPage;
