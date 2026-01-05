"use client";

import React from "react";

type UnfurlData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

function isHttpUrl(u?: string) {
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

export default function LinkPreview({ href, className, compact = false, tiny = false }: { href: string; className?: string; compact?: boolean; tiny?: boolean }) {
  const [data, setData] = React.useState<UnfurlData | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    async function run() {
      try {
        if (!isHttpUrl(href)) return;
        setLoading(true);
        const res = await fetch(`/api/og/unfurl?url=${encodeURIComponent(href)}`);
        if (!res.ok) throw new Error(await res.text());
        const j = (await res.json()) as UnfurlData;
        if (!active) return;
        setData(j);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Failed to load link preview");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [href]);

  if (!isHttpUrl(href)) return null;

  return (
    <div className={
      "rounded-md border bg-card " + (compact || tiny ? "p-1" : "p-2") +
      " flex " + (tiny ? "gap-1 items-center" : "gap-2 items-center") +
      " " + (className || "")
    }>
      {/* Image */}
      <div className={
        (tiny ? "w-6 h-6" : compact ? "w-10 h-10" : "w-20 h-20") +
        " flex-shrink-0 rounded bg-muted overflow-hidden"
      }>
        {loading ? (
          <div className="w-full h-full animate-pulse bg-muted" />
        ) : data?.image ? (

          <img src={data.image} alt={data.title || data.url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
        )}
      </div>
      {/* Text block */}
      <div className="min-w-0 flex-1">
        {!tiny && (
          <div className="text-xs text-muted-foreground truncate">{data?.siteName || (new URL(href).hostname)}</div>
        )}
        <div className={tiny ? "text-xs font-medium truncate" : compact ? "text-xs font-medium truncate" : "text-sm font-semibold truncate"}>{loading ? "Loading…" : (data?.title || href)}</div>
        {!compact && !tiny && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{data?.description || " "}</div>
        )}
        {!compact && !tiny && (
          <a href={href} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block truncate">
            {href}
          </a>
        )}
        {error && (
          <div className="text-[10px] text-red-600 mt-1">{error}</div>
        )}
      </div>
    </div>
  );
}
