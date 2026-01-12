"use client";

import { useSession } from "next-auth/react";
import { SWRConfig } from "swr";
import { useEffect, useState, useRef, useCallback } from "react";
import { checkMidnightCacheClear, resetSidebarToOpen } from "@/lib/cache-utils";

export const SWRSessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session } = useSession();
    const [provider, setProvider] = useState<any>(undefined);
    const cacheMapRef = useRef<Map<string, any> | null>(null);
    const cacheKeyRef = useRef<string>("");

    // Run midnight cache check and ensure sidebar starts open on app mount
    useEffect(() => {
        const didClear = checkMidnightCacheClear();
        // Always ensure main sidebar is open on initial load
        resetSidebarToOpen();
        if (didClear) {
            console.log('[CRM] Cache cleared at midnight PST, sidebar reset');
        }
    }, []);

    // Save cache to sessionStorage
    const saveCache = useCallback(() => {
        if (!cacheMapRef.current || !cacheKeyRef.current) return;
        try {
            const appCache = JSON.stringify(Array.from(cacheMapRef.current.entries()));
            sessionStorage.setItem(cacheKeyRef.current, appCache);
        } catch (e) {
            console.warn('[CRM] Failed to save SWR cache to sessionStorage:', e);
        }
    }, []);

    useEffect(() => {
        if (!session?.user?.email) return;

        // Initialize provider only on client side with user scoping
        const key = `app-swr-cache-${session.user.email}`;
        cacheKeyRef.current = key;

        const localStorageProvider = () => {
            // Safely parse cached data with error handling
            let cachedData: [string, any][] = [];
            try {
                const stored = sessionStorage.getItem(key);
                if (stored) {
                    cachedData = JSON.parse(stored);
                    // Validate it's an array
                    if (!Array.isArray(cachedData)) {
                        console.warn('[CRM] Invalid cache format, resetting');
                        cachedData = [];
                    }
                }
            } catch (e) {
                console.warn('[CRM] Failed to parse SWR cache, starting fresh:', e);
                sessionStorage.removeItem(key);
                cachedData = [];
            }

            const map = new Map(cachedData);
            cacheMapRef.current = map;

            return map;
        };

        setProvider(() => localStorageProvider);
    }, [session?.user?.email]);

    // Set up beforeunload listener with proper cleanup
    useEffect(() => {
        const handleUnload = () => saveCache();
        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [saveCache]);

    // Periodic save every 30 seconds for crash resilience
    useEffect(() => {
        const interval = setInterval(() => {
            saveCache();
        }, 30000);
        return () => clearInterval(interval);
    }, [saveCache]);

    if (!provider) {
        return <>{children}</>;
    }

    return (
        <SWRConfig value={{
            provider,
            revalidateOnFocus: true,  // Auto-refresh when user switches tabs back
            revalidateOnReconnect: true,  // Auto-refresh on network reconnect
            dedupingInterval: 2000,  // Prevent duplicate requests within 2 seconds
        }}>
            {children}
        </SWRConfig>
    );
};
