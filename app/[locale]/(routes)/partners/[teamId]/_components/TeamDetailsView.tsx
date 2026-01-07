"use client";

import React, { useState } from "react";
import { LayoutDashboard, Users, MessageSquare } from "lucide-react";

import TeamSettingsForm from "./TeamSettingsForm";
import TeamMembersTable from "./TeamMembersTable";
import SmsConfigForm from "./SmsConfigForm";
import { NavigationCard } from "@/components/NavigationCard";
import { Separator } from "@/components/ui/separator";

type Props = {
    team: any;
    availablePlans: any;
    currentUserInfo: any;
};

const TeamDetailsView = ({ team, availablePlans, currentUserInfo }: Props) => {
    const [activeTab, setActiveTab] = useState("overview");

    const cards = [
        {
            id: "overview",
            title: "Overview",
            description: "Manage team settings",
            icon: LayoutDashboard,
            color: "from-blue-500/20 to-indigo-500/20",
            iconColor: "text-blue-400",
        },
        {
            id: "members",
            title: "Members",
            description: "Manage team members",
            icon: Users,
            color: "from-emerald-500/20 to-green-500/20",
            iconColor: "text-emerald-400",
        },
    ];

    if (currentUserInfo?.isGlobalAdmin) {
        cards.push({
            id: "sms-config",
            title: "SMS Config",
            description: "Configure SMS settings",
            icon: MessageSquare,
            color: "from-orange-500/20 to-red-500/20",
            iconColor: "text-orange-400",
        });
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cards.map((card) => (
                    <div key={card.id} onClick={() => setActiveTab(card.id)} className="h-full">
                        <div className={`group relative overflow-hidden rounded-xl border p-4 md:p-6 transition-all duration-300 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-[1.02] text-left w-full h-full cursor-pointer ${activeTab === card.id ? "border-primary/50 bg-white/10 ring-2 ring-primary/30" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} ${activeTab === card.id ? 'opacity-100' : 'opacity-20 group-hover:opacity-60'} transition-opacity duration-300`} />
                            <div className="relative z-10 flex flex-col items-center justify-center space-y-2 text-center h-full">
                                <div className={`p-3 rounded-full bg-gradient-to-br ${card.color} border border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300 ${card.iconColor} ring-1 ring-white/20 group-hover:ring-white/40`}>
                                    <card.icon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="block text-sm md:text-lg font-medium text-foreground group-hover:text-white transition-colors">
                                        {card.title}
                                    </span>
                                    <span className="block text-[10px] md:text-xs text-muted-foreground group-hover:text-white/80 transition-colors">
                                        {card.description}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Separator />

            <div className="mt-4">
                {activeTab === "overview" && (
                    <TeamSettingsForm team={team} availablePlans={availablePlans} />
                )}
                {activeTab === "members" && (
                    <TeamMembersTable
                        teamId={team.id}
                        teamSlug={team.slug}
                        members={team.members}
                        isSuperAdmin={currentUserInfo?.isGlobalAdmin}
                    />
                )}
                {activeTab === "sms-config" && currentUserInfo?.isGlobalAdmin && (
                    <SmsConfigForm teamId={team.id} teamName={team.name} />
                )}
            </div>
        </div>
    );
};

export default TeamDetailsView;
