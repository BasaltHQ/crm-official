"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    User,
    Users,
    Building2,
    TrendingUp,
    FileSignature,
    ArrowRight,
    ExternalLink,
    LucideIcon,
    Sparkles,
} from "lucide-react";

interface Entity {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    href: string;
}

const ENTITIES: Entity[] = [
    {
        id: "account",
        name: "Account",
        subtitle: "The Foundation",
        description: "Company records created at scale via AI LeadGen to anchor your outreach",
        icon: Building2,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        href: "/crm/accounts",
    },
    {
        id: "contact",
        name: "Contact",
        subtitle: "The Individual",
        description: "People discovered at target accounts during the initial engagement phase",
        icon: Users,
        color: "text-sky-500",
        bgColor: "bg-sky-500/10",
        href: "/crm/contacts",
    },
    {
        id: "lead",
        name: "Lead",
        subtitle: "Qualified Intent",
        description: "A contact promoted to a Lead once engagement or interest is established",
        icon: User,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        href: "/crm/leads",
    },
    {
        id: "opportunity",
        name: "Opportunity",
        subtitle: "Sales Pipeline",
        description: "A formal deal cycle with stages, value, and closing timelines",
        icon: TrendingUp,
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
        href: "/crm/opportunities",
    },
    {
        id: "project",
        name: "Project Success",
        subtitle: "Client Delivery",
        description: "Post-sale delivery boards triggered automatically by winning a deal",
        icon: Sparkles,
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        href: "/projects",
    },
];

interface EntityCardProps {
    entity: Entity;
    delay?: number;
    showArrow?: boolean;
    onClick?: () => void;
}

function EntityCard({ entity, delay = 0, showArrow = true, onClick }: EntityCardProps) {
    const Icon = entity.icon;

    return (
        <div className="flex items-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
                className={cn(
                    "flex-1 p-4 rounded-xl border cursor-pointer",
                    "bg-card border-border",
                    "hover:shadow-lg hover:border-primary/50 transition-[color,background-color,border-color,box-shadow]",
                    "group"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        entity.bgColor,
                        "group-hover:ring-2 group-hover:ring-primary/20"
                    )}>
                        <Icon className={cn("w-5 h-5", entity.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-sm">{entity.name}</h4>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {entity.subtitle}
                        </p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    {entity.description}
                </p>
            </motion.div>

            {showArrow && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: delay + 0.1 }}
                    className="px-2 shrink-0"
                >
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                </motion.div>
            )}
        </div>
    );
}

export default function EntityRelationshipView() {
    const router = useRouter();

    const handleEntityClick = (entity: Entity) => {
        router.push(entity.href);
    };

    return (
        <div className="space-y-6">
            {/* Click hint */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs text-muted-foreground text-center"
            >
                Click any card to view that section
            </motion.p>

            {/* Main Entity Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {ENTITIES.map((entity, index) => (
                    <EntityCard
                        key={entity.id}
                        entity={entity}
                        delay={index * 0.1}
                        showArrow={index < ENTITIES.length - 1}
                        onClick={() => handleEntityClick(entity)}
                    />
                ))}
            </div>

            {/* Relationship Explanations - Plain English */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-4 rounded-lg bg-card border border-border"
                >
                    <h4 className="font-semibold text-sm text-sky-500 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Qualified Intent: Contact → Lead
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        When a person at an Account shows interest or meets engagement criteria, they are promoted from <strong>Contact</strong> to <strong>Lead</strong>. This triggers Step 6 of our GTM flow.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-4 rounded-lg bg-card border border-border"
                >
                    <h4 className="font-semibold text-sm text-emerald-500 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Delivery Trigger: Deal → Project
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        Moving an Opportunity to <strong>Close Won</strong> automatically triggers Step 9: <strong>Project Creation</strong>. The system hands off the data to a delivery board for execution.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
