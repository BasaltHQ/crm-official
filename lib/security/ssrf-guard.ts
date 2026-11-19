import dns from "dns/promises";
import net from "net";

/**
 * Centralized SSRF & HTML-escaping security utilities.
 * Blocks loopback, RFC1918 private networks, link-local / cloud metadata (169.254.169.254),
 * CGNAT, multicast/reserved ranges, and DNS rebinding to internal addresses.
 */

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
    "instance-data",
]);

export function isPrivateOrReservedIp(ip: string): boolean {
    const normalized = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");

    // Unwrap IPv4-mapped IPv6 addresses (e.g. ::ffff:169.254.169.254 or ::ffff:a9fe:a9fe)
    if (normalized.startsWith("::ffff:")) {
        const mapped = normalized.slice(7);
        if (net.isIPv4(mapped)) {
            return isPrivateOrReservedIp(mapped);
        }
        // Hex form ::ffff:7f00:1
        const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hexMatch) {
            const hi = parseInt(hexMatch[1], 16);
            const lo = parseInt(hexMatch[2], 16);
            const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
            return isPrivateOrReservedIp(ipv4);
        }
        return true;
    }

    if (net.isIPv4(normalized)) {
        const octets = normalized.split(".").map((n) => parseInt(n, 10));
        if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
            return true;
        }
        const [a, b, c] = octets;

        if (a === 0) return true; // 0.0.0.0/8 ("this" network)
        if (a === 10) return true; // 10.0.0.0/8 (RFC1918)
        if (a === 127) return true; // 127.0.0.0/8 (loopback)
        if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & AWS/Azure/GCP IMDS)
        if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC1918)
        if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC1918)
        if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT / Alibaba metadata)
        if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
        if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking 198.18.0.0/15
        if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
        if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
        if (a >= 224) return true; // Multicast & Reserved 224.0.0.0/4

        return false;
    }

    if (net.isIPv6(normalized)) {
        if (normalized === "::" || normalized === "::1") return true;
        if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // Unique local fc00::/7
        if (/^fe[89ab]/i.test(normalized)) return true; // Link-local fe80::/10
        if (normalized.startsWith("ff")) return true; // Multicast ff00::/8
        if (normalized.startsWith("2001:db8:")) return true; // Documentation
        if (normalized.startsWith("100::")) return true; // Discard
        return false;
    }

    // Reject unrecognized / non-canonical IP representations
    return true;
}

export async function assertSafeExternalUrl(
    rawUrl: string,
    options?: { allowHttp?: boolean }
): Promise<URL> {
    const allowHttp = options?.allowHttp !== false;
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error("Invalid URL format");
    }

    const allowedProtocols = allowHttp ? ["https:", "http:"] : ["https:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
        throw new Error(`Disallowed URL protocol: ${parsed.protocol}`);
    }

    if (parsed.username || parsed.password) {
        throw new Error("URLs with embedded credentials are not allowed");
    }

    const hostname = parsed.hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
    if (!hostname) {
        throw new Error("Missing URL hostname");
    }

    if (
        BLOCKED_HOSTNAMES.has(hostname) ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".home.arpa")
    ) {
        throw new Error("Blocked internal hostname");
    }

    // Reject single-integer or octal/hex dotted IP tricks before DNS lookup
    if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
        throw new Error("Numeric IP encoding is not allowed");
    }

    if (net.isIP(hostname)) {
        if (isPrivateOrReservedIp(hostname)) {
            throw new Error("Blocked private or reserved IP address");
        }
        return parsed;
    }

    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records || records.length === 0) {
        throw new Error("Unable to resolve hostname");
    }

    for (const rec of records) {
        if (isPrivateOrReservedIp(rec.address)) {
            throw new Error("Hostname resolves to a blocked private or reserved IP address");
        }
    }

    return parsed;
}

export async function safeFetch(
    rawUrl: string,
    init: RequestInit = {},
    maxRedirects = 3
): Promise<Response> {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
        const validated = await assertSafeExternalUrl(currentUrl);
        const res = await fetch(validated.toString(), {
            ...init,
            redirect: "manual",
        });

        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get("location");
            if (!location) {
                return res;
            }
            if (hop === maxRedirects) {
                throw new Error("Too many redirects");
            }
            currentUrl = new URL(location, validated).toString();
            continue;
        }

        return res;
    }

    throw new Error("Too many redirects");
}

export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

