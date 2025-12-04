"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Users2,
  Zap,
  Contact,
  LandmarkIcon,
  HeartHandshake,
  Coins,
  FilePenLine,
  FolderKanban,
  CheckSquare,
  Target,
  FileText,
  HardDrive,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Map icon names to actual icon components
const iconMap: Record<string, LucideIcon> = {
  DollarSign,
  TrendingUp,
  Users2,
  Zap,
  Contact,
  LandmarkIcon,
  HeartHandshake,
  Coins,
  FilePenLine,
  FolderKanban,
  CheckSquare,
  Target,
  FileText,
  HardDrive,
};

interface EntityItem {
  name: string;
  value: number;
  href: string;
  iconName: string;
  color: "cyan" | "violet" | "emerald" | "amber" | "rose" | "blue";
}

interface EntityBreakdownProps {
  title: string;
  entities: EntityItem[];
  className?: string;
}

const colorStyles = {
  cyan: {
    bg: "bg-cyan-500/10 hover:bg-cyan-500/20",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    icon: "text-cyan-400",
    text: "group-hover:text-cyan-300",
  },
  violet: {
    bg: "bg-violet-500/10 hover:bg-violet-500/20",
    border: "border-violet-500/20 hover:border-violet-500/40",
    icon: "text-violet-400",
    text: "group-hover:text-violet-300",
  },
  emerald: {
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    icon: "text-emerald-400",
    text: "group-hover:text-emerald-300",
  },
  amber: {
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-500/20 hover:border-amber-500/40",
    icon: "text-amber-400",
    text: "group-hover:text-amber-300",
  },
  rose: {
    bg: "bg-rose-500/10 hover:bg-rose-500/20",
    border: "border-rose-500/20 hover:border-rose-500/40",
    icon: "text-rose-400",
    text: "group-hover:text-rose-300",
  },
  blue: {
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    border: "border-blue-500/20 hover:border-blue-500/40",
    icon: "text-blue-400",
    text: "group-hover:text-blue-300",
  },
};

export function EntityBreakdown({
  title,
  entities,
  className,
}: EntityBreakdownProps) {
  const total = entities.reduce((sum, e) => sum + e.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6",
        className
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-muted-foreground uppercase">
            Total Records
          </span>
        </div>
      </div>

      {/* Visual breakdown bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-white/5 mb-6">
        <div className="absolute inset-0 flex">
          {entities.map((entity, index) => {
            const width = total > 0 ? (entity.value / total) * 100 : 0;
            const colors = colorStyles[entity.color];
            return (
              <motion.div
                key={entity.name}
                className={cn(
                  "h-full",
                  colors.bg.split(" ")[0].replace("/10", "/60")
                )}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />
            );
          })}
        </div>
      </div>

      {/* Entity grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {entities.map((entity, index) => {
          const colors = colorStyles[entity.color];
          const Icon = iconMap[entity.iconName] || DollarSign;
          const percentage =
            total > 0 ? ((entity.value / total) * 100).toFixed(1) : "0";

          return (
            <motion.div
              key={entity.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link href={entity.href} className="block group">
                <div
                  className={cn(
                    "rounded-xl border p-4 transition-all duration-300",
                    colors.bg,
                    colors.border
                  )}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg bg-white/5",
                        colors.icon
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium text-muted-foreground transition-colors",
                        colors.text
                      )}
                    >
                      {entity.name}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-white">
                      {entity.value}
                    </span>
                    <span className={cn("text-xs", colors.icon)}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
