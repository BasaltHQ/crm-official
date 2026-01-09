"use client";

import { useSession } from "next-auth/react";
import { SWRConfig } from "swr";
import { useEffect, useState } from "react";
import { checkMidnightCacheClear, resetSidebarToOpen } from "@/lib/cache-utils";

export const SWRSessionProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session } = useSession();
    const [provider, setProvider] = useState<any>(undefined);

    // Run midnight cache check and ensure sidebar starts open on app mount
    useEffect(() => {
        const didClear = checkMidnightCacheClear();
        // Always ensure main sidebar is open on initial load
        resetSidebarToOpen();
        if (didClear) {
            console.log('[CRM] Cache cleared at midnight PST, sidebar reset');
        }
    }, []);

    useEffect(() => {
        if (!session?.user?.email) return;

        // Initialize provider only on client side with user spacing
        const key = `app-swr-cache-${session.user.email}`;

        const localStorageProvider = () => {
            const map = new Map(JSON.parse(sessionStorage.getItem(key) || "[]"));

            // Before unloading, save back to sessionStorage
            window.addEventListener("beforeunload", () => {
                try {
                    const appCache = JSON.stringify(Array.from(map.entries()));
                    sessionStorage.setItem(key, appCache);
                } catch (e) {
                    console.warn('Failed to save SWR cache to sessionStorage:', e);
                }
            });

            return map;
        };

        setProvider(() => localStorageProvider);
    }, [session?.user?.email]);

    if (!provider) {
        return <>{children}</>;
    }

    return (
        <SWRConfig value={{
            provider,
            revalidateOnFocus: true,  // Auto-refresh when user switches tabs back
            revalidateOnReconnect: true,  // Auto-refresh on network reconnect
        }}>
            {children}
        </SWRConfig>
    );
};
