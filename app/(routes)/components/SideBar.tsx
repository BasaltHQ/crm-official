import { getNavigationConfig } from "@/actions/navigation/get-navigation-config";
import { DEFAULT_NAV_STRUCTURE, NavItem } from "@/lib/navigation-defaults";
import DynamicModuleMenu from "./dynamic-navigation/DynamicModuleMenu";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getModules } from "@/actions/get-modules";
import { prismadb } from "@/lib/prisma";
import { getCaseStats } from "@/actions/crm/cases/get-case-stats";
import { getDictionary } from "@/lib/dictionaries";
import { getCurrentUserTeamId } from "@/lib/team-utils";

const SideBar = async () => {
  const currentUserInfo = await getCurrentUserTeamId();
  if (!currentUserInfo) return null;

  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [modules, user, targetTeam, caseStats, dbNavConfig] = await Promise.all([
    getModules(),
    (prismadb.users as any).findUnique({
      where: { id: currentUserInfo.userId },
      include: { assigned_team: true }
    }),
    (prismadb.team as any).findUnique({
      where: { id: currentUserInfo.teamId },
      include: { assigned_plan: true }
    }),
    getCaseStats(),
    getNavigationConfig()
  ]);

  if (!modules) return null;

  //Get user language
  const lang = session.user.userLanguage;

  //Fetch translations from dictionary
  const dict = await getDictionary(lang as "en" | "cz" | "de");

  if (!dict) return null;

  const team = targetTeam;
  const planSlug = team?.assigned_plan?.slug || team?.subscription_plan || "FREE";
  let features: string[] = [];

  // Always start with the canonical config features for this plan slug
  const { getSubscriptionPlan } = await import("@/lib/subscription");
  const configFeatures = getSubscriptionPlan(planSlug).features;

  if (team?.assigned_plan) {
    // Merge DB features + config features to catch newly added baseline features
    features = Array.from(new Set([...team.assigned_plan.features, ...configFeatures]));
  } else {
    features = configFeatures;
  }

  // Add overrides to features list
  if (team?.module_overrides) {
    features = Array.from(new Set([...features, ...team.module_overrides]));
  }

  const teamRole = currentUserInfo.teamRole || "MEMBER";
  const isPartnerAdmin = currentUserInfo.isPlatformAdmin || targetTeam?.slug === "basalt" || targetTeam?.slug === "basalthq";

  // Resolve Navigation Structure (Now synced via DB Migration)
  const config = dbNavConfig as any;
  const rawStructure = config?.structure || DEFAULT_NAV_STRUCTURE;

  // ─── Merge Missing Defaults ───
  // When a team has a DB-persisted nav config, newly added nav items
  // (e.g. nav_leads, nav_lists) would be missing. This merges them in.
  const mergeWithDefaults = (dbItems: NavItem[], defaults: NavItem[]): NavItem[] => {
    // Collect all IDs present in the DB structure (recursively)
    const collectIds = (items: NavItem[]): Set<string> => {
      const ids = new Set<string>();
      items.forEach(item => {
        ids.add(item.id);
        if (item.children) {
          item.children.forEach(child => ids.add(child.id));
        }
      });
      return ids;
    };

    const existingIds = collectIds(dbItems);
    const merged = dbItems.map(item => ({ ...item }));

    // For each default group, check if its children exist in the DB structure
    defaults.forEach(defaultItem => {
      if (defaultItem.type === "group" && defaultItem.children) {
        // Find the matching group in the DB structure
        const dbGroup = merged.find(m => m.id === defaultItem.id);

        if (dbGroup && dbGroup.children) {
          // Inject any missing children into this group
          defaultItem.children.forEach(defaultChild => {
            if (!existingIds.has(defaultChild.id)) {
              dbGroup.children = dbGroup.children || [];
              dbGroup.children.push({ ...defaultChild });
              existingIds.add(defaultChild.id);
            }
          });
        } else if (!dbGroup) {
          // Entire group is missing from DB — add it
          merged.push({ ...defaultItem });
        }
      } else if (!existingIds.has(defaultItem.id)) {
        // Top-level non-group item missing — add it
        merged.push({ ...defaultItem });
      }
    });

    return merged;
  };

  const mergedStructure = config?.structure
    ? mergeWithDefaults(rawStructure, DEFAULT_NAV_STRUCTURE)
    : rawStructure;

  // Utility to ensure unique IDs across the entire structure
  const deduplicateStructure = (items: NavItem[]): NavItem[] => {
    const seen = new Set<string>();
    const process = (list: NavItem[]): NavItem[] => {
      const result: NavItem[] = [];
      list.forEach(item => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          const processedItem = { ...item };
          if (item.children) {
            processedItem.children = process(item.children);
          }
          result.push(processedItem);
        }
      });
      return result;
    };
    return process(items);
  };

  // Migrate any DB-stored /partners hrefs to /platform
  const migratePartnersToPlatform = (items: NavItem[]): NavItem[] => {
    return items.map(item => {
      const migrated = { ...item };
      if (migrated.href?.startsWith('/partners')) {
        migrated.href = migrated.href.replace('/partners', '/platform');
      }
      if (migrated.label === 'Team Management') {
        migrated.label = 'Company Management';
      }
      if (migrated.label === 'Deals') {
        migrated.label = 'Opportunities';
      }
      if (migrated.children) {
        migrated.children = migratePartnersToPlatform(migrated.children);
      }
      return migrated;
    });
  };

  const activeNavStructure = deduplicateStructure(migratePartnersToPlatform(mergedStructure));

  const ensurePlatformMenu = (items: NavItem[]) => {
    if (!isPartnerAdmin) return;
    const systemGroup = items.find(i => i.id === "group_system");
    if (systemGroup && systemGroup.children) {
      const hasPlatform = systemGroup.children.some((i: any) => i.id === "nav_platform");
      if (!hasPlatform) {
        systemGroup.children.push({
          id: "nav_platform",
          type: "item",
          label: "Platform",
          iconName: "Globe",
          href: "/platform",
          permissions: { minRole: "PLATFORM_ADMIN" },
          children: [
            { id: "sub_platform_team", type: "item", label: "Company Management", href: "/platform" },
            { id: "sub_platform_keys", type: "item", label: "System Keys", href: "/platform/ai-system-config" },
            { id: "sub_platform_pricing", type: "item", label: "Model Pricing", href: "/platform/ai-pricing" },
            { id: "sub_platform_email", type: "item", label: "System Email", href: "/platform/email-system-config" },
            { id: "sub_platform_plans", type: "item", label: "Manage Plans", href: "/platform/plans" }
          ]
        });
      }
    }
  };
  ensurePlatformMenu(activeNavStructure);

  const sanitizeFontFamily = (font: unknown): string => {
    if (!font) return "";
    return String(font).replace(/[^a-zA-Z0-9 ,_-]/g, "").trim();
  };

  const sanitizeCssToken = (val: unknown, fallback: string): string => {
    if (!val) return fallback;
    const cleaned = String(val).replace(/[^a-zA-Z0-9.%_-]/g, "").trim();
    return cleaned || fallback;
  };

  const ensurePx = (val: string | undefined | null, def: string) => {
    const sVal = sanitizeCssToken(val, "");
    if (!sVal) return def;
    if (sVal.endsWith('px') || sVal.endsWith('rem') || sVal.endsWith('em')) return sVal;
    return `${sVal}px`;
  };

  const safeTitleFont = sanitizeFontFamily(config?.titleFont);
  const safeItemFont = sanitizeFontFamily(config?.itemFont);

  const styleTag = `
    :root {
      --nav-title-font: ${safeTitleFont ? `'${safeTitleFont}', sans-serif` : 'inherit'};
      --nav-title-size: ${ensurePx(config?.titleFontSize, '10px')};
      --nav-title-weight: ${sanitizeCssToken(config?.titleFontWeight, '900')};
      --nav-title-style: ${sanitizeCssToken(config?.titleFontStyle, 'normal')};
      --nav-item-font: ${safeItemFont ? `'${safeItemFont}', sans-serif` : 'inherit'};
      --nav-item-size: ${ensurePx(config?.itemFontSize, '12px')};
      --nav-item-weight: ${sanitizeCssToken(config?.itemFontWeight, '900')};
      --nav-item-style: ${sanitizeCssToken(config?.itemFontStyle, 'normal')};
    }
  `;

  let impersonationContext = "GOD_MODE";
  if (currentUserInfo.isImpersonating) {
    if (user?.assigned_team?.parent_id === currentUserInfo.teamId) {
       impersonationContext = "COMPANY_MODE";
    } else if (targetTeam && targetTeam.parent_id === user?.team_id) {
       impersonationContext = "DEPARTMENT_MODE";
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleTag }} />
      <DynamicModuleMenu
        navStructure={activeNavStructure}
        titleFont={safeTitleFont || undefined}
        titleFontSize={config?.titleFontSize}
        titleFontWeight={config?.titleFontWeight}
        titleFontStyle={config?.titleFontStyle}
        itemFont={safeItemFont || undefined}
        itemFontSize={config?.itemFontSize}
        itemFontWeight={config?.itemFontWeight}
        itemFontStyle={config?.itemFontStyle}
        modules={modules}
        dict={dict}
        features={features}
        isPartnerAdmin={isPartnerAdmin}
        teamRole={teamRole}
        serviceBadge={caseStats?.openCases || 0}
        isImpersonating={currentUserInfo.isImpersonating}
        impersonatedTeamName={team?.name}
        planSlug={planSlug}
        impersonationContext={impersonationContext}
      />
    </>
  );
};
export default SideBar;
