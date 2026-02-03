/**
 * Department Management Actions
 * 
 * This module provides server actions for managing departments within an organization.
 * Departments are sub-teams that allow for scoped access control and team organization.
 */

export { createDepartment } from './create-department';
export type { CreateDepartmentInput, CreateDepartmentResult } from './create-department';

export { getDepartments, getDepartment, getMembersByDepartment } from './get-departments';
export type { Department, GetDepartmentsResult } from './get-departments';

export { updateDepartment } from './update-department';
export type { UpdateDepartmentInput, UpdateDepartmentResult } from './update-department';

export { deleteDepartment } from './delete-department';
export type { DeleteDepartmentResult } from './delete-department';

export {
    assignToDepartment,
    removeFromDepartment,
    bulkAssignToDepartment
} from './assign-to-department';
export type { AssignToDepartmentInput, AssignToDepartmentResult } from './assign-to-department';
