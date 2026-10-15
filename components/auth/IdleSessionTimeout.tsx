"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { clearImpersonation } from "@/actions/teams/switch-team";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes
const WARNING_BEFORE_MS = 60 * 1000; // 1 Minute warning before logout

export default function IdleSessionTimeout() {
    const { status } = useSession();
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(WARNING_BEFORE_MS / 1000);

    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleLogout = useCallback(async () => {
        await clearImpersonation();
        await signOut({ redirect: false });
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/sign-in?idle=true`;
    }, []);

    const resetTimer = useCallback(() => {
        if (status !== "authenticated") return;

        setShowWarning(false);
        setRemainingSeconds(WARNING_BEFORE_MS / 1000);

        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        // Set a timer for the warning modal
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
        }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

        // Set a timer for actual hard logout
        idleTimerRef.current = setTimeout(() => {
            handleLogout();
        }, IDLE_TIMEOUT_MS);
    }, [status, handleLogout]);

    useEffect(() => {
        if (status !== "authenticated") return;

        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

        resetTimer();

        events.forEach((event) => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            events.forEach((event) => window.removeEventListener(event, resetTimer));
        };
    }, [status, resetTimer]);

    // Handle countdown tick when warning is showing
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showWarning) {
            interval = setInterval(() => {
                setRemainingSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showWarning]);

    if (!showWarning) return null;

    return (
        <Dialog open={showWarning} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md border-red-500/20 bg-zinc-950/95 backdrop-blur-md z-[99999]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-500/10 rounded-full flex-shrink-0">
                            <Clock className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-1">Inactivity Timeout</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Are you still there? For your security, you will be automatically logged out due to inactivity.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-6 bg-red-500/5 rounded-xl border border-red-500/10">
                    <span className="text-5xl font-black font-mono text-red-500 animate-pulse">
                        00:{remainingSeconds.toString().padStart(2, "0")}
                    </span>
                    <span className="text-xs text-red-400 mt-2 font-bold uppercase tracking-widest">Seconds Remaining</span>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="w-full border-zinc-800" onClick={handleLogout}>
                        Logout Now
                    </Button>
                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={resetTimer}>
                        Keep Me Signed In
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
