"use client";

import React, { useMemo } from "react";
import { STAGE_NODE_CLASS, STAGE_TEXT_CLASS, type PipelineStage } from "@/components/stageStyles";

export type StageDatum = {
  key: PipelineStage;
  label: string;
  count: number;
};

type Props = {
  stages: StageDatum[];
  total: number;
  orientation?: "horizontal" | "vertical";
  nodeSize?: number; // px
  showMetadata?: boolean;
  trackHeight?: number; // px for vertical orientation
  onStageClick?: (stage: PipelineStage) => void;
  // New optional behavior controls (default to legacy behavior)
  coloringMode?: "static" | "activated"; // static: always stage color; activated: color only up to active stage
  activeStageKey?: PipelineStage | null; // current stage when coloringMode == "activated"
  isClosed?: boolean; // if true, whole bar turns green
  showMicroStatus?: boolean; // if true, show micro status under the bar
  microStatusText?: string; // typically "In Progress" | "Complete"
  showLabelsAndCounts?: boolean; // show labels/counts below nodes (legacy behavior). Default true.
};

const STAGE_ORDER: PipelineStage[] = [
  "Identify",
  "Engage_AI",
  "Engage_Human",
  "Offering",
  "Finalizing",
  "Closed",
];

function pct(count: number, total: number) {
  const denom = total > 0 ? total : 1;
  return Math.round((count / denom) * 100);
}

function nodeClassFor(
  stage: PipelineStage,
  opts: { coloringMode?: Props["coloringMode"]; activeStageKey?: PipelineStage | null; isClosed?: boolean }
) {
  const { coloringMode = "static", activeStageKey, isClosed } = opts;
  if (isClosed) return "bg-green-500 dark:bg-green-400";
  if (coloringMode === "static") return STAGE_NODE_CLASS[stage];
  // activated mode: color nodes up to and including the active stage; else make colorless
  const activeIdx = activeStageKey ? STAGE_ORDER.indexOf(activeStageKey) : 0;
  const thisIdx = STAGE_ORDER.indexOf(stage);
  if (thisIdx === -1) return STAGE_NODE_CLASS[stage];
  return thisIdx <= activeIdx ? STAGE_NODE_CLASS[stage] : "bg-secondary";
}

export default function StageProgressBar({
  stages,
  total,
  orientation = "horizontal",
  nodeSize = 12,
  showMetadata = false,
  trackHeight = 360,
  onStageClick,
  coloringMode = "static",
  activeStageKey = null,
  isClosed = false,
  showMicroStatus = false,
  microStatusText,
  showLabelsAndCounts = true,
}: Props) {
  const sizePx = `${nodeSize}px`;
  const halfPx = `${nodeSize / 2}px`;
  const offsetPx = nodeSize / 2 + 8;

  const railClass = isClosed ? "bg-green-500 dark:bg-green-400" : "bg-secondary";

  if (orientation === "vertical") {
    return (
      <div className="flex justify-center items-start gap-2 w-full">
        {/* Vertical track */}
        <div className="relative mx-auto">
          <div className="relative" style={{ height: `${trackHeight}px`, width: "3px" }}>
            <div className={`absolute left-1/2 -translate-x-1/2 rounded`} style={{ top: halfPx, bottom: halfPx, width: "3px" }}>
              <div className={`w-full h-full ${railClass}`} />
            </div>
            <div className="absolute inset-0" style={{ top: halfPx, bottom: halfPx }}>
              {stages.map((s, i) => (
                <React.Fragment key={`node-${s.key}`}>
                  {/* Dot centered on the rail */}
                  <div
                    className={`absolute z-10 rounded-full cursor-pointer ${nodeClassFor(s.key, { coloringMode, activeStageKey, isClosed })}`}
                    style={{
                      top: `${(i / (stages.length - 1)) * 100}%`,
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: sizePx,
                      height: sizePx,
                    }}
                    aria-label={`${s.label}: ${s.count} (${pct(s.count, total)}%)`}
                    role="button"
                    onClick={() => onStageClick?.(s.key)}
                  />
                  {/* Metadata to the right of the rail */}
                  {showMetadata && (
                    <div
                      className="absolute text-xs"
                      style={{ top: `${(i / (stages.length - 1)) * 100}%`, left: `calc(50% + ${offsetPx}px)`, transform: "translateY(-50%)" }}
                    >
                      <div className={`font-semibold leading-tight whitespace-nowrap tracking-tight ${STAGE_TEXT_CLASS[s.key]}`}>{s.label}</div>
                      <div className="text-muted-foreground leading-tight whitespace-nowrap">
                        {s.count} / {total > 0 ? total : 0} ({pct(s.count, total)}%)
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          {showMicroStatus && microStatusText && (
            <div className={`text-[10px] mt-1 ${isClosed ? "text-green-600" : "text-muted-foreground"}`}>{microStatusText}</div>
          )}
        </div>
      </div>
    );
  }

  // Horizontal
  return (
    <div className="space-y-2">
      {/* Track */}
      <div className="relative h-6">
        {/* Rail segments between nodes */}
        {Array.from({ length: stages.length - 1 }).map((_, i) => (
          <div
            key={`hseg-${i}`}
            className={`absolute top-1/2 -translate-y-1/2 h-[3px] rounded ${railClass}`}
            style={{
              left: `calc(${(((2 * i + 1) / 12) * 100).toFixed(4)}% + ${nodeSize / 2}px)`,
              width: `calc(${(((2 / 12) * 100)).toFixed(4)}% - ${nodeSize}px)`,
            }}
          />
        ))}
        {/* Node positions */}
        <div className="absolute inset-0 grid grid-cols-6 items-center justify-items-center">
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              className="relative flex flex-col items-center justify-center group cursor-pointer"
              onClick={() => onStageClick?.(s.key)}
              aria-label={`${s.label}: ${s.count} (${pct(s.count, total)}%)`}
            >
              <div
                className={`rounded-full ${nodeClassFor(s.key, { coloringMode, activeStageKey, isClosed })}`}
                style={{ width: sizePx, height: sizePx }}
              />
              {showMetadata && (
                <div className="pointer-events-none absolute -top-7 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow group-hover:opacity-100 transition">
                  {s.label}: {s.count} ({pct(s.count, total)}%)
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Labels & counts under nodes */}
      {showLabelsAndCounts && (
        <div className="grid grid-cols-6 gap-0 justify-items-center mt-2">
          {stages.map((s) => (
              <div key={`label-${s.key}`} className="w-full flex flex-col items-center text-center">
              <div className={`text-xs font-semibold leading-tight whitespace-nowrap tracking-tight ${STAGE_TEXT_CLASS[s.key]}`}>{s.label}</div>
              <div className="text-xs text-muted-foreground leading-tight whitespace-nowrap">
                {s.count} / {total > 0 ? total : 0} ({pct(s.count, total)}%)
              </div>
            </div>
          ))}
        </div>
      )}
      {showMicroStatus && microStatusText && (
        <div className={`text-[10px] mt-1 ${isClosed ? "text-green-600" : "text-muted-foreground"}`}>{microStatusText}</div>
      )}
    </div>
  );
}
