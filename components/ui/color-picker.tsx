"use client";

import React, { useState } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Presentation } from "lucide-react";

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    disabled?: boolean;
    className?: string;
}

// Generate tints and shades
function generateTintsAndShades(hex: string) {
    if (!hex) return { tints: [], shades: [] };

    // Expand shorthand
    const fullHex = (hex.length === 4 || hex.length === 5)
        ? "#" + hex.slice(1).split('').map(x => x + x).join('')
        : hex;

    const r = parseInt(fullHex.slice(1, 3), 16);
    const g = parseInt(fullHex.slice(3, 5), 16);
    const b = parseInt(fullHex.slice(5, 7), 16);
    const hasAlpha = fullHex.length > 7;
    const a = hasAlpha ? fullHex.slice(7, 9) : "";

    const tint = (start: number, factor: number) => Math.round(start + (255 - start) * factor);
    const shade = (start: number, factor: number) => Math.round(start * (1 - factor));

    const toHex = (n: number) => {
        const s = Math.min(255, Math.max(0, n)).toString(16);
        return s.length === 1 ? "0" + s : s;
    };

    const tints = [];
    const shades = [];
    const steps = 5;

    for (let i = 1; i <= steps; i++) {
        const factor = i / (steps + 1);

        // Shade
        const sr = shade(r, factor);
        const sg = shade(g, factor);
        const sb = shade(b, factor);
        shades.push(`#${toHex(sr)}${toHex(sg)}${toHex(sb)}${a}`);

        // Tint
        const tr = tint(r, factor);
        const tg = tint(g, factor);
        const tb = tint(b, factor);
        tints.push(`#${toHex(tr)}${toHex(tg)}${toHex(tb)}${a}`);
    }

    return { tints: tints.reverse(), shades };
}

// Preset colors for quick selection
const PRESET_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#14b8a6", "#0ea5e9", "#3b82f6", "#8b5cf6",
    "#d946ef", "#ec4899", "#64748b", "#000000",
];

export function ColorPicker({ value, onChange, disabled, className }: ColorPickerProps) {
    const [open, setOpen] = useState(false);
    const [isEyeDropperSupported, setIsEyeDropperSupported] = useState(false);

    React.useEffect(() => {
        if (typeof window !== "undefined" && "EyeDropper" in window) {
            setIsEyeDropperSupported(true);
        }
    }, []);

    const handleEyeDropper = async () => {
        if (!isEyeDropperSupported) return;
        try {
            // @ts-ignore
            const eyeDropper = new window.EyeDropper();
            // @ts-ignore
            const result = await eyeDropper.open();
            onChange(result.sRGBHex);
        } catch (e) {
            console.log("EyeDropper canceled or failed", e);
        }
    };

    const { tints, shades } = generateTintsAndShades(value || "#0ea5e9");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild disabled={disabled}>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start gap-2 h-10 px-3",
                        className
                    )}
                    disabled={disabled}
                >
                    <div className="relative h-5 w-5 rounded border border-white/20 shrink-0 overflow-hidden">
                        {/* Texture for alpha */}
                        <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iLjQiLz48L3N2Zz4=')] opacity-50" />
                        <div
                            className="absolute inset-0 z-10"
                            style={{ backgroundColor: value || "#0ea5e9" }}
                        />
                    </div>
                    <span className="font-mono text-sm truncate uppercase">
                        {value || "Select a color..."}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-3 space-y-3" align="start">
                <div className="space-y-4">
                    {/* Full spectrum color picker with alpha */}
                    <div className="custom-color-picker [&_.react-colorful__saturation]:!rounded-md [&_.react-colorful__hue]:!rounded-md [&_.react-colorful__alpha]:!rounded-md [&_.react-colorful__hue]:!my-2 [&_.react-colorful__alpha]:!my-2 [&_.react-colorful__hue]:!h-3 [&_.react-colorful__alpha]:!h-3">
                        <HexAlphaColorPicker
                            color={value || "#0ea5e9"}
                            onChange={onChange}
                            style={{ width: "100%" }}
                        />
                    </div>

                    {/* Hex input for precise values */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground font-mono">#</span>
                        <HexColorInput
                            color={value || "#0ea5e9"}
                            onChange={onChange}
                            prefixed={false}
                            alpha={true}
                            className="flex-1 h-8 px-2 text-sm font-mono bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                        />
                        {isEyeDropperSupported && (
                            <button
                                onClick={handleEyeDropper}
                                className="h-8 w-8 flex items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                                title="Pick from Screen"
                            >
                                <Presentation className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="h-px bg-neutral-800/50" />

                    {/* Tints & Shades */}
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Variations</div>
                        <div className="grid grid-cols-10 gap-1 mb-1">
                            {tints.map((color, i) => (
                                <button
                                    key={`tint-${i}`}
                                    className="w-full aspect-square rounded-sm border border-white/5 hover:scale-110 hover:z-10 transition-transform relative overflow-hidden"
                                    style={{ backgroundColor: color }}
                                    onClick={() => onChange(color)}
                                    title={color}
                                >
                                    {/* Texture for alpha */}
                                    <div className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iLjQiLz48L3N2Zz4=')] opacity-50" />
                                </button>
                            ))}
                            {shades.map((color, i) => (
                                <button
                                    key={`shade-${i}`}
                                    className="w-full aspect-square rounded-sm border border-white/5 hover:scale-110 hover:z-10 transition-transform relative overflow-hidden"
                                    style={{ backgroundColor: color }}
                                    onClick={() => onChange(color)}
                                    title={color}
                                >
                                    {/* Texture for alpha */}
                                    <div className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iLjQiLz48L3N2Zz4=')] opacity-50" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preset color swatches */}
                    <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Presets</div>
                        <div className="grid grid-cols-6 gap-1.5">
                            {PRESET_COLORS.map((presetColor) => (
                                <button
                                    key={presetColor}
                                    type="button"
                                    className={cn(
                                        "h-6 w-6 rounded-md border border-white/10 transition-transform hover:scale-110 relative overflow-hidden",
                                        value === presetColor && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                                    )}
                                    style={{ backgroundColor: presetColor }}
                                    onClick={() => onChange(presetColor)}
                                >
                                    {/* Texture for alpha */}
                                    <div className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMzMzMiIGZpbGwtb3BhY2l0eT0iLjQiLz48L3N2Zz4=')] opacity-50" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ColorPicker;
