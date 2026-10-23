"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    LayoutDashboard,
    Building2,
    Contact,
    Users,
    Phone,
    Target,
    FileText,
    ChevronLeft,
    ChevronRight,
    Folder,
    CheckSquare,
    GraduationCap,
    Radio,
    Headset,
    Shield,
    CheckCircle2,
    Zap,
    Calendar,
    Lock,
    Rocket,
    LayoutGrid,
    Eye,
    EyeOff
} from "lucide-react";

interface CrmSidebarProps {
    isMember?: boolean;
    allowedModules?: string[];
}

export default function CrmSidebar({ isMember = false, allowedModules = [] }: CrmSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showAllModules, setShowAllModules] = useState(false);

    // Permission Helper
    const hasAccess = (moduleId: string) => {
        if (moduleId === 'decision-intelligence') return true;
        if (!allowedModules || allowedModules.length === 0) return false;
        if (allowedModules.includes('*')) return true;

        return allowedModules.includes(moduleId) || allowedModules.includes(`${moduleId}.view`);
    };

    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem("crm-sidebar-collapsed");
        if (stored) {
            setIsCollapsed(stored === "true");
        }
        const storedShowAll = localStorage.getItem("crm-sidebar-show-all");
        if (storedShowAll) {
            setShowAllModules(storedShowAll === "true");
        }
    }, [pathname]);

    // Dispatch event when mobile expansion changes
    useEffect(() => {
        const event = new CustomEvent('crm-layer2-change', { detail: { expanded: isMobileExpanded } });
        window.dispatchEvent(event);
    }, [isMobileExpanded]);

    const toggleSidebar = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("crm-sidebar-collapsed", String(newState));
    };

    const toggleShowAll = () => {
        const newState = !showAllModules;
        setShowAllModules(newState);
        localStorage.setItem("crm-sidebar-show-all", String(newState));
    };

    // Full Nav List relative to permissions
    const allNavItems = [
        { id: 'decision-intelligence', label: "Decision Intelligence", href: "/crm/decision-intelligence", icon: Zap },
        { id: 'accounts', label: "Accounts", href: "/crm/accounts", icon: Building2 },
        { id: 'contacts', label: "Contacts", href: "/crm/contacts", icon: Contact },
        { id: 'leads', label: "Leads", href: "/crm/leads", icon: Users },
        { id: 'opportunities', label: "Opportunities", href: "/crm/opportunities", icon: Target },
        { id: 'projects', label: "Projects", href: "/projects", icon: Folder },
        { id: 'campaigns', label: "Campaigns", href: "/campaigns", icon: Rocket },

        { id: 'contracts', label: "Contracts", href: "/crm/contracts", icon: FileText },
        { id: 'quotes', label: "Quotes", href: "/crm/quotes", icon: FileText },
        { id: 'sales-command', label: "Sales Command", href: "/crm/sales-command", icon: Radio },
        { id: 'cases', label: "Service Console", href: "/crm/cases", icon: Headset },
        { id: 'guard-rules', label: "Guard Rules", href: "/crm/validation-rules", icon: Shield },
        { id: 'approvals', label: "Approval Chains", href: "/crm/approvals", icon: CheckCircle2 },
        { id: 'workflows', label: "FlowState Builder", href: "/crm/workflows", icon: Zap },
        { id: 'university', label: "University", href: "/crm/university", icon: GraduationCap },
        { id: 'widgets', label: "Widgets (90+)", href: "/crm/dashboard", icon: LayoutGrid },
    ] as { id: string; label: string; href: string; icon: any; isPremium?: boolean }[];

    // Process items based on toggle
    const accessibleItems = allNavItems.filter(item => hasAccess(item.id));
    const navItems = showAllModules ? allNavItems : accessibleItems;

    const isUniversityPage = pathname.includes("/crm/university");
    const isContractsPage = pathname.includes("/crm/contracts");

    // Hide sidebar on specific pages or when no nav items (unless showing all)
    if (isUniversityPage || isContractsPage || (accessibleItems.length === 0 && !showAllModules)) {
        return null;
    }

    return (
        <>
            {/* Wrapper for sidebar + toggle button */}
            <div
                className={cn(
                    "hidden md:flex shrink-0 relative group z-20",
                    isCollapsed ? "w-16" : "w-48"
                )}
            >
                {/* Sidebar content */}
                <div
                    className={cn(
                        "flex flex-col bg-muted/10 border-r border-border/50 py-4 gap-1 transition-colors duration-300 overflow-y-auto h-full w-full",
                        isCollapsed ? "items-center" : "px-2"
                    )}
                >
                    {navItems.map((item) => {
                        const isAccessible = hasAccess(item.id);
                        const isLocked = !isAccessible && showAllModules;
                        const isActive =
                            item.href === "/crm"
                                ? pathname === "/crm"
                                : pathname.startsWith(item.href);

                        return (
                            <button
                                key={item.label}
                                onClick={(e) => {
                                    if (isLocked) {
                                        e.preventDefault();
                                        toast.error(`Upgrade your plan to access ${item.label}`);
                                        return;
                                    }
                                    router.push(item.href);
                                }}
                                className={cn(
                                    "relative w-full flex items-center rounded-xl transition-colors duration-200 group text-sm font-medium",
                                    isCollapsed ? "justify-center w-8 h-8 mx-auto" : "py-1.5 px-2",
                                    isLocked ? "opacity-40 grayscale cursor-not-allowed hidden md:flex" : "",
                                    isActive
                                        ? "text-primary"
                                        : cn("text-muted-foreground", !isCollapsed && !isLocked && "hover:text-foreground hover:bg-muted/30")
                                )}
                                title={isCollapsed ? (isLocked ? `${item.label} (Locked)` : item.label) : undefined}
                            >
                                {/* Active glow */}
                                {isActive && !isLocked && (
                                    <div className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] content-[''] z-0" />
                                )}

                                {/* Icon */}
                                <div className={cn(
                                    "relative z-10 flex items-center justify-center min-w-[24px]",
                                    isCollapsed && "w-8 h-8 rounded-md transition-colors duration-200",
                                    isCollapsed && !isLocked && "hover:bg-muted/50 hover:ring-1 hover:ring-border group/icon"
                                )}>
                                    <item.icon className={cn(
                                        "w-[18px] h-[18px] transition-colors duration-200",
                                        isActive ? "text-primary" : (isCollapsed && !isLocked ? "group-hover/icon:text-primary text-muted-foreground" : (!isLocked ? "group-hover:text-primary" : "text-muted-foreground"))
                                    )} />
                                </div>

                                {/* Text (Expanded) */}
                                {!isCollapsed && (
                                    <div className="flex items-center gap-2 flex-1 z-10 ml-2.5">
                                        <span className={cn(
                                            "whitespace-nowrap uppercase tracking-normal leading-normal flex-1 text-left px-1",
                                            isActive && !isLocked ? "bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent" : "text-muted-foreground transition-colors duration-300",
                                            !isLocked && !isActive ? "group-hover:text-primary" : ""
                                        )}
                                        style={{
                                            fontFamily: 'var(--nav-item-font)',
                                            fontSize: 'var(--nav-item-size)',
                                            fontWeight: 'var(--nav-item-weight)',
                                            fontStyle: 'var(--nav-item-style)', overflow: 'visible',
                                            paddingRight: '1.2em'
                                        }}>
                                            {item.label}
                                        </span>
                                        {(item.isPremium || isLocked) && <Lock className={cn("w-3 h-3 shrink-0", isLocked ? "text-muted-foreground" : "text-amber-500/70")} />}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Show All Modules Toggle */}
                {isMounted && (
                    <button
                        onClick={toggleShowAll}
                        className={cn(
                            "absolute bottom-4 z-[100] bg-background/60 backdrop-blur-xl border border-border rounded-full p-1.5 shadow-lg transition-all duration-300",
                            isCollapsed ? "left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100" : "left-4 text-muted-foreground hover:text-foreground"
                        )}
                        title={showAllModules ? "Hide locked modules" : "Show all modules"}
                    >
                        {showAllModules ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}

                {/* Toggle Button - Outside overflow container */}
                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-6 bg-background/60 backdrop-blur-xl border border-border rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-[100]"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>

            {/* Mobile Stacked Bottom Nav (Layer 2 — Floating Pill) */}
            <div
                className="md:hidden fixed bottom-[52px] left-0 right-0 z-[90]"
            >
                <div
                    className="bg-background/80 backdrop-blur-xl border-t border-white/10 rounded-t-2xl flex flex-row items-center gap-1 p-1 overflow-x-auto no-scrollbar shadow-2xl"
                    onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                >
                {navItems.map((item) => {
                    const isAccessible = hasAccess(item.id);
                    const isLocked = !isAccessible && showAllModules;
                    const isActive =
                        item.href === "/crm"
                            ? pathname === "/crm"
                            : pathname.startsWith(item.href);

                    return (
                        <button
                            key={item.label}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isLocked) {
                                    toast.error(`Upgrade your plan to access ${item.label}`);
                                    return;
                                }
                                if (!isMobileExpanded) {
                                    setIsMobileExpanded(true);
                                    return;
                                }
                                router.push(item.href);
                            }}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[48px] py-1.5 px-2 rounded-xl transition-colors duration-200 gap-0.5 shrink-0 relative",
                                isLocked ? "opacity-40 grayscale cursor-not-allowed hidden md:flex" : "",
                                isActive && !isLocked ? "bg-primary/20 text-primary" : (!isLocked ? "text-muted-foreground hover:text-primary" : "")
                            )}
                        >
                            <item.icon className="w-4 h-4" />

                            <span className={cn(
                                "uppercase tracking-wider truncate max-w-[56px] transition-all duration-200",
                                isMobileExpanded ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden"
                            )}
                            style={{
                                fontFamily: 'var(--nav-item-font)',
                                fontSize: 'calc(var(--nav-item-size) * 0.5)',
                                fontWeight: 'var(--nav-item-weight)',
                                fontStyle: 'var(--nav-item-style)',
                                lineHeight: '1.2'
                            }}>
                                {item.label.split(' ')[0]}
                            </span>

                            {isActive && !isLocked && (
                                <div className="absolute top-0 w-6 h-0.5 bg-primary rounded-b-full" />
                            )}
                        </button>
                    );
                })}
                </div>
            </div>
        </>
    );
}
