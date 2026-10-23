"use client";

import { client } from "@/lib/thirdweb";
import { ConnectEmbed, darkTheme, lightTheme, useProfiles, useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useTheme } from "next-themes";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default function ThirdwebLoginEmbed() {
  const router = useRouter();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { data: profiles } = useProfiles({ client });
  const { disconnect } = useDisconnect();
  const searchParams = useSearchParams();
  const [bridging, setBridging] = useState(false);
  const bridgeTriggered = useRef(false);

  // On auto-logout (?loggedOut=true), disconnect wallet and clear stale state
  useEffect(() => {
    if (searchParams.get("loggedOut") !== "true") return;

    // Always clear thirdweb cookie regardless of wallet state
    fetch("/api/auth/thirdweb/logout", { method: "POST" }).catch(() => {});

    // Disconnect wallet if it's still connected
    if (wallet) disconnect(wallet);

    // Reset bridge state so the user can log in again
    sessionStorage.removeItem("bridge_attempts");
    bridgeTriggered.current = false;
    setBridging(false);

    // Strip the loggedOut param from the URL to prevent re-triggering
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("loggedOut");
    window.history.replaceState({}, "", newUrl.pathname + newUrl.search);
  }, [searchParams, wallet, disconnect]);

  // When account becomes active, poll until the SIWE login (doLogin) has
  // completed and the thirdweb_auth_token cookie is set, THEN redirect
  // to the bridge endpoint via full navigation.
  useEffect(() => {
    if (!account) return;
    if (bridgeTriggered.current) return;

    // Prevent infinite bridge loops using sessionStorage counter
    const attempts = parseInt(sessionStorage.getItem("bridge_attempts") || "0", 10);
    if (attempts >= 3) return;

    let cancelled = false;

    const waitForLoginThenBridge = async () => {
      // Poll is-logged-in until the SIWE cookie is confirmed
      let loggedIn = false;
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/auth/thirdweb/is-logged-in");
          loggedIn = await res.json();
          if (loggedIn) break;
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (cancelled || bridgeTriggered.current) return;
      
      if (!loggedIn) {
        // SIWE login didn't complete — wallet is connected but not authenticated.
        // Disconnect so the ConnectEmbed shows the login form again.
        if (wallet) disconnect(wallet);
        sessionStorage.removeItem("bridge_attempts");
        return;
      }
      
      bridgeTriggered.current = true;
      setBridging(true);

      // Increment attempt counter
      sessionStorage.setItem("bridge_attempts", String(attempts + 1));

      // Wait for profiles to populate (social logins)
      if (!profiles || profiles.length === 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Extract email/name from Thirdweb profiles
      const currentProfiles = profiles || [];
      let email: string | undefined;
      let displayName: string | undefined;

      if (currentProfiles.length > 0) {
        const emailProfile =
          currentProfiles.find((p: any) => p.details?.email && p.details?.name) ||
          currentProfiles.find((p: any) => p.details?.email);

        if (emailProfile?.details) {
          const details = emailProfile.details as any;
          email = details.email;
          displayName = details.name || details.givenName || details.email;
        }
      }

      const params = new URLSearchParams();
      if (email) params.set("email", email);
      if (displayName) params.set("name", displayName);

      router.push(`/api/auth/thirdweb/bridge?${params.toString()}`);
    };

    waitForLoginThenBridge();
    return () => { cancelled = true; };
  }, [account, profiles, disconnect, wallet, router]);

  // Remove Thirdweb branding via DOM mutation observer
  useEffect(() => {
    const removeBranding = () => {
      const brandingLinks = document.querySelectorAll('a[href*="thirdweb.com/connect"]');
      brandingLinks.forEach((link) => {
        if (link.parentElement && link.parentElement.style.display !== "none") {
          link.parentElement.style.display = "none";
        }
      });
      const spans = document.querySelectorAll("span");
      spans.forEach((span) => {
        if (
          span.textContent === "Powered by" &&
          span.nextElementSibling?.tagName.toLowerCase() === "svg"
        ) {
          const container = span.closest('div[style*="padding-top"]');
          if (container && (container as HTMLElement).style.display !== "none") {
            (container as HTMLElement).style.display = "none";
          }
        }
      });
    };

    const observer = new MutationObserver(() => removeBranding());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(removeBranding, 50);
    setTimeout(removeBranding, 500);

    return () => observer.disconnect();
  }, []);

  const wallets = [
    inAppWallet({
      auth: {
        options: [
          "google", "apple", "discord", "telegram", "farcaster", "email",
          "x", "passkey", "phone", "twitch", "steam", "github",
          "line", "epic", "tiktok", "facebook", "coinbase",
        ],
      },
      executionMode: {
        mode: "EIP4337",
        smartAccount: { chain: base, sponsorGas: true },
      },
    }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
    createWallet("me.rainbow"),
    createWallet("io.rabby"),
    createWallet("io.zerion.wallet"),
  ];

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://crm.basalthq.com";

  // Show bridging state
  if (bridging) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full flex items-center justify-center py-4">
        <ConnectEmbed
          client={client}
          wallets={wallets}
          chain={base}
          auth={{
            isLoggedIn: async () => {
              const res = await fetch("/api/auth/thirdweb/is-logged-in");
              return await res.json();
            },
            doLogin: async (params) => {
              await fetch("/api/auth/thirdweb/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
              });
              // Don't set any state here — let the SDK finish its flow.
              // The useEffect watching `account` handles the bridge redirect.
            },
            getLoginPayload: async ({ address }) => {
              const res = await fetch(
                `/api/auth/thirdweb/payload?address=${address}&chainId=${base.id}`
              );
              return await res.json();
            },
            doLogout: async () => {
              await fetch("/api/auth/thirdweb/logout", { method: "POST" });
              router.push("/sign-in");
            },
          }}
          appMetadata={{
            name: "BasaltCRM",
            url: baseUrl,
            logoUrl: `${baseUrl}/BasaltCRM.png`,
          }}
          privacyPolicyUrl="https://basalthq.com/privacy"
          termsOfServiceUrl="https://basalthq.com/terms"
          showThirdwebBranding={false}
          modalSize="compact"
          theme={isDark ? darkTheme({
            colors: {
              accentText: "hsl(24, 100%, 50%)",
              accentButtonBg: "hsl(24, 100%, 50%)",
              primaryButtonBg: "hsl(24, 100%, 50%)",
              primaryButtonText: "hsl(0, 0%, 100%)",
              modalBg: "hsl(0, 0%, 5%)",
              borderColor: "hsl(0, 0%, 15%)",
              separatorLine: "hsl(0, 0%, 15%)",
              secondaryText: "hsl(0, 0%, 60%)",
              primaryText: "hsl(0, 0%, 95%)",
              connectedButtonBg: "hsl(0, 0%, 12%)",
              connectedButtonBgHover: "hsl(0, 0%, 18%)",
              inputAutofillBg: "hsl(0, 0%, 8%)",
              selectedTextBg: "hsl(24, 100%, 50%)",
              selectedTextColor: "hsl(0, 0%, 100%)",
              secondaryButtonBg: "hsl(0, 0%, 12%)",
              secondaryButtonHoverBg: "hsl(0, 0%, 18%)",
              secondaryButtonText: "hsl(0, 0%, 85%)",
              skeletonBg: "hsl(0, 0%, 12%)",
              tertiaryBg: "hsl(0, 0%, 8%)",
              tooltipBg: "hsl(0, 0%, 15%)",
              tooltipText: "hsl(0, 0%, 90%)",
              danger: "hsl(0, 80%, 50%)",
              success: "hsl(142, 71%, 45%)",
            },
          }) : lightTheme({
            colors: {
              accentText: "hsl(24, 100%, 50%)",
              accentButtonBg: "hsl(24, 100%, 50%)",
              primaryButtonBg: "hsl(24, 100%, 50%)",
              primaryButtonText: "hsl(0, 0%, 100%)",
            }
          })}
        />
      </div>

      {/* Legacy credentials link */}
      <Link
        href="/sign-in?legacy=true"
        className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <KeyRound className="w-3.5 h-3.5" />
        Sign in with email &amp; password
      </Link>
    </div>
  );
}
