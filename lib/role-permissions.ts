/**
 * CRM Role Permissions and Module Access Configuration
 * 
 * Defines role types and their default module access for the CRM.
 * Super Admin roles have full access and don't need module configuration.
 * 
 * Role Hierarchy:
 * - SUPER_ADMIN: Full control over organization and all departments
 * - ADMIN: Manages their department, can create MEMBER/VIEWER roles only
 * - MEMBER: Works on assigned resources
 * - VIEWER: Read-only access
 */

// Team roles in hierarchical order (OWNER deprecated, use SUPER_ADMIN)
export type TeamRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER' | 'VIEWER';

// Legacy support - OWNER maps to SUPER_ADMIN
export type LegacyTeamRole = 'OWNER' | TeamRole;

// Role hierarchy levels (higher number = more permissions)
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
    SUPER_ADMIN: 100,
    ADMIN: 75,
    MEMBER: 50,
    VIEWER: 25,
};

// Which roles can each role create/manage
// This enforces: Admins cannot create other Admins
export const ROLE_CREATION_MATRIX: Record<TeamRole, TeamRole[]> = {
    SUPER_ADMIN: ['ADMIN', 'MEMBER', 'VIEWER'],
    ADMIN: ['MEMBER', 'VIEWER'],  // Cannot create other Admins!
    MEMBER: [],
    VIEWER: [],
};

// CRM Module definition
export interface CrmModule {
    id: string;
    name: string;
    route: string;
    description: string;
    icon?: string;
}

// All available CRM modules
export const CRM_MODULES: CrmModule[] = [
    { id: 'dashboard', name: 'Dashboard', route: '/crm/dashboard', description: 'CRM overview and metrics' },
    { id: 'accounts', name: 'Accounts', route: '/crm/accounts', description: 'Manage company accounts' },
    { id: 'contacts', name: 'Contacts', route: '/crm/contacts', description: 'Manage contacts' },
    { id: 'leads', name: 'Leads', route: '/crm/leads', description: 'Lead management and tracking' },
    { id: 'opportunities', name: 'Opportunities', route: '/crm/opportunities', description: 'Sales opportunities pipeline' },
    { id: 'contracts', name: 'Contracts', route: '/crm/contracts', description: 'Contract management' },
    { id: 'tasks', name: 'Tasks', route: '/crm/tasks', description: 'Task management' },
    { id: 'projects', name: 'Projects', route: '/crm/my-projects', description: 'Project boards' },
    { id: 'sales-command', name: 'Sales Command', route: '/crm/sales-command', description: 'Sales automation tools' },
    { id: 'dialer', name: 'Dialer', route: '/crm/dialer', description: 'Phone dialer integration' },
    { id: 'university', name: 'University', route: '/crm/university', description: 'Training and resources' },
];

// Role metadata
export interface RoleConfig {
    label: string;
    description: string;
    canEdit: boolean;
    canDelete: boolean;
    canManageSettings: boolean;
    canManageDepartment: boolean;
    defaultModules: string[]; // Module IDs enabled by default
}

// Role configurations (Super Admin has god mode - not included here)
export const ROLE_CONFIGS: Record<Exclude<TeamRole, 'SUPER_ADMIN'>, RoleConfig> = {
    ADMIN: {
        label: 'Admin',
        description: 'Full access within their department',
        canEdit: true,
        canDelete: true,
        canManageSettings: false, // Org settings restricted to Super Admin
        canManageDepartment: true,
        defaultModules: CRM_MODULES.map(m => m.id), // All modules
    },
    MEMBER: {
        label: 'Member',
        description: 'Can manage assigned content but not settings',
        canEdit: true,
        canDelete: false,
        canManageSettings: false,
        canManageDepartment: false,
        defaultModules: ['dashboard', 'leads', 'accounts', 'contacts', 'tasks'], // Subset
    },
    VIEWER: {
        label: 'Viewer',
        description: 'Read-only access',
        canEdit: false,
        canDelete: false,
        canManageSettings: false,
        canManageDepartment: false,
        defaultModules: [], // No modules enabled by default
    },
};

// Super Admin configuration (separate for clarity)
export const SUPER_ADMIN_CONFIG: RoleConfig = {
    label: 'Super Admin',
    description: 'Full control over organization and all departments',
    canEdit: true,
    canDelete: true,
    canManageSettings: true,
    canManageDepartment: true,
    defaultModules: CRM_MODULES.map(m => m.id),
};

// Helper to check if a role has access to a module
export function hasModuleAccess(role: TeamRole | LegacyTeamRole, moduleId: string, customModules?: string[]): boolean {
    // Normalize legacy OWNER to SUPER_ADMIN
    const normalizedRole = role === 'OWNER' ? 'SUPER_ADMIN' : role;

    // Super Admin always has access
    if (normalizedRole === 'SUPER_ADMIN') return true;

    // Use custom modules if provided, otherwise use defaults
    const enabledModules = customModules ?? ROLE_CONFIGS[normalizedRole].defaultModules;
    return enabledModules.includes(moduleId);
}

// Helper to get display name for role
export function getRoleLabel(role: TeamRole | LegacyTeamRole): string {
    // Normalize legacy OWNER to SUPER_ADMIN
    const normalizedRole = role === 'OWNER' ? 'SUPER_ADMIN' : role;

    if (normalizedRole === 'SUPER_ADMIN') return 'Super Admin';
    return ROLE_CONFIGS[normalizedRole].label;
}

// Helper to check if user has minimum role level
export function hasMinimumRoleLevel(userRole: TeamRole | LegacyTeamRole, requiredRole: TeamRole): boolean {
    const normalizedRole = userRole === 'OWNER' ? 'SUPER_ADMIN' : userRole;
    return ROLE_HIERARCHY[normalizedRole] >= ROLE_HIERARCHY[requiredRole];
}

// Helper to get roles that a user can create/manage
export function getManageableRoles(actorRole: TeamRole | LegacyTeamRole): TeamRole[] {
    const normalizedRole = actorRole === 'OWNER' ? 'SUPER_ADMIN' : actorRole;
    return ROLE_CREATION_MATRIX[normalizedRole] || [];
}

// Helper to check if actor can manage target role
export function canManageRole(actorRole: TeamRole | LegacyTeamRole, targetRole: TeamRole): boolean {
    return getManageableRoles(actorRole).includes(targetRole);
}

// Get role config with Super Admin support
export function getRoleConfig(role: TeamRole | LegacyTeamRole): RoleConfig {
    const normalizedRole = role === 'OWNER' ? 'SUPER_ADMIN' : role;
    if (normalizedRole === 'SUPER_ADMIN') return SUPER_ADMIN_CONFIG;
    return ROLE_CONFIGS[normalizedRole];
}

// All available roles for UI dropdowns
export const ALL_ROLES: { value: TeamRole; label: string; description: string }[] = [
    { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full control over organization' },
    { value: 'ADMIN', label: 'Admin', description: 'Manages their department' },
    { value: 'MEMBER', label: 'Member', description: 'Works on assigned resources' },
    { value: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
];
