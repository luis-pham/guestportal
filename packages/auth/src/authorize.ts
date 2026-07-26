import {
  isOrgWideRole,
  permissionScope,
  roleHasPermission,
  type Permission,
  type Role,
} from './roles.js';

export type AuthzContext = {
  userId: string;
  role: Role;
  organizationId: string;
  assignedPropertyIds: string[];
  isPlatformAdmin?: boolean;
};

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function can(ctx: AuthzContext, permission: Permission, propertyId?: string): boolean {
  if (ctx.isPlatformAdmin) {
    return true;
  }

  if (!roleHasPermission(ctx.role, permission)) {
    return false;
  }

  const scope = permissionScope(ctx.role, permission);
  if (scope === true || scope === 'configurable') {
    return true;
  }

  if (scope === 'assigned' || scope === 'self/assigned' || scope === 'assigned subset') {
    if (!propertyId) {
      return isOrgWideRole(ctx.role);
    }
    return ctx.assignedPropertyIds.includes(propertyId);
  }

  return false;
}

export function assertCan(ctx: AuthzContext, permission: Permission, propertyId?: string): void {
  if (!can(ctx, permission, propertyId)) {
    throw new AuthorizationError();
  }
}

export function visiblePropertyIds(ctx: AuthzContext): string[] | 'all' {
  if (ctx.isPlatformAdmin || isOrgWideRole(ctx.role)) {
    return 'all';
  }
  return ctx.assignedPropertyIds;
}
