"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CustomCCP from "@/components/voice/CustomCCP";

/**
 * AzureCoachPanel
 * Lightweight WebRTC client to connect to Azure OpenAI Realtime for live coaching during calls.
 * - Starts a Realtime session via /api/voice/azure/session
 * - Negotiates WebRTC (recv remote audio; send mic)
 * - Sends session.update with coaching instructions (no tools)
 */
export default function AzureCoachPanel() {
  const [connecting, setConnecting] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const start = async () => {
    setError(null);
    setConnecting(true);
    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.addTransceiver("audio", { direction: "recvonly" });

      // Capture mic (optional; can be disabled if you only want text)
      const local = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      for (const track of local.getAudioTracks()) pc.addTrack(track, local);

      const dc = pc.createDataChannel("oai");
      dcRef.current = dc;
      dc.onopen = () => {
        const instructions = `
You are an on-call sales coach.
- Listen to the ongoing call context as provided by the model runtime.
- Provide short, timely suggestions in English to the human agent via the data channel.
- Suggestions must be concise (<= 1 sentence) and focus on next best action (ask, probe, propose, or close).
- Do not address the customer directly; you are only coaching the agent.
`;
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions,
            modalities: ["audio", "text"],
            model: process.env.NEXT_PUBLIC_AZURE_OPENAI_REALTIME_DEPLOYMENT || "gpt-realtime",
            voice: "marin",
          },
        } as any;
        dc.send(JSON.stringify(sessionUpdate));
        const kickoff = { type: "response.create", response: { instructions: "Begin coaching with a brief greeting and one suggestion for opening the call." } } as any;
        dc.send(JSON.stringify(kickoff));
      };

      pc.ondatachannel = (ev) => {
        const ch = ev.channel;
        dcRef.current = ch;
      };

      // Get ephemeral token
      const sess = await fetch("/api/voice/azure/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!sess.ok) throw new Error(await sess.text());
      const sj = await sess.json();
      const clientSecret = sj?.client_secret?.value || sj?.client_secret || sj?.token;
      if (!clientSecret) throw new Error("No client_secret from session");

      // SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const base = process.env.NEXT_PUBLIC_AZURE_OPENAI_REALTIME_WEBRTC_URL;
      const dep = process.env.NEXT_PUBLIC_AZURE_OPENAI_REALTIME_DEPLOYMENT;
      const ver = process.env.NEXT_PUBLIC_AZURE_OPENAI_REALTIME_API_VERSION;
      if (!base) throw new Error("Realtime WebRTC URL not configured");
      const url = `${base}?deployment=${encodeURIComponent(dep || "")}&api-version=${encodeURIComponent(ver || "")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp", Accept: "application/sdp", Authorization: `Bearer ${clientSecret}` },
        body: offer.sdp || "",
      });
      if (!res.ok) throw new Error(await res.text());
      const answer = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      setActive(true);
      setConnecting(false);
    } catch (e: any) {
      setError(e?.message || "Failed to start coach");
      setConnecting(false);
      stop();
    }
  };

  const stop = () => {
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); pcRef.current?.close(); } catch {}
    pcRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="rounded border bg-card p-2">
      <CustomCCP title="Engage AI Softphone" subtitle="Dialer left; agent settings right" dialerLeft />
      <div className="text-xs font-semibold mb-2">AI Coach (Azure Realtime)</div>
      <div className="flex items-center gap-2 mb-2">
        <Button onClick={start} disabled={active || connecting}>{connecting ? "Connecting…" : (active ? "Active" : "Start Coach")}</Button>
        <Button onClick={stop} variant="outline" disabled={!active}>Stop</Button>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      </div>
      <audio ref={remoteAudioRef} className="hidden" autoPlay playsInline />
      <div className="text-[11px] text-muted-foreground">Coach runs locally in your browser. It will not speak to the customer; only brief suggestions are produced.</div>
    </div>
  );
}
