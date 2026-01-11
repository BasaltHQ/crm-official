"use client";

import { usePathname } from "next/navigation";
import Footer from "@/app/[locale]/(routes)/components/Footer";

export const AuthFooterWrapper = () => {
    const pathname = usePathname();

    // Default to full width for unknown pages, or match register/login specifically
    let widthClass = "w-full";

    if (pathname.includes("/sign-in")) {
        // Match the base width of the login card, avoiding expansion on larger screens to ensure it doesn't look "too wide"
        widthClass = "w-full max-w-sm";
    } else if (pathname.includes("/register")) {
        widthClass = "w-full max-w-lg";
    }
    return (
        <div className={widthClass}>
            <Footer />
        </div>
    );
};
