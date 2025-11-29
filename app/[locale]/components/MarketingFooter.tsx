import Link from "next/link";

/**
 * Public marketing footer used across marketing pages.
 * Mirrors the footer from app/[locale]/page.tsx and does not depend on session.
 */
export default function MarketingFooter() {
    return (
        <footer className="flex flex-col gap-8 sm:flex-row py-12 w-full shrink-0 items-center px-4 md:px-6 border-t border-white/10 bg-black/40 backdrop-blur-lg">
            <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} Ledger1CRM. All rights reserved.
                </p>
                <p className="text-xs text-muted-foreground/60">
                    Empowering SMEs with the future of CRM technology.
                </p>
            </div>
            <nav className="sm:ml-auto flex gap-8">
                <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="/terms">
                    Terms
                </Link>
                <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="/privacy">
                    Privacy
                </Link>
                <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="/support">
                    Support
                </Link>
                <Link className="text-sm hover:text-primary transition-colors text-muted-foreground" href="https://twitter.com" target="_blank">
                    Twitter
                </Link>
            </nav>
        </footer>
    );
}
