"use client";

import React from "react";
import { Button } from "@/components/ui/button";

function truncate(href: string, max = 60) {
  try {
    const u = new URL(href);
    const host = u.hostname;
    const path = u.pathname + (u.search || "");
    const base = host + path;
    if (base.length <= max) return base;
    return base.slice(0, max - 3) + "...";
  } catch {
    return href.length > max ? href.slice(0, max - 3) + "..." : href;
  }
}

export default function BlobLink({ href }: { href: string }) {
  if (!href) return null;
  const label = truncate(href, 50);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground truncate max-w-[220px]">{label}</span>
      <a href={href} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm">Open</Button>
      </a>
    </div>
  );
}
