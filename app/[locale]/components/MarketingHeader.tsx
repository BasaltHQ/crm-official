import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const demoLink =
    "https://calendar.google.com/appointments/schedules/AcZssZ2Vduqr0QBnEAM50SeixE8a7kXuKt62zEFjQCQ8_xvoO6iF3hluVQHpaM6RYWMGB110_zM3MUF0";

/**
 * Public marketing navbar used across marketing pages.
 * Mirrors the header from app/[locale]/page.tsx without requiring session props.
 */
export default function MarketingHeader() {
    return (
        <header className="px-4 lg:px-6 h-20 flex items-center border-b border-white/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
            <Link className="flex items-center justify-center" href="/">
                <Image
                    src="/logo.png"
                    alt="Ledger1CRM Logo"
                    width={180}
                    height={50}
                    className="object-contain h-10 w-auto brightness-200 contrast-125"
                    priority
                />
            </Link>
            <nav className="ml-auto flex gap-6 items-center">
                <Link
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                    href="/compare"
                >
                    Competitors
                </Link>
                <Link
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                    href="/industry"
                >
                    Industries
                </Link>
                <Link
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden md:block"
                    href="/location"
                >
                    Locations
                </Link>
                <Link href={demoLink} target="_blank">
                    <Button
                        variant="outline"
                        className="hidden sm:flex border-primary/50 text-primary hover:bg-primary/10 hover:text-primary-foreground"
                    >
                        Schedule Demo
                    </Button>
                </Link>
                <Link href="/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                        Login
                    </Button>
                </Link>
            </nav>
        </header>
    );
}
