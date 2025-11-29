"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  projectId: string;
};

type ImageOption = { name: string; url: string };

export default function BrandEditor({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("");
  const [availableImages, setAvailableImages] = useState<ImageOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/brand`);
        if (res.ok) {
          const j = await res.json();
          setBrandLogoUrl(j?.brand_logo_url || "");
          setBrandPrimaryColor(j?.brand_primary_color || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    (async () => {
      try {
        // Load existing project documents to pick an already-uploaded logo/icon
        const res = await fetch(`/api/projects/${projectId}/documents`);
        if (res.ok) {
          const j = await res.json();
          const docs = Array.isArray(j?.documents) ? j.documents : [];
          const isImageUrl = (url: string) => /(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(url || "");
          const imgs: ImageOption[] = docs
            .map((d: any): ImageOption => ({ name: d.document_name || d.id || "image", url: String(d.document_file_url || "") }))
            .filter((x: ImageOption) => !!x.url && isImageUrl(x.url));
          setAvailableImages(imgs);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [projectId]);

  async function onSave() {
    try {
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/brand`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_logo_url: brandLogoUrl, brand_primary_color: brandPrimaryColor })
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || "Failed to save brand");
      } else {
        alert("Brand saved");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border p-3 space-y-3" style={{ borderColor: brandPrimaryColor || undefined }}>
      <div className="flex items-center gap-3">
        {brandLogoUrl ? (
          <img src={brandLogoUrl} alt="Project logo" className="h-10 w-10 rounded object-contain" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted" />
        )}
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Logo URL</label>
          <Input value={brandLogoUrl} onChange={(e)=>setBrandLogoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Primary Color</label>
          <Input value={brandPrimaryColor} onChange={(e)=>setBrandPrimaryColor(e.target.value)} placeholder="#0ea5e9 or rgb(...)" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Pick Logo from Uploads</label>
          <select
            className="border rounded px-2 py-2 text-sm min-w-[240px]"
            value={brandLogoUrl || ""}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
          >
            <option value="">-- Select from uploads --</option>
            {availableImages.map((img) => (
              <option key={img.url} value={img.url}>{img.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="ml-auto flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving || loading}>{saving ? "Saving..." : "Save"}</Button>
      </div>
    </div>
  );
}
