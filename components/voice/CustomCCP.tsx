"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * CustomCCP
 * Fully custom, on-theme Amazon Connect CCP built on Streams SDK.
 * The native CCP iframe is initialized invisibly; all controls are rendered using our design system.
 *
 * References:
 * - AWS Workshop (Invisible CCP)
 * - Streams cheat-sheet: https://github.com/amazon-connect/amazon-connect-streams/blob/master/cheat-sheet.md
 */
export default function CustomCCP({
  instanceUrl,
  theme = "dark",
  accentColor,
  title,
  subtitle,
  dialerLeft,
  className,
  leadId,
  contactId,
  autoStartVoiceHub,
}: {
  instanceUrl?: string;
  theme?: "dark" | "light";
  accentColor?: string;
  title?: string;
  subtitle?: string;
  dialerLeft?: boolean;
  className?: string;
  leadId?: string;
  contactId?: string;
  autoStartVoiceHub?: boolean;
}) {
  // Hidden CCP container for Streams provider
  const ccpContainerRef = useRef<HTMLDivElement | null>(null);

  // Streams and guards
  const connectRef = useRef<any>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const initRef = useRef<boolean>(false);
  // Resolved CCP URL and readiness/fallback flags
  const ccpResolvedUrlRef = useRef<string | null>(null);
  const ccpReadyRef = useRef<boolean>(false);
  const ccpFallbackAttemptedRef = useRef<boolean>(false);

  // Agent/contact session
  const agentRef = useRef<any>(null);
  const contactRef = useRef<any>(null);
  const phoneNumberRef = useRef<string>(""); // for outbound dialing (E.164)
  const hangupInProgressRef = useRef<boolean>(false); // guard against duplicate hangups

  // UI state
  const [initializing, setInitializing] = useState<boolean>(false);
  const [launched, setLaunched] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Agent / Contact / Logs
  const [agentName, setAgentName] = useState<string>("");
  const [agentState, setAgentState] = useState<string>("");
  const [routingProfile, setRoutingProfile] = useState<string>("");
  const [contactStatus, setContactStatus] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  // Dialer UI (numpad-style)
  const [displayNumber, setDisplayNumber] = useState<string>("");
  function appendDial(char: string) {
    setDisplayNumber((prev) => {
      let base = (prev || "").replace(/[^\d+]/g, "");
      if (char === "+") return base.startsWith("+") ? base : "+" + base;
      if (!base.startsWith("+")) base = "+" + base.replace(/^\+*/, "");
      const digit = char.replace(/[^\d]/g, "");
      return base + digit;
    });
  }
  function backspaceDial() {
    setDisplayNumber((prev) => {
      const base = prev || "";
      if (!base) return "";
      const next = base.slice(0, -1);
      return next === "+" ? "" : next;
    });
  }
  function clearDial() {
    setDisplayNumber("");
  }
  function sendDtmf(digit: string) {
    try {
      const conn = contactRef.current?.getAgentConnection?.();
      if (conn?.sendDigits) {
        conn.sendDigits(digit);
        logInfoMsg(`Sent DTMF ${digit}`);
      } else {
        logInfoMsg("DTMF not available on current connection");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to send DTMF");
    }
  }

  const urlBase = useMemo(() => {
    return instanceUrl || (process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "https://ledger1crm.my.connect.aws");
  }, [instanceUrl]);

  function logInfoMsg(msg: string) {
    try {
      connectRef.current?.getLog?.().info?.(msg);
    } catch { }
    setLogs((prev) => [new Date().toLocaleTimeString() + " " + msg, ...prev].slice(0, 200));
  }
  function logInfoEvent(msg: string) {
    try {
      connectRef.current?.getLog?.().info?.(msg);
    } catch { }
    setEvents((prev) => [new Date().toLocaleTimeString() + " " + msg, ...prev].slice(0, 200));
  }

  async function handleLaunch() {
    try {
      // Mic permission on user gesture
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (permErr: any) {
      setError(`Microphone permission not granted. Please allow mic access and retry. ${permErr?.message || ""}`);
    } finally {
      setLaunched(true);
    }
  }

  async function loadStreamsScript(): Promise<void> {
    // Try local vendor, then env override, then official CDNs
    const candidates: string[] = [
      "/connect/connect-streams.js",
      String(process.env.NEXT_PUBLIC_CONNECT_STREAMS_URL || ""),
      "https://cdn.connect.aws/connect-streams.js",
      "https://cdn.connect.amazon.com/connect-streams.js",
    ].filter((u) => typeof u === "string" && u.length > 0);

    for (const u of candidates) {
      try {
        if ((window as any).connect) return;
        const s = document.createElement("script");
        s.src = u;
        s.async = true;
        const p = new Promise<void>((resolve, reject) => {
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load Streams SDK from ${u}`));
        });
        document.head.appendChild(s);
        scriptRef.current = s;
        await p;
        if ((window as any).connect) return;
      } catch {
        // continue
      }
    }
    throw new Error("Amazon Connect Streams SDK not available. Vendor locally or set NEXT_PUBLIC_CONNECT_STREAMS_URL.");
  }

  // Initialize (hidden) CCP provider and bind agent/contact events
  useEffect(() => {
    let mounted = true;
    if (!launched) return;
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        setInitializing(true);
        // Load Streams
        let connect = (window as any).connect;
        if (!connect) {
          await loadStreamsScript();
          connect = (window as any).connect;
        }
        connectRef.current = connect;
        if (!connect) throw new Error("Amazon Connect Streams SDK not available");
        if (!ccpContainerRef.current) throw new Error("Hidden CCP container not ready");

        // Set logger verbosity
        const rootLogger = connect.getLog?.();
        try {
          rootLogger?.setLogLevel?.(connect.LogLevel?.DEBUG);
          rootLogger?.setEchoLevel?.(connect.LogLevel?.DEBUG);
        } catch { }

        // Prevent duplicate init across route changes
        const g = (window as any);
        if (g.__ccpProviderInit === true || g.__ccpProviderInitializing === true) {
          logInfoMsg("CCP provider already initialized; skipping");
          return;
        }
        g.__ccpProviderInitializing = true;

        // Initialize CCP invisibly (with URL probe/fallback and increased load timeouts)
        const primaryUrl = `${urlBase}/connect/ccp-v2${theme === "dark" ? "?theme=dark" : ""}`;
        const fallbackUrl = `${urlBase}/ccp-v2${theme === "dark" ? "?theme=dark" : ""}`;
        logInfoMsg(`CRM origin: ${window.location.origin}. Add this origin in Amazon Connect Approved origins.`);

        const initAt = (url: string) => {
          logInfoMsg(`Initializing CCP at ${url}`);
          connect.core.initCCP(ccpContainerRef.current, {
            ccpUrl: url,
            loginPopup: true,
            loginPopupAutoClose: true,
            loginOptions: { autoClose: true, height: 600, width: 400, top: 0, left: 0 },
            softphone: {
              allowFramedSoftphone: true,
              disableRingtone: true,
              allowFramedVideoCall: false,
              allowEarlyGum: true,
            },
            region: (process.env.AWS_REGION || "us-west-2"),
            pageOptions: {
              enableAudioDeviceSettings: true,
              enableVideoDeviceSettings: false,
              enablePhoneTypeSettings: true,
            },
            shouldAddNamespaceToLogs: false,
            ccpAckTimeout: 30000,
            ccpSynTimeout: 20000,
            ccpLoadTimeout: 60000,
          });

          // Mark ready when CCP finishes loading
          try {
            connect.core.onReady?.(() => {
              logInfoMsg("CCP ready");
              ccpReadyRef.current = true;
              ccpResolvedUrlRef.current = url;
              g.__ccpProviderInit = true;
              g.__ccpProviderInitializing = false;
            });
          } catch { }

          // Fallback: if CCP doesn't become ready within timeout, try alternate path once
          const fallbackMs = 30000 + 5000; // ccpLoadTimeout + 5s buffer
          window.setTimeout(() => {
            if (!ccpReadyRef.current && !ccpFallbackAttemptedRef.current) {
              try {
                ccpFallbackAttemptedRef.current = true;
                logInfoMsg(`CCP not ready after ${fallbackMs}ms; attempting fallback URL`);
                connect.core.terminate?.();
              } catch { }
              try {
                initAt(fallbackUrl);
              } catch (err: any) {
                setError(err?.message || "Failed to initialize CCP fallback");
                g.__ccpProviderInitializing = false;
              }
            }
          }, fallbackMs);
        }

        g.__ccpProviderInitializing = true;
        initAt(primaryUrl);

        // Subscribe to core view events
        try {
          connect.core.onViewContact((event: any) => {
            logInfoEvent(`[onViewContact] Viewing contact ${event?.contactId || "?"}`);
          });
        } catch { }

        // Subscribe to Agent
        connect.agent((agent: any) => {
          try {
            agentRef.current = agent;
            // Mark CCP ready when agent is available (robust readiness signal if core.onReady is unavailable)
            if (!ccpReadyRef.current) {
              ccpReadyRef.current = true;
              if (!ccpResolvedUrlRef.current) ccpResolvedUrlRef.current = primaryUrl;
              g.__ccpProviderInit = true;
              g.__ccpProviderInitializing = false;
            }
            setAgentName(String(agent.getName?.() || ""));
            const st = agent.getStatus?.();
            setAgentState(st?.name ? String(st.name) : "");
            setRoutingProfile(String(agent.getConfiguration?.().routingProfile?.name || ""));
            logInfoMsg(`Subscribing to agent ${agent.getName?.() || ""}`);
            logInfoMsg(`Agent status: ${agent.getStatus?.().name || ""}`);
            logInfoMsg(`Routing profile: ${agent.getConfiguration?.().routingProfile?.name || ""}`);

            agent.onRefresh?.((ag: any) => {
              logInfoEvent(`[agent.onRefresh] ${ag.getStatus?.().name || ""}`);
              setAgentState(String(ag.getStatus?.().name || ""));
            });
            agent.onStateChange?.((ag: any) => {
              logInfoEvent(`[agent.onStateChange] new=${ag?.newState} old=${ag?.oldState}`);
              const s = agentRef.current?.getStatus?.();
              setAgentState(s?.name ? String(s.name) : "");
            });
            agent.onRoutable?.((ag: any) => {
              logInfoEvent(`[agent.onRoutable] ${ag.getStatus?.().name || ""}`);
              setAgentState(String(ag.getStatus?.().name || ""));
            });
            agent.onNotRoutable?.((ag: any) => {
              logInfoEvent(`[agent.onNotRoutable] ${ag.getStatus?.().name || ""}`);
              setAgentState(String(ag.getStatus?.().name || ""));
            });
            agent.onOffline?.((ag: any) => {
              logInfoEvent(`[agent.onOffline] ${ag.getStatus?.().name || ""}`);
              setAgentState(String(ag.getStatus?.().name || ""));
            });
            agent.onAfterCallWork?.((ag: any) => {
              logInfoEvent(`[agent.onAfterCallWork] ${ag.getStatus?.().name || ""}`);
              setAgentState(String(ag.getStatus?.().name || ""));
            });
          } catch { }
        });

        // Subscribe to Contact
        connect.contact((contact: any) => {
          try {
            contactRef.current = contact;
            setContactStatus(String(contact.getStatus?.().type || ""));
            logInfoMsg("Subscribing to contact events");

            contact.onIncoming?.((c: any) => {
              logInfoEvent(`[contact.onIncoming] state=${c.getStatus?.().type || ""}`);
              setContactStatus(String(c.getStatus?.().type || ""));
            });
            contact.onAccepted?.((c: any) => {
              logInfoEvent(`[contact.onAccepted] state=${c.getStatus?.().type || ""}`);
              setContactStatus(String(c.getStatus?.().type || ""));
            });
            contact.onConnecting?.((c: any) => {
              logInfoEvent(`[contact.onConnecting] state=${c.getStatus?.().type || ""}`);
              setContactStatus(String(c.getStatus?.().type || ""));
            });
            contact.onConnected?.((c: any) => {
              logInfoEvent(`[contact.onConnected] state=${c.getStatus?.().type || ""}`);
              setContactStatus("Connected");
            });
            contact.onEnded?.((c: any) => {
              logInfoEvent(`[contact.onEnded] state=${c.getStatus?.().type || ""}`);
              setContactStatus("Ended");
              hangupInProgressRef.current = false;
            });
            contact.onDestroy?.(() => {
              logInfoEvent(`[contact.onDestroy] destroyed`);
              setContactStatus("Destroyed");
              hangupInProgressRef.current = false;
            });
          } catch { }
        });
      } catch (e: any) {
        console.error("[CUSTOM_CCP_INIT]", e);
        try {
          const g = (window as any);
          g.__ccpProviderInitializing = false;
          g.__ccpProviderInit = false;
        } catch { }
        const hint = "\nTip: vendor Streams locally under /connect/connect-streams.js or set NEXT_PUBLIC_CONNECT_STREAMS_URL.";
        setError((e?.message || String(e)) + hint);
      } finally {
        setInitializing(false);
      }
    }

    init();

    return () => {
      mounted = false;
      try {
        const s = scriptRef.current;
        if (s && s.parentNode) {
          s.parentNode.removeChild(s);
          scriptRef.current = null;
        }
        // Keep CCP upstream alive across view switches to avoid Streams StateError:
        // "There is no upstream conduit!" when other views (e.g., Engage AI) still depend on CCP.
        // If a full teardown is required, perform connect.core.terminate() from a global shutdown routine.
        const g = (window as any);
        // Preserve provider init flag so upstream remains active.
        g.__ccpProviderInit = true;
      } catch { }
    };
  }, [launched, urlBase, theme]);

  // Actions: Agent state
  function goAvailable() {
    try {
      const agent = agentRef.current;
      const states = agent?.getAgentStates?.() || [];
      const routable = states.find((s: any) => s.type === "ROUTABLE") || states[0];
      agent.setState(routable, {
        success: () => {
          logInfoMsg("Agent set to Available (routable)");
        },
        failure: () => {
          logInfoMsg("Failed to set Available");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to set Available");
    }
  }
  function goBreak() {
    try {
      const agent = agentRef.current;
      const states = agent?.getAgentStates?.() || [];
      const notRoutableCandidates = states.filter((s: any) => s.type === "NOT_ROUTABLE");
      const notRoutable = notRoutableCandidates[1] || notRoutableCandidates[0] || states.find((s: any) => s.type === "NOT_ROUTABLE");
      agent.setState(notRoutable, {
        success: () => {
          logInfoMsg("Agent set to Break (not routable)");
        },
        failure: () => {
          logInfoMsg("Failed to set Break");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to set Break");
    }
  }
  function goOffline() {
    try {
      const agent = agentRef.current;
      const states = agent?.getAgentStates?.() || [];
      const offline = states.find((s: any) => s.type === "OFFLINE") || states[0];
      agent.setState(offline, {
        success: () => {
          logInfoMsg("Agent set to Offline");
        },
        failure: () => {
          logInfoMsg("Failed to set Offline");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to set Offline");
    }
  }

  // Actions: Contact
  function acceptContact() {
    try {
      const c = contactRef.current;
      if (!c) throw new Error("No active contact");
      c.accept?.({
        success: () => {
          logInfoMsg("Accepted contact");
        },
        failure: () => {
          logInfoMsg("Failed to accept contact");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Accept failed");
    }
  }
  function disconnectContact() {
    try {
      const c = contactRef.current;
      const agentConn = c?.getAgentConnection?.();
      if (!agentConn) throw new Error("No agent connection");
      agentConn.destroy?.({
        success: () => {
          logInfoMsg("Disconnected (agent connection destroyed)");
        },
        failure: () => {
          logInfoMsg("Failed to disconnect");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Disconnect failed");
    }
  }
  function clearContact() {
    try {
      const c = contactRef.current;
      c?.clear?.({
        success: () => {
          logInfoMsg("Cleared contact");
        },
        failure: () => {
          logInfoMsg("Failed to clear contact");
        },
      });
    } catch (e: any) {
      setError(e?.message || "Clear failed");
    }
  }

  // Outbound Dial (Streams client)
  async function dialNumber(num: string) {
    try {
      const n = String(num || "").trim();
      if (!/^\+[1-9]\d{1,14}$/.test(n)) throw new Error("Invalid E.164");
      phoneNumberRef.current = n;

      // Auto-start VoiceHub session for Engage AI panel if enabled
      try {
        if (autoStartVoiceHub) {
          const walletOverride = String(localStorage.getItem("voicehub:wallet") || "").trim().toLowerCase();
          const payload: any = { leadId, contactId, source: "CustomCCP" };

          // Silent credit check + robust start with retries and correlationId
          let unlimited = false;
          try {
            const credRes = await fetch("/api/voicehub/credits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletOverride: walletOverride || undefined }),
            });
            const cred = await credRes.json().catch(() => ({}));
            if (credRes.ok) {
              const bal = Number((cred as any)?.balance?.balanceSeconds ?? 0);
              unlimited = !!(cred as any)?.balance?.unlimited;
              logInfoMsg(`VoiceHub credits: balanceSeconds=${bal}${unlimited ? " (unlimited)" : ""}`);
            } else {
              logInfoMsg(`Credit check failed: ${(cred as any)?.error || credRes.status}`);
            }
          } catch (e: any) {
            logInfoMsg(`Credit check error: ${e?.message || String(e)}`);
          }

          // SuperAdmin skip: owner wallet has unlimited
          const owner = String(process.env.NEXT_PUBLIC_OWNER_WALLET || "").toLowerCase();
          const isOwner = !!walletOverride && walletOverride === owner;

          const correlationId = `crm:${String(leadId || "none")}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
          const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

          let started = false;
          for (let attempt = 1; attempt <= 3 && !started; attempt++) {
            // Open Console on first attempt only if credits not unlimited and not SuperAdmin
            if (attempt === 1 && !unlimited && !isOwner) {
              try {
                const vhBase = String(process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || "").trim();
                if (vhBase) {
                  const win = window.open(`${vhBase}/console`, "_blank", "noopener,noreferrer");
                  if (!win) {
                    logInfoMsg("Popup blocked for VoiceHub Console; enable popups to approve credits");
                  }
                } else {
                  logInfoMsg("NEXT_PUBLIC_VOICEHUB_BASE_URL not set; cannot open Console for credit approval");
                }
              } catch (openErr: any) {
                logInfoMsg(`Failed to open VoiceHub Console: ${openErr?.message || String(openErr)}`);
              }
            }

            const res = await fetch("/api/voicehub/control", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ command: "start", payload, walletOverride: walletOverride || undefined, correlationId }),
            });
            if (res.ok) {
              started = true;
              logInfoMsg(`Requested VoiceHub auto-start (attempt ${attempt})`);
            } else {
              logInfoMsg(`VoiceHub start request failed (attempt ${attempt}): ${res.status}`);
              await sleep(400 * attempt); // exponential backoff
            }
          }

          if (!started) {
            logInfoMsg("VoiceHub start failed after retries");
          }
        }
      } catch (e: any) {
        logInfoMsg(`VoiceHub auto-start failed: ${e?.message || String(e)}`);
      }

      // Use Streams Agent.connect with Endpoint.byPhoneNumber for outbound
      const winAny = (window as any);
      const agent =
        agentRef.current ||
        (typeof winAny.connect?.agent === "function" ? winAny.connect.agent() : null);
      if (!agent) throw new Error("Agent not initialized");

      // Optional: ensure agent is routable; otherwise Agent.connect may fail
      try {
        const st = agent.getState?.();
        if (st?.type && st.type !== (winAny.connect?.AgentStateType?.ROUTABLE || "ROUTABLE")) {
          logInfoMsg(`Agent state is ${st?.type}; outbound may fail unless routable`);
        }
      } catch { }

      const ep = winAny.connect?.Endpoint?.byPhoneNumber
        ? winAny.connect.Endpoint.byPhoneNumber(n)
        : null;
      if (!ep) throw new Error("Streams Endpoint API not available");

      await new Promise<void>((resolve, reject) => {
        agent.connect(ep, {
          success: () => resolve(),
          failure: () => reject(new Error("Failed to start outbound call")),
        });
      });

      logInfoMsg(`Dialing ${n}`);
    } catch (e: any) {
      setError(e?.message || "Dial failed");
    }
  }

  function hangupActive() {
    try {
      // Request VoiceHub stop listening when Hang Up is pressed
      try {
        const walletOverride = String(localStorage.getItem("voicehub:wallet") || "").trim().toLowerCase();
        const payload: any = { leadId, contactId, source: "CustomCCP" };
        void fetch("/api/voicehub/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "stop", payload, walletOverride: walletOverride || undefined }),
        })
          .then(() => logInfoMsg("Requested VoiceHub stop listening"))
          .catch((e) => logInfoMsg(`VoiceHub stop failed: ${e?.message || String(e)}`));
      } catch { }
      const c = contactRef.current;
      if (!c) throw new Error("No active contact");
      if (hangupInProgressRef.current) {
        logInfoMsg("Hangup already in progress; ignoring duplicate request");
        return;
      }
      hangupInProgressRef.current = true;

      const agentConn = c.getAgentConnection?.();
      let attempted = false;

      if (agentConn?.destroy) {
        attempted = true;
        agentConn.destroy({
          success: () => {
            logInfoMsg("Disconnected (agent connection destroyed)");
          },
          failure: () => {
            logInfoMsg("Destroy failed; attempting clear()");
            try {
              c.clear?.({
                success: () => {
                  logInfoMsg("Cleared contact after destroy failure");
                },
                failure: () => {
                  try {
                    c.completeContact?.();
                    logInfoMsg("Completed contact after clear failure");
                  } catch (e) {
                    setError("Failed to complete contact after clear failure");
                  }
                },
              });
            } catch (e: any) {
              setError(e?.message || "Clear failed after destroy failure");
            }
          },
        });

        // Fallback timeout if neither onEnded nor onDestroy fires
        window.setTimeout(() => {
          try {
            if (hangupInProgressRef.current) {
              const st = c.getStatus?.()?.type || "";
              if (st !== "Ended" && st !== "Destroyed") {
                logInfoMsg("Hangup timeout; attempting clear()");
                c.clear?.({
                  success: () => {
                    logInfoMsg("Cleared contact on timeout");
                    hangupInProgressRef.current = false;
                  },
                  failure: () => {
                    try {
                      c.completeContact?.();
                      logInfoMsg("Completed contact on timeout after clear failure");
                    } catch (e) {
                      // swallow
                    } finally {
                      hangupInProgressRef.current = false;
                    }
                  },
                });
              } else {
                hangupInProgressRef.current = false;
              }
            }
          } catch {
            hangupInProgressRef.current = false;
          }
        }, 5000);

        return;
      }

      // If no agent connection destroy available, try clear then complete
      if (c.clear) {
        attempted = true;
        c.clear({
          success: () => {
            logInfoMsg("Cleared contact");
          },
          failure: () => {
            try {
              c.completeContact?.();
              logInfoMsg("Completed contact after clear failure");
            } catch (e) {
              setError("Failed to complete contact");
            }
          },
        });
        return;
      }

      if (c.completeContact) {
        attempted = true;
        c.completeContact();
        logInfoMsg("Completed contact");
        return;
      }

      if (!attempted) throw new Error("No supported hangup method available");
    } catch (e: any) {
      setError(e?.message || "Hangup failed");
    }
  }

  // postMessage bridge for DialerPanel integration
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      try {
        const allowedOrigins = (() => {
          const arr: string[] = [window.location.origin];
          const base = String(process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "").replace(/\/+$/, "");
          if (base) arr.push(base);
          try {
            const resolved = ccpResolvedUrlRef.current || urlBase;
            if (resolved) arr.push(new URL(resolved).origin);
          } catch { }
          return arr.filter(Boolean);
        })();
        if (!allowedOrigins.includes(ev.origin)) return;
        const data: any = ev.data || {};
        const type = String(data?.type || "");
        if (type === "softphone:setNumber") {
          phoneNumberRef.current = String(data?.number || "");
          ev.source?.postMessage({ type: "softphone:status", status: contactStatus || "" }, { targetOrigin: ev.origin });
        } else if (type === "softphone:dial") {
          void dialNumber(phoneNumberRef.current);
        } else if (type === "softphone:hangup") {
          hangupActive();
        } else if (type === "softphone:getStatus") {
          ev.source?.postMessage({ type: "softphone:status", status: contactStatus || "" }, { targetOrigin: ev.origin });
        }
      } catch { }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactStatus]);

  // Suppress benign Streams SDK console errors for known noisy patterns
  useEffect(() => {
    const original = console.error;
    function filtered(...args: any[]) {
      try {
        const flat = args.map(a => (typeof a === "string" ? a : (a?.message || ""))).join(" ");
        const noHandler = flat.includes("No handler for invoked request");
        const deviceEnum = flat.includes("Failed to enumerate media devices");
        const asyncLoader = flat.includes("fac.asyncLoader") || flat.includes("Item failed to load within timeout");
        const routerReqErr = flat.includes("engine.router.requestErrorHandler");
        if (noHandler || deviceEnum || asyncLoader || routerReqErr) {
          return;
        }
      } catch { }
      original(...args);
    }
    console.error = filtered as any;
    return () => {
      console.error = original;
    };
  }, []);

  // Use theme primary color unless an explicit accentColor is provided
  const accent = accentColor || "hsl(var(--primary))";
  const agentColOrder = dialerLeft ? "md:order-2" : "md:order-1";
  const dialerColOrder = dialerLeft ? "md:order-1" : "md:order-2";

  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${className || ""}`}>
      {/* Header */}
      <div
        className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${theme === "dark" ? "bg-gradient-to-r from-slate-900 to-slate-800" : "bg-gradient-to-r from-white to-slate-50"
          } border`}
        style={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-md" style={{ backgroundColor: accent }} />
          <div className="flex flex-col">
            <div className="text-xs font-semibold">{title || "Custom Softphone"}</div>
            {subtitle ? <div className="text-[10px] text-muted-foreground">{subtitle}</div> : null}
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
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                try {
                  const fallback = `${urlBase}/connect/ccp-v2${theme === "dark" ? "?theme=dark" : ""}`;
                  const full = ccpResolvedUrlRef.current || fallback;
                  const win = window.open(full, "_blank", "noopener,noreferrer");
                  if (!win) setError("Popup blocked. Please allow popups for this site.");
                } catch (e: any) {
                  setError(e?.message || "Failed to open CCP");
                }
              }}
              className="h-7"
            >
              Open Native CCP
            </Button>
          )}
        </div>
      </div>

      {/* Hidden CCP iframe container */}
      <div ref={ccpContainerRef} style={{ display: "none" }} />

      <div className="grid md:grid-cols-2 gap-3">
        <div className={`space-y-3 ${agentColOrder}`}>
          {/* Agent panel */}
          <section className="rounded-md border bg-background p-3" style={{ borderColor: accent }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">Agent</div>
              {routingProfile ? <div className="microtext text-muted-foreground">RP: {routingProfile}</div> : null}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              {agentName ? (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">{agentName}</span>
              ) : null}
              {agentState ? (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800">{agentState}</span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={goAvailable}>
                Go Available
              </Button>
              <Button variant="outline" onClick={goBreak}>
                Go Break
              </Button>
              <Button variant="outline" onClick={goOffline}>
                Go Offline
              </Button>
            </div>
          </section>

          {/* Contact actions */}
          <section className="rounded-md border bg-background p-3 mt-3" style={{ borderColor: accent }}>
            <div className="text-xs font-semibold">Contact</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={acceptContact}>
                Answer Incoming
              </Button>
              <Button variant="outline" onClick={hangupActive}>
                Hang Up
              </Button>
              <Button variant="outline" onClick={clearContact}>
                Close Contact
              </Button>
            </div>
          </section>
        </div>

        {/* Outbound dialer (compact, frosted glass) */}
        <section className={`rounded-md border p-3 ${dialerColOrder}`} style={{ borderColor: accent }}>
          <div className="rounded-xl border border-primary/30 bg-white/10 dark:bg-slate-900/30 backdrop-blur-md p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="md:col-span-3">
                <label className="text-xs font-medium">Number (E.164)</label>
                <Input
                  placeholder="+15551234567"
                  value={displayNumber}
                  onChange={(e) => setDisplayNumber(e.target.value)}
                  className="h-8"
                />
              </div>

              <div className="md:col-span-1 flex md:block items-stretch md:h-full">
                <Button
                  className="w-full h-12 md:h-full min-h-[200px] text-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => dialNumber(displayNumber)}
                  disabled={!String(displayNumber || "").trim()}
                >
                  Dial
                </Button>
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("1")}>1</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("2")}>2</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("3")}>3</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("4")}>4</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("5")}>5</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("6")}>6</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("7")}>7</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("8")}>8</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("9")}>9</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("+")}>+</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary bg-primary/10 hover:bg-primary/20" onClick={() => appendDial("0")}>0</Button>
                  <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={backspaceDial}>⌫</Button>
                  <Button variant="outline" className="h-10 md:h-12 col-span-3 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={clearDial}>Clear</Button>
                </div>
              </div>

              {contactStatus === "Connected" && (
                <div className="md:col-span-1">
                  <div className="text-xs font-semibold mb-1">DTMF</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("1")}>1</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("2")}>2</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("3")}>3</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("4")}>4</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("5")}>5</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("6")}>6</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("7")}>7</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover/bg-primary/10" onClick={() => sendDtmf("8")}>8</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("9")}>9</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("0")}>0</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("*")}>*</Button>
                    <Button variant="outline" className="h-10 md:h-12 border-primary/40 text-primary/80 hover:bg-primary/10" onClick={() => sendDtmf("#")}>#</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="microtext text-muted-foreground mt-2">
            Outbound uses Agent.connect with Endpoint.byPhoneNumber. Ensure the agent is Routable and CCP is initialized.
          </div>
        </section>
      </div>

      {/* Logs */}
      <section className="rounded-md border bg-background p-3 mt-3" style={{ borderColor: accent }}>
        <div className="text-xs font-semibold mb-2">Events</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium">Log Messages</label>
            <Textarea value={logs.join("\n")} readOnly rows={6} className="text-[11px]" />
          </div>
          <div>
            <label className="text-[11px] font-medium">Event Messages</label>
            <Textarea value={events.join("\n")} readOnly rows={6} className="text-[11px]" />
          </div>
        </div>
      </section>

      {/* Helper + errors */}
      <div className="mt-2 text-[11px] text-muted-foreground">
        CCP runs invisibly with loginPopup. Add your site origin to Approved origins in Amazon Connect for inline
        permissions if needed.
      </div>
      {error ? <div className="mt-2 text-[11px] text-red-600">{error}</div> : null}
    </div>
  );
}
