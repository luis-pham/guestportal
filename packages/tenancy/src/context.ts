import type { Role } from '@guestportal/auth';

export type ActorType = 'guest' | 'staff' | 'system';

export type TenantContext = {
  organizationId: string;
  propertyIds?: string[];
  actorId?: string;
  actorType: ActorType;
  role?: Role;
  isPlatformAdmin?: boolean;
};

export function assertSameOrganization(ctx: TenantContext, organizationId: string): void {
  if (ctx.organizationId !== organizationId) {
    throw new Error('TENANT_MISMATCH');
  }
}

export function filterPropertyScope(ctx: TenantContext, propertyId: string): boolean {
  if (!ctx.propertyIds || ctx.propertyIds.length === 0) {
    return Boolean(
      ctx.isPlatformAdmin || ctx.role === 'organization_owner' || ctx.role === 'organization_admin',
    );
  }
  return ctx.propertyIds.includes(propertyId);
}
