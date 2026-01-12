import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";

const intlMiddleware = createMiddleware({
    locales: ["en", "de", "cz", "uk"],
    defaultLocale: "en",
});

export function proxy(request: NextRequest) {
    return intlMiddleware(request);
}

export const config = {
    // Skip all paths that should not be internationalized
    // portal - public SMS message portal (outside locale)
    matcher: ["/((?!api|_next|echo|portal|.*\\..*).*)"],
};
