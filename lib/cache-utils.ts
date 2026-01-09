/**
 * Cache management utilities for selective localStorage clearing.
 * Preserves user preferences (themes, accessibility) while clearing session data.
 */

// Keys that should NEVER be cleared - user preferences that persist across sessions
const PRESERVED_KEYS = [
    'theme',                    // Active theme preset (next-themes)
    'custom-themes',            // User-created themes from Theme Studio
    'reduced-motion',           // Accessibility preference
    'high-contrast',            // Accessibility preference
    'voicehub:wallet',          // Voice dialer preference
];

/**
 * Clears all localStorage and sessionStorage EXCEPT preserved user preferences.
 * Call this on logout to ensure fresh state on next login while keeping themes.
 */
export function clearUserCache(): void {
    if (typeof window === 'undefined') return;

    // Get all localStorage keys
    const keys = Object.keys(localStorage);

    // Clear everything EXCEPT preserved keys
    keys.forEach(key => {
        if (!PRESERVED_KEYS.includes(key)) {
            localStorage.removeItem(key);
        }
    });

    // Clear sessionStorage entirely (SWR cache, etc.)
    sessionStorage.clear();

    console.log('[CRM] User cache cleared, theme preferences preserved');
}

/**
 * Checks if cache should be cleared based on midnight PST rule.
 * Should be called on app mount.
 * @returns true if cache was cleared, false otherwise
 */
export function checkMidnightCacheClear(): boolean {
    if (typeof window === 'undefined') return false;

    const LAST_CLEAR_KEY = 'last-cache-clear';
    const lastClear = localStorage.getItem(LAST_CLEAR_KEY);
    const now = new Date();

    // Convert current time to PST
    const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const pstDate = new Date(pstString);

    // Get today's midnight in PST
    const todayMidnight = new Date(pstDate);
    todayMidnight.setHours(0, 0, 0, 0);

    // If no previous clear or last clear was before today's midnight, clear cache
    if (!lastClear || new Date(lastClear) < todayMidnight) {
        clearUserCache();
        localStorage.setItem(LAST_CLEAR_KEY, now.toISOString());
        console.log('[CRM] Midnight cache clear executed');
        return true;
    }

    return false;
}

/**
 * Resets the main sidebar to open state.
 * Called after cache clear to ensure consistent UX on login.
 */
export function resetSidebarToOpen(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('sidebar-open', 'true');
}
