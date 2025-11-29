"use client";

import React from "react";
import CustomCCP from "@/components/voice/CustomCCP";

/**
 * ChimeBridgePanel (simplified)
 * Requirement: Only render the Custom CCP softphone UI.
 * All legacy Chime diagnostics, keypad, and CCP alternatives have been removed.
 */
export default function ChimeBridgePanel({ leadId }: { leadId?: string }) {
  return (
    <div className="rounded border bg-card p-2">
      <CustomCCP title="Engage Human Softphone" subtitle="Dialer left; agent settings right" dialerLeft />
    </div>
  );
}
