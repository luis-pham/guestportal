import { assertCan, can, type AuthzContext, type Permission, type Role } from '@guestportal/auth';
import type { TenantContext } from '@guestportal/tenancy';

export type RequestAuth = {
  userId: string;
  email: string;
  displayName: string;
  locale: string;
  isPlatformAdmin: boolean;
  memberships: Array<{
    organizationId: string;
    role: Role;
    propertyIds: string[];
  }>;
  activeOrganizationId: string | null;
};

export function toAuthzContext(auth: RequestAuth, organizationId: string): AuthzContext {
  const membership = auth.memberships.find((m) => m.organizationId === organizationId);
  if (!membership && !auth.isPlatformAdmin) {
    throw new Error('NO_MEMBERSHIP');
  }
  return {
    userId: auth.userId,
    organizationId,
    role: membership?.role ?? 'viewer',
    assignedPropertyIds: membership?.propertyIds ?? [],
    isPlatformAdmin: auth.isPlatformAdmin,
  };
}

export function toTenantContext(authz: AuthzContext): TenantContext {
  const ctx: TenantContext = {
    organizationId: authz.organizationId,
    propertyIds: authz.assignedPropertyIds,
    actorId: authz.userId,
    actorType: 'staff',
    role: authz.role,
  };
  if (authz.isPlatformAdmin !== undefined) {
    ctx.isPlatformAdmin = authz.isPlatformAdmin;
  }
  return ctx;
}

export { assertCan, can };
export type { Permission, Role };
