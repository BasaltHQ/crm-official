"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { HistoryItem } from "@/components/RecentActivityTracker";

import GlobalSearchWidget from "./GlobalSearchWidget";

export default function JumpBackIn() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        try {
            const stored = localStorage.getItem("jump-back-in-history");
            if (stored) {
                let parsed = JSON.parse(stored);
                // Fix legacy typo "Viewtas Item" -> "Task View"
                let hasChanges = false;
                parsed = parsed.map((item: HistoryItem) => {
                    if (item.label === "Viewtas Item") {
                        hasChanges = true;
                        return { ...item, label: "Task View" };
                    }
                    return item;
                });

                setHistory(parsed);

                if (hasChanges) {
                    localStorage.setItem("jump-back-in-history", JSON.stringify(parsed));
                }
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }, []);

    if (!isMounted) return null;

    // Fallback if no history yet
    if (history.length === 0) {
        return (
            <div className="mb-8 opacity-50">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <h3 className="text-sm font-medium uppercase tracking-wider">Jump Back In</h3>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground italic">Your recent activity will appear here.</p>
                    <GlobalSearchWidget />
                </div>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <h3 className="text-sm font-medium uppercase tracking-wider">Jump Back In</h3>
            </div>

            <div className="flex items-start md:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4">
                    {history.map((item, index) => (
                        <Link
                            key={`${item.href}-${index}`}
                            href={item.href}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all text-sm font-medium capitalize"
                        >
                            {item.label}
                            <ArrowRight className="w-3 h-3 opacity-50" />
                        </Link>
                    ))}
                </div>
                <div className="shrink-0 mt-0">
                    <GlobalSearchWidget />
                </div>
            </div>
        </div>
    );
}
