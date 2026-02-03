/**
 * Department-scoped Permission System
 * 
 * Handles hierarchical access control for organizations with departments.
 * Implements the permission matrix:
 * - SUPER_ADMIN: Full access to entire organization
 * - ADMIN: Full access to their department, read-only to other departments
 * - MEMBER: Edit assigned resources only, read-only to rest of org
 * - VIEWER: Read-only access to entire organization
 */

import { TeamRole, ROLE_HIERARCHY, ROLE_CREATION_MATRIX } from './role-permissions';

// ============================================================================
// TYPES
// ============================================================================

export interface UserContext {
    id: string;
    team_id: string | null;
    department_id: string | null;
    team_role: TeamRole;
    is_admin?: boolean;
}

export interface ResourceContext {
    team_id: string;
    assigned_department_id: string | null;
    assigned_to?: string | null;
}

export interface DepartmentInfo {
    id: string;
    name: string;
    parent_id: string | null;
    team_type: 'ORGANIZATION' | 'DEPARTMENT';
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if user can VIEW a resource
 * All users in the same organization can view all resources (cross-department visibility)
 */
export function canViewResource(user: UserContext, resource: ResourceContext): boolean {
    if (!user.team_id) return false;
    // All users in the org can view all resources
    return user.team_id === resource.team_id;
}

/**
 * Check if user can EDIT a resource
 * - SUPER_ADMIN: can edit anything in org
 * - ADMIN: can edit only resources in their department (or unassigned)
 * - MEMBER: can edit only resources assigned to them
 * - VIEWER: cannot edit anything
 */
export function canEditResource(user: UserContext, resource: ResourceContext): boolean {
    if (!user.team_id || user.team_id !== resource.team_id) return false;

    switch (user.team_role) {
        case 'SUPER_ADMIN':
            return true;

        case 'ADMIN':
            // Admin can edit if:
            // 1. Resource is in their department
            // 2. Resource is unassigned to any department
            return (
                resource.assigned_department_id === user.department_id ||
                resource.assigned_department_id === null
            );

        case 'MEMBER':
            // Member can only edit if assigned to them
            return resource.assigned_to === user.id;

        case 'VIEWER':
            return false;

        default:
            return false;
    }
}

/**
 * Check if user can DELETE a resource
 * Same logic as edit, but more restrictive for members
 */
export function canDeleteResource(user: UserContext, resource: ResourceContext): boolean {
    if (!user.team_id || user.team_id !== resource.team_id) return false;

    switch (user.team_role) {
        case 'SUPER_ADMIN':
            return true;

        case 'ADMIN':
            // Admin can delete resources in their department
            return resource.assigned_department_id === user.department_id;

        case 'MEMBER':
        case 'VIEWER':
            return false;

        default:
            return false;
    }
}

/**
 * Check if user can CREATE a resource in a specific department
 */
export function canCreateInDepartment(user: UserContext, targetDepartmentId: string | null): boolean {
    if (!user.team_id) return false;

    switch (user.team_role) {
        case 'SUPER_ADMIN':
            return true;

        case 'ADMIN':
            // Admin can create in their department or unassigned
            return targetDepartmentId === user.department_id || targetDepartmentId === null;

        case 'MEMBER':
            // Members can create unassigned resources (they become their own)
            return targetDepartmentId === null;

        case 'VIEWER':
            return false;

        default:
            return false;
    }
}

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

/**
 * Check if user can manage (create/update/delete) a role
 * SUPER_ADMIN can create ADMIN, MEMBER, VIEWER
 * ADMIN can only create MEMBER, VIEWER (not other Admins)
 */
export function canManageRole(
    actor: UserContext,
    targetRole: TeamRole
): boolean {
    if (actor.is_admin) return true; // Platform Admin supersedes
    const allowedRoles = ROLE_CREATION_MATRIX[actor.team_role] || [];
    return allowedRoles.includes(targetRole);
}

/**
 * Check if user can change another user's role
 */
export function canChangeUserRole(
    actor: UserContext,
    targetUserId: string,
    currentRole: TeamRole,
    newRole: TeamRole
): boolean {
    // Platform Admin can assign to anyone (even themselves if needed, but typically not)
    // But let's keep the self-check or allow it? God mode usually implies everything.
    // If actor is Platform Admin, they can do anything.
    if (actor.is_admin) return true;

    // Can't change your own role
    if (actor.id === targetUserId) return false;

    // Must be able to manage both the current and new role
    return canManageRole(actor, currentRole) && canManageRole(actor, newRole);
}

/**
 * Get the list of roles that a user can assign to others
 */
export function getAssignableRoles(actor: UserContext): TeamRole[] {
    if (actor.is_admin) {
        return ['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'VIEWER'];
    }
    return ROLE_CREATION_MATRIX[actor.team_role] || [];
}

// ============================================================================
// DEPARTMENT MANAGEMENT
// ============================================================================

/**
 * Check if user can manage department settings
 */
export function canManageDepartment(user: UserContext, departmentId: string): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    if (user.team_role === 'SUPER_ADMIN') return true;
    if (user.team_role === 'ADMIN' && user.department_id === departmentId) return true;
    return false;
}

/**
 * Check if user can create new departments
 * Only SUPER_ADMIN or Platform Admin can create departments
 */
export function canCreateDepartment(user: UserContext): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    return user.team_role === 'SUPER_ADMIN';
}

/**
 * Check if user can delete a department
 * Only SUPER_ADMIN or Platform Admin can delete departments
 */
export function canDeleteDepartment(user: UserContext): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    return user.team_role === 'SUPER_ADMIN';
}

/**
 * Check if user can assign members to a department
 */
export function canAssignToDepartment(user: UserContext, departmentId: string): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    if (user.team_role === 'SUPER_ADMIN') return true;
    if (user.team_role === 'ADMIN' && user.department_id === departmentId) return true;
    return false;
}

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

/**
 * Check if user can manage organization settings
 * Only SUPER_ADMIN can manage org-level settings
 */
export function canManageOrganization(user: UserContext): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    return user.team_role === 'SUPER_ADMIN';
}

/**
 * Check if user can update organization signature theme
 * Both SUPER_ADMIN and ADMIN can update (org-wide setting)
 */
export function canUpdateSignatureTheme(user: UserContext): boolean {
    if (user.is_admin) return true; // Platform Admin supersedes
    return user.team_role === 'SUPER_ADMIN' || user.team_role === 'ADMIN';
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get the effective organization team_id for queries
 * All CRM data should be stored at the org level, not department level
 */
export function getOrganizationId(user: UserContext): string | null {
    return user.team_id;
}

/**
 * Build a Prisma where clause for department-scoped access
 * This allows admins to filter resources by their department
 */
export function getDepartmentFilter(user: UserContext): { assigned_department_id?: string | null } | {} {
    if (user.is_admin) {
        // Platform admin sees everything
        return {};
    }

    if (user.team_role === 'SUPER_ADMIN') {
        // Super admin sees everything, no filter needed
        return {};
    }

    if (user.team_role === 'ADMIN' && user.department_id) {
        // Admin only manages their department
        return { assigned_department_id: user.department_id };
    }

    // Members and viewers don't filter by department for viewing
    return {};
}

/**
 * Check if a user has at least the given role level
 */
export function hasMinimumRole(user: UserContext, minimumRole: TeamRole): boolean {
    const userLevel = ROLE_HIERARCHY[user.team_role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
    return userLevel >= requiredLevel;
}

/**
 * Convert legacy 'OWNER' role to 'SUPER_ADMIN' for backwards compatibility
 */
export function normalizeRole(role: string | null): TeamRole {
    if (role === 'OWNER') return 'SUPER_ADMIN';
    if (role && ['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
        return role as TeamRole;
    }
    return 'MEMBER'; // Default
}

/**
 * Build user context from a database user object
 */
export function buildUserContext(user: {
    id: string;
    team_id: string | null;
    department_id?: string | null;
    team_role: string | null;
    is_admin?: boolean | null;
}): UserContext {
    return {
        id: user.id,
        team_id: user.team_id,
        department_id: user.department_id || null,
        team_role: normalizeRole(user.team_role),
        is_admin: !!user.is_admin,
    };
}
