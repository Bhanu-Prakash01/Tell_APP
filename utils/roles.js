/**
 * Role-based access control utilities
 */

/**
 * Available roles in the system
 */
const ROLES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee'
};

/**
 * Role hierarchy (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  [ROLES.EMPLOYEE]: 1,
  [ROLES.ADMIN]: 2
};

/**
 * Check if a role exists in the system
 * @param {string} role - Role to check
 * @returns {boolean} True if role exists
 */
const isValidRole = (role) => {
  return Object.values(ROLES).includes(role);
};

/**
 * Check if user role has permission to access a resource
 * @param {string} userRole - User's current role
 * @param {string} requiredRole - Required role for access
 * @returns {boolean} True if user has permission
 */
const hasRolePermission = (userRole, requiredRole) => {
  if (!isValidRole(userRole) || !isValidRole(requiredRole)) {
    return false;
  }

  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Check if user is admin
 * @param {string} role - User role
 * @returns {boolean} True if user is admin
 */
const isAdmin = (role) => {
  return role === ROLES.ADMIN;
};

/**
 * Check if user is employee
 * @param {string} role - User role
 * @returns {boolean} True if user is employee
 */
const isEmployee = (role) => {
  return role === ROLES.EMPLOYEE;
};

/**
 * Get all roles in hierarchy order
 * @returns {string[]} Array of roles in hierarchy order
 */
const getRolesInHierarchy = () => {
  return Object.entries(ROLE_HIERARCHY)
    .sort(([,a], [,b]) => a - b)
    .map(([role]) => role);
};

/**
 * Get roles that a user can manage (same or lower hierarchy)
 * @param {string} userRole - User's role
 * @returns {string[]} Array of manageable roles
 */
const getManageableRoles = (userRole) => {
  if (!isValidRole(userRole)) {
    return [];
  }

  const userLevel = ROLE_HIERARCHY[userRole];
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level <= userLevel)
    .map(([role]) => role);
};

/**
 * Check if a role can be assigned by another role
 * @param {string} assignerRole - Role attempting to assign
 * @param {string} targetRole - Role to be assigned
 * @returns {boolean} True if assignment is allowed
 */
const canAssignRole = (assignerRole, targetRole) => {
  if (!isValidRole(assignerRole) || !isValidRole(targetRole)) {
    return false;
  }

  // Only admins can assign roles
  if (assignerRole !== ROLES.ADMIN) {
    return false;
  }

  // Admins can assign any role
  return true;
};

/**
 * Get role display name
 * @param {string} role - Role value
 * @returns {string} Display name for the role
 */
const getRoleDisplayName = (role) => {
  const displayNames = {
    [ROLES.ADMIN]: 'Administrator',
    [ROLES.EMPLOYEE]: 'Employee'
  };

  return displayNames[role] || role;
};

/**
 * Get role permissions summary
 * @param {string} role - User role
 * @returns {object} Object with role permissions
 */
const getRolePermissions = (role) => {
  const permissions = {
    [ROLES.ADMIN]: {
      canManageUsers: true,
      canViewAllData: true,
      canExportData: true,
      canImportData: true,
      canManageCampaigns: true,
      canViewReports: true,
      canManageSettings: true
    },
    [ROLES.EMPLOYEE]: {
      canManageUsers: false,
      canViewAllData: false,
      canExportData: false,
      canImportData: false,
      canManageCampaigns: false,
      canViewReports: false,
      canManageSettings: false
    }
  };

  return permissions[role] || {};
};

/**
 * Validate role transition (for role updates)
 * @param {string} currentRole - User's current role
 * @param {string} newRole - New role to assign
 * @param {string} assignerRole - Role of user making the change
 * @returns {object} Validation result with isValid boolean and error message
 */
const validateRoleTransition = (currentRole, newRole, assignerRole) => {
  if (!isValidRole(currentRole) || !isValidRole(newRole)) {
    return {
      isValid: false,
      error: 'Invalid role specified'
    };
  }

  if (!canAssignRole(assignerRole, newRole)) {
    return {
      isValid: false,
      error: 'Insufficient permissions to assign this role'
    };
  }

  // Prevent last admin from being demoted
  if (currentRole === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
    // This would need to be checked against database in real implementation
    // For now, we'll allow it but log a warning
    console.warn('Warning: Demoting last admin user');
  }

  return {
    isValid: true,
    error: null
  };
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  isValidRole,
  hasRolePermission,
  isAdmin,
  isEmployee,
  getRolesInHierarchy,
  getManageableRoles,
  canAssignRole,
  getRoleDisplayName,
  getRolePermissions,
  validateRoleTransition
};