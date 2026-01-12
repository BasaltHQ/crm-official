"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type MenuItemProps = {
    href: string;
    icon: LucideIcon | React.ElementType;
    title: string;
    isOpen: boolean;
    isActive: boolean;
    onClick?: () => void;
    isMobile?: boolean;
};

const MenuItem = ({ href, icon: Icon, title, isOpen, isActive, onClick, isMobile = false }: MenuItemProps) => {
    // Mobile layout - compact for bottom navbar
    if (isMobile) {
        return (
            <Link href={href} onClick={onClick} className="flex-shrink-0">
                <div
                    className={cn(
                        "relative flex items-center justify-center p-5 rounded-xl transition-all duration-200",
                        isActive
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground"
                    )}
                >
                    <Icon className={cn("w-7 h-7", isActive && "text-primary")} />
                </div>
            </Link>
        );
    }

    // Desktop sidebar layout
    return (
        <div className="w-full">
            <Link href={href} onClick={onClick}>
                <div
                    className={cn(
                        "relative w-full flex items-center rounded-xl transition-all duration-200 group text-sm font-medium",
                        isOpen ? "py-2 px-3" : "py-1 px-2 justify-center",
                        isActive
                            ? "text-primary"
                            : cn("text-muted-foreground", isOpen && "hover:text-foreground hover:bg-white/5")
                    )}
                >
                    {/* Active State Background - No layoutId, just conditional render */}
                    {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]" />
                    )}

                    {/* Icon */}
                    <div className={cn(
                        "relative z-10 flex items-center justify-center min-w-[24px]",
                        !isOpen && "w-8 h-8 rounded-md transition-all duration-200 hover:bg-white/10 hover:ring-1 hover:ring-white/70 group/icon"
                    )}>
                        <Icon
                            className={cn(
                                "w-5 h-5 transition-colors duration-200",
                                isActive
                                    ? "text-primary"
                                    : (isOpen ? "group-hover:text-primary" : "group-hover/icon:text-primary text-muted-foreground")
                            )}
                        />
                    </div>

                    {/* Title */}
                    <motion.span
                        initial={false}
                        animate={{
                            opacity: isOpen ? 1 : 0,
                            width: isOpen ? "auto" : 0,
                            display: isOpen ? "block" : "none",
                        }}
                        transition={{ duration: 0.2 }}
                        className="ml-3 truncate whitespace-nowrap overflow-hidden z-10"
                    >
                        {title}
                    </motion.span>
                </div>
            </Link>
        </div>
    );
};

export default MenuItem;
