'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** The new homepage owns its chrome; inner routes retain their existing navigation. */
export function LegacyMarketingChrome({ children }: { children: ReactNode }) {
    return usePathname() === '/' ? null : <>{children}</>;
}

export function LegacyPageFrame({ children, className }: { children: ReactNode; className?: string }) {
    return usePathname() === '/' ? <>{children}</> : <main className={className}>{children}</main>;
}
