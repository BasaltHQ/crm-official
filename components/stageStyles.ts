export type PipelineStage = "Identify" | "Engage_AI" | "Engage_Human" | "Offering" | "Finalizing" | "Closed";

export const STAGE_NODE_CLASS: Record<PipelineStage, string> = {
  Identify: "bg-slate-400 dark:bg-slate-500",
  Engage_AI: "bg-blue-500 dark:bg-blue-400",
  Engage_Human: "bg-violet-500 dark:bg-violet-400",
  Offering: "bg-amber-500 dark:bg-amber-400",
  Finalizing: "bg-teal-500 dark:bg-teal-400",
  Closed: "bg-green-500 dark:bg-green-400",
};

export const STAGE_TEXT_CLASS: Record<PipelineStage, string> = {
  Identify: "text-slate-700 dark:text-slate-300",
  Engage_AI: "text-blue-700 dark:text-blue-300",
  Engage_Human: "text-violet-700 dark:text-violet-300",
  Offering: "text-amber-700 dark:text-amber-300",
  Finalizing: "text-teal-700 dark:text-teal-300",
  Closed: "text-green-700 dark:text-green-300",
};

export const STAGE_BADGE_CLASS: Record<PipelineStage, string> = {
  Identify: "px-2 py-1 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
  Engage_AI: "px-2 py-1 rounded text-xs font-semibold bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  Engage_Human: "px-2 py-1 rounded text-xs font-semibold bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-200",
  Offering: "px-2 py-1 rounded text-xs font-semibold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
  Finalizing: "px-2 py-1 rounded text-xs font-semibold bg-teal-200 dark:bg-teal-900 text-teal-800 dark:text-teal-200",
  Closed: "px-2 py-1 rounded text-xs font-semibold bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200",
};

export function formatStageLabel(stage: PipelineStage | string | null | undefined) {
  if (!stage) return "-";
  return String(stage).replace("_", " ");
}
