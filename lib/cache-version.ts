/**
 * Cache Version Management
 * 
 * Provides a version token that changes when cache should be invalidated.
 * - Updated at 12 AM PST via cron job
 * - Clients poll this version and invalidate SWR cache when it changes
 */

// In-memory version (resets on server restart, which is acceptable)
// For high-availability production, consider Redis or database storage
let cacheVersion = Date.now();

/**
 * Get the current cache version timestamp
 */
export function getCacheVersion(): number {
    return cacheVersion;
}

/**
 * Invalidate the cache by updating the version
 * Called by the nightly cron job at 12 AM PST
 */
export function invalidateCacheVersion(): number {
    cacheVersion = Date.now();
    console.log(`[CACHE] Version invalidated at ${new Date().toISOString()}, new version: ${cacheVersion}`);
    return cacheVersion;
}
