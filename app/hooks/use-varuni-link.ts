import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface VaruniInsight {
    score: number;
    sentiment: "positive" | "neutral" | "negative";
    topics: string[];
    reasoning: string;
}

export interface Battlecard {
    id: string;
    trigger_keyword: string;
    title: string;
    content: string;
    counter_arguments: string[];
}

// Temporary hardcoded battlecards 
const BATTLECARDS: Battlecard[] = [
    {
        id: "competitor-hubspot",
        trigger_keyword: "hubspot",
        title: "Competitor: HubSpot",
        content: "HubSpot is great but gets expensive quickly as you scale contacts.",
        counter_arguments: [
            "Our pricing is flat-rate for unlimited contacts.",
            "We include the Dialer and SMS natively, HubSpot requires integration."
        ]
    },
    {
        id: "competitor-salesforce",
        trigger_keyword: "salesforce",
        title: "Competitor: Salesforce",
        content: "Salesforce requires a dedicated admin to manage.",
        counter_arguments: [
            "We are ready to use out of the box.",
            "No implementation fees or consultant needed."
        ]
    },
    {
        id: "objection-price",
        trigger_keyword: "too expensive",
        title: "Objection: Price",
        content: "Focus on ROI and the cost of disconnected tools.",
        counter_arguments: [
            "How much do you spend on Dialer + CRM + Email tool separately?",
            "We consolidate 5 tools into 1."
        ]
    }
];

export function useVaruniLink(sessionId: string | null) {
    const [insight, setInsight] = useState<VaruniInsight | null>(null);
    const [activeBattlecards, setActiveBattlecards] = useState<Battlecard[]>([]);
    const [analyzing, setAnalyzing] = useState(false);

    // Existing "Chat Score" Logic
    const analyzeChat = useCallback(async () => {
        if (!sessionId) return;
        try {
            setAnalyzing(true);
            const res = await fetch("/api/chat/analyze", {
                method: "POST",
                body: JSON.stringify({ sessionId }),
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) throw new Error("Analysis failed");

            const json = await res.json();
            setInsight(json);
            return json;
        } catch (e) {
            console.error(e);
            toast.error("Failed to analyze chat");
        } finally {
            setAnalyzing(false);
        }
    }, [sessionId]);

    // New "Battlecard" Logic
    const processTranscriptStream = useCallback((transcriptText: string) => {
        const found: Battlecard[] = [];
        const lowerText = transcriptText.toLowerCase();

        BATTLECARDS.forEach(card => {
            if (lowerText.includes(card.trigger_keyword.toLowerCase())) {
                if (!activeBattlecards.find(c => c.id === card.id)) {
                    found.push(card);
                }
            }
        });

        if (found.length > 0) {
            setActiveBattlecards(prev => [...prev, ...found]);
            // Optional: Toast or Sound effect
            toast.info(`Varuni Insight: Detected ${found.length} new topics.`);
        }
    }, [activeBattlecards]);

    return {
        insight,
        activeBattlecards,
        analyzing,
        analyzeChat,
        processTranscriptStream,
        dismissBattlecard: (id: string) => setActiveBattlecards(prev => prev.filter(c => c.id !== id))
    };
}
