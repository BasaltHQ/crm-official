"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * ConnectStreamsSoftphone
 * Embeds Amazon Connect CCP using the official Streams JS SDK.
 * Uses loginPopup by default to avoid frame-ancestors CSP issues.
 *
 * Docs: https://docs.aws.amazon.com/connect/latest/adminguide/amazon-connect-streams.html
 */
export default function ConnectStreamsSoftphone({
  instanceUrl,
  height = 720,
  autoLaunch = false,
  preferPopup = true,
  theme = "dark",
  accentColor,
  title,
  subtitle,
  className,
}: {
  instanceUrl?: string; // e.g., https://ledger1crm.my.connect.aws
  height?: number;
  autoLaunch?: boolean; // auto-init CCP and present login inline by default
  preferPopup?: boolean; // true => login popup (avoids frame-ancestors CSP), false => inline
  theme?: "dark" | "light"; // CCP appearance preference (best-effort via query param)
  accentColor?: string; // brand accent (e.g., '#6b21a8' for violet)
  title?: string; // header title (e.g., 'Sales Dialer')
  subtitle?: string; // header subtitle
  className?: string; // extra wrapper classes for skinning
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [agentState, setAgentState] = useState<string>("");
  const [contactStatus, setContactStatus] = useState<string>("");
  // Launch should default to false unless explicitly requested via autoLaunch=true
  const [launched, setLaunched] = useState<boolean>(autoLaunch === true);
  const [initializing, setInitializing] = useState<boolean>(false);
  // Guard against multiple initializations (e.g., Next.js StrictMode double-invocation)
  const initRef = useRef<boolean>(false);
  const connectRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const phoneNumberRef = useRef<string>("");
  const latestContactRef = useRef<any>(null);

  function openCCPInNewTab() {
    try {
      const url = instanceUrl || (process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "https://ledger1crm.my.connect.aws");
      const full = `${url}/ccp-v2`;
      const win = window.open(full, '_blank', 'noopener,noreferrer');
      if (!win) setError('Popup blocked. Please allow popups for this site.');
    } catch (e: any) {
      setError(e?.message || 'Failed to open CCP');
    }
  }

  async function handleLaunch() {
    try {
      // Request mic access on user gesture to avoid enumeration failures.
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (permErr: any) {
      // Show a friendly hint and proceed; CCP may still prompt.
      setError(`Microphone permission not granted. Please allow mic access and retry. ${permErr?.message || ""}`);
    } finally {
      setLaunched(true);
    }
  }

  // Softphone control methods
  function setNumber(n: string) {
    phoneNumberRef.current = String(n || "").trim();
  }

  async function dial() {
    try {
      const number = phoneNumberRef.current;
      if (!number) {
        setError("No phone number set. Use softphone:setNumber first.");
        return;
      }
      const connect = connectRef.current;
      if (!connect?.core?.getClient) {
        setError("Connect client not ready");
        return;
      }
      const client = connect.core.getClient();
      const endpoint = { phoneNumber: number };
      const queueId = process.env.CONNECT_QUEUE_ID;
      const flowId = process.env.CONNECT_CONTACT_FLOW_ID;

      const params: any = { endpoint };
      if (queueId) params.queueId = queueId;
      if (flowId) params.contactFlowId = flowId;

      await client.createOutboundContact(params);
    } catch (e: any) {
      setError(e?.message || "Dial failed");
    }
  }

  function hangup() {
    try {
      const c = latestContactRef.current;
      if (!c) {
        setError("No active contact to hangup");
        return;
      }
      const statusType = String(c.getStatus?.().type || "").toLowerCase();
      const agentConn = c.getAgentConnection?.();
      if (agentConn?.destroy) {
        agentConn.destroy({
          success: () => {},
          failure: () => setError("Failed to disconnect"),
        });
        return;
      }
      if (statusType === "after-call-work" || statusType === "acw") {
        if (c.completeContact) {
          c.completeContact();
          return;
        }
      }
      if (statusType === "ended") {
        if (c.clear) {
          c.clear({
            success: () => {},
            failure: () => setError("Failed to clear contact"),
          });
          return;
        }
      }
      setError(`No supported hangup method for status: ${statusType || "unknown"}`);
    } catch (e: any) {
      setError(e?.message || "Hangup failed");
    }
  }

  function getStatus(): string {
    return contactStatus || "";
  }

  // postMessage bridge
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      try {
        const allowedOrigins = (() => {
          const arr: string[] = [window.location.origin];
          const base = String(process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "").replace(/\/+$/, "");
          if (base) arr.push(base);
          try {
            const resolved = instanceUrl || process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "https://ledger1crm.my.connect.aws";
            arr.push(new URL(String(resolved)).origin);
          } catch {}
          return arr.filter(Boolean);
        })();
        if (!allowedOrigins.includes(ev.origin)) {
          return;
        }
        const data: any = ev.data || {};
        const type = String(data?.type || "");
        if (type === "softphone:setNumber") {
          setNumber(String(data?.number || ""));
          ev.source?.postMessage({ type: "softphone:status", status: getStatus() }, { targetOrigin: ev.origin });
        } else if (type === "softphone:dial") {
          void dial();
        } else if (type === "softphone:hangup") {
          hangup();
        } else if (type === "softphone:getStatus") {
          ev.source?.postMessage({ type: "softphone:status", status: getStatus() }, { targetOrigin: ev.origin });
        }
      } catch {}
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contactStatus]);

  async function loadStreamsScript(): Promise<void> {
    // Try local vendor, then env override, then official CDNs
    const candidates = [
      "/connect/connect-streams.js",
      String(process.env.NEXT_PUBLIC_CONNECT_STREAMS_URL || ""),
      "https://cdn.connect.aws/connect-streams.js",
      "https://cdn.connect.amazon.com/connect-streams.js",
    ].filter((u) => typeof u === "string" && u.length > 0);

    for (const url of candidates) {
      try {
        // If already loaded from a previous attempt
        if ((window as any).connect) return;
        const s: HTMLScriptElement = document.createElement("script");
        s.src = url;
        s.async = true;
        const p = new Promise<void>((resolve, reject) => {
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load Streams SDK from ${url}`));
        });
        document.head.appendChild(s);
        scriptRef.current = s;
        await p;
        if ((window as any).connect) {
          // Record success and stop trying further URLs
          return;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }
    // If we reach here, we failed to load
    throw new Error("Amazon Connect Streams SDK not available. Vendor locally or set NEXT_PUBLIC_CONNECT_STREAMS_URL.");
  }

  useEffect(() => {
    const url = instanceUrl || (process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "https://ledger1crm.my.connect.aws");
    let mounted = true;

    if (!launched) return;
    // Prevent multiple provider initialization
    if (initRef.current) return;
    // Mark init started to prevent React StrictMode double-invocation
    initRef.current = true;

    async function init() {
      try {
        setInitializing(true);
        // Load Streams SDK (tries local vendor, env override, and official CDNs)
        let connect = (window as any).connect;
        if (!connect) {
          await loadStreamsScript();
          connect = (window as any).connect;
        }
        connectRef.current = connect;
        if (!connect) throw new Error("Amazon Connect Streams SDK not available");
        if (!containerRef.current) throw new Error("Container not ready");

        // Initialize CCP
        const g = (window as any);
        // Prevent double initialization across multiple component instances and StrictMode re-renders
        if (g.__ccpProviderInit === true || g.__ccpProviderInitializing === true) {
          initRef.current = true;
          return;
        }
        g.__ccpProviderInitializing = true;
        initRef.current = true;

        connect.core.initCCP(containerRef.current, {
          // Use theme via query param where supported
          ccpUrl: `${url}/ccp-v2${theme === "dark" ? "?theme=dark" : ""}`,
          // Prefer popup to avoid frame-ancestors CSP issues
          loginPopup: preferPopup,
          loginPopupAutoClose: preferPopup,
          loginOptions: { autoClose: true, height: 600, width: 400, top: 0, left: 0 },
          softphone: { allowFramedSoftphone: true, disableRingtone: false, allowEarlyGum: true },
          region: (process.env.AWS_REGION || "us-west-2"),
        });
        // Mark provider initialized after successful init
        const g2 = (window as any);
        g2.__ccpProviderInit = true;
        g2.__ccpProviderInitializing = false;

        // If inline mode, ensure the CCP iframe has proper Permission Policy to access mic/devices.
        const ensureIframePermissions = () => {
          if (!containerRef.current) return;
          const iframe = containerRef.current.querySelector("iframe");
          if (iframe) {
            iframe.setAttribute("allow", "microphone; autoplay; clipboard-write; fullscreen; display-capture");
            iframe.setAttribute("allowusermedia", "true");
            iframe.setAttribute("referrerpolicy", "origin-when-cross-origin");
          }
        };
        if (!preferPopup) {
          ensureIframePermissions();
          const mo = new MutationObserver(() => ensureIframePermissions());
          if (containerRef.current) {
            mo.observe(containerRef.current, { childList: true, subtree: true });
          }
        }

        // Agent info and state updates
        connect.agent(function (agent: any) {
          try {
            setAgentName(String(agent.getName?.() || ""));
            const st = agent.getState?.();
            setAgentState(st?.name ? String(st.name) : "");
            agent.onStateChange?.(function () {
              const s = agent.getState?.();
              setAgentState(s?.name ? String(s.name) : "");
            });
          } catch {}
        });

        // Contact status
        connect.contact(function (contact: any) {
          try {
            latestContactRef.current = contact;
            setContactStatus(String(contact.getStatus?.().type || ""));
            contact.onConnected?.(() => setContactStatus("Connected"));
            contact.onEnded?.(() => setContactStatus("Ended"));
            contact.onAccepted?.(() => setContactStatus("Accepted"));
          } catch {}
        });
      } catch (e: any) {
        console.error("[CONNECT_STREAMS_INIT]", e);
        // Reset init guard flags on failure to allow retry
        try {
          const g = (window as any);
          g.__ccpProviderInitializing = false;
          g.__ccpProviderInit = false;
        } catch {}
        if (mounted) {
          const hint = '\nTip: vendor the Streams SDK locally under /connect/connect-streams.js or set NEXT_PUBLIC_CONNECT_STREAMS_URL.';
          setError((e?.message || String(e)) + hint);
        }
      } finally {
        setInitializing(false);
      }
    }

    init();

    return () => {
      mounted = false;
      try {
        // Keep Streams SDK loaded; do not tear down CCP upstream on view switch.
        // Removing the script element can cause upstream loss for other views relying on connect.
        const s = scriptRef.current;
        if (s && s.parentNode) {
          // Intentionally preserve the script to keep the global connect client available.
          // s.parentNode.removeChild(s);
          // scriptRef.current = null;
        }
        const g = (window as any);
        // Do NOT terminate CCP here; other views may still rely on the upstream conduit.
        // if (connectRef.current?.core?.terminate) {
        //   connectRef.current.core.terminate();
        // }
        // Preserve provider init flag so upstream remains active across view switches.
        g.__ccpProviderInit = true;
      } catch {}
    };
  }, [instanceUrl, launched, preferPopup, theme]);

  // Suppress benign Streams SDK console errors for known noisy patterns
  useEffect(() => {
    const original = console.error;
    function filtered(...args: any[]) {
      try {
        const flat = args.map(a => (typeof a === "string" ? a : (a?.message || ""))).join(" ");
        const noHandler = flat.includes("No handler for invoked request");
        const deviceEnum = flat.includes("Failed to enumerate media devices");
        if (noHandler || deviceEnum) {
          return;
        }
      } catch {}
      // pass through other errors
      original(...args);
    }
    console.error = filtered as any;
    return () => {
      console.error = original;
    };
  }, []);

  const accent = accentColor || (theme === "dark" ? "#6b21a8" : "#7c3aed"); // violet accents
  const containerStyle: React.CSSProperties = {
    height,
    borderColor: accent,
    boxShadow: `0 0 0 1px ${accent} inset, 0 8px 16px rgba(0,0,0,0.15)`
  };

  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${className || ""}`}>
      <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${theme === "dark" ? "bg-gradient-to-r from-slate-900 to-slate-800" : "bg-gradient-to-r from-white to-slate-50"} border`} style={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}>
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-md" style={{ backgroundColor: accent }} />
          <div className="flex flex-col">
            <div className="text-xs font-semibold">
              {title || "Softphone"}
            </div>
            {subtitle ? (
              <div className="text-[10px] text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentState ? (
            <span className="text-[10px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200">
              {agentState}
            </span>
          ) : null}
          {contactStatus ? (
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
              {contactStatus}
            </span>
          ) : null}
          {!launched ? (
            <Button size="sm" onClick={handleLaunch} disabled={initializing} className="h-7">
              {initializing ? "Launching…" : "Launch"}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={openCCPInNewTab} className="h-7">
              Open in Tab
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={containerStyle}
        className={`w-full rounded-lg border bg-background`}
      />

      <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
        {agentName ? (<span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">{agentName}</span>) : null}
        {agentState ? (<span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">{agentState}</span>) : null}
        {contactStatus ? (<span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">{contactStatus}</span>) : null}
      </div>
      {error ? (
        <div className="mt-2">
          <div className="text-[11px] text-red-600">{error}</div>
          {(() => {
            const e = (error || '').toLowerCase();
            const showApprovedHint = e.includes('frame-ancestors') || e.includes('content security policy');
            if (!showApprovedHint) return null;
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            return (
              <div className="text-[11px] mt-1">
                Embedded CCP is blocked by Amazon Connect frame-ancestors CSP. Set preferPopup=true (default) or add <span className="font-mono">{origin}</span> to Approved origins in Amazon Connect (Instance - Application integration), then retry. Docs: https://docs.aws.amazon.com/connect/latest/adminguide/approved-origins.html
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground mt-2">
          CCP launches via popup by default to avoid CSP. If you enable inline mode, ensure Approved origins in Amazon Connect include your site, and grant microphone permissions.
        </div>
      )}
    </div>
  );
}
