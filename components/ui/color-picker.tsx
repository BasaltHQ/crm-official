"use client";

import React, { useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    disabled?: boolean;
    className?: string;
}

// Preset colors for quick selection
const PRESET_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#0ea5e9", // sky blue
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#64748b", // slate
    "#000000", // black
];

export function ColorPicker({ value, onChange, disabled, className }: ColorPickerProps) {
    const [open, setOpen] = useState(false);

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
                    <div
                        className="h-5 w-5 rounded border border-white/20 shrink-0"
                        style={{ backgroundColor: value || "#0ea5e9" }}
                    />
                    <span className="font-mono text-sm truncate">
                        {value || "Select a color..."}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-3" align="start">
                {/* Full spectrum color picker */}
                <HexColorPicker
                    color={value || "#0ea5e9"}
                    onChange={onChange}
                    style={{ width: "100%" }}
                />

                {/* Hex input for precise values */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">#</span>
                    <HexColorInput
                        color={value || "#0ea5e9"}
                        onChange={onChange}
                        prefixed={false}
                        className="flex-1 h-8 px-2 text-sm font-mono bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                {/* Preset color swatches */}
                <div className="grid grid-cols-6 gap-1.5">
                    {PRESET_COLORS.map((presetColor) => (
                        <button
                            key={presetColor}
                            type="button"
                            className={cn(
                                "h-6 w-6 rounded-md border border-white/10 transition-transform hover:scale-110",
                                value === presetColor && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                            )}
                            style={{ backgroundColor: presetColor }}
                            onClick={() => onChange(presetColor)}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ColorPicker;
