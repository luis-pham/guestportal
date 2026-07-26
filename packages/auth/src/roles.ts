export const ROLES = [
  'platform_admin',
  'organization_owner',
  'organization_admin',
  'property_manager',
  'content_manager',
  'staff',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'organization.read',
  'organization.update',
  'property.create',
  'property.read',
  'property.update',
  'portal.read',
  'portal.update',
  'portal.publish',
  'knowledge.read',
  'knowledge.create',
  'knowledge.publish',
  'catalog.read',
  'catalog.manage',
  'request.read',
  'request.assign',
  'request.transition',
  'order.read',
  'order.transition',
  'conversation.read',
  'conversation.reply',
  'team.read',
  'team.manage',
  'analytics.read',
  'audit.read',
  'security.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

type Grant = true | 'assigned' | 'configurable' | 'self/assigned' | 'assigned subset';

const MATRIX: Record<Exclude<Role, 'platform_admin'>, Partial<Record<Permission, Grant>>> = {
  organization_owner: Object.fromEntries(PERMISSIONS.map((p) => [p, true])) as Record<
    Permission,
    Grant
  >,
  organization_admin: {
    'organization.read': true,
    'organization.update': true,
    'property.create': true,
    'property.read': true,
    'property.update': true,
    'portal.read': true,
    'portal.update': true,
    'portal.publish': true,
    'knowledge.read': true,
    'knowledge.create': true,
    'knowledge.publish': true,
    'catalog.read': true,
    'catalog.manage': true,
    'request.read': true,
    'request.assign': true,
    'request.transition': true,
    'order.read': true,
    'order.transition': true,
    'conversation.read': true,
    'conversation.reply': true,
    'team.read': true,
    'team.manage': true,
    'analytics.read': true,
    'audit.read': true,
    'security.manage': 'configurable',
  },
  property_manager: {
    'organization.read': true,
    'property.read': 'assigned',
    'property.update': 'assigned',
    'portal.read': 'assigned',
    'portal.update': 'assigned',
    'portal.publish': 'assigned',
    'knowledge.read': 'assigned',
    'knowledge.create': 'assigned',
    'knowledge.publish': 'assigned',
    'catalog.read': 'assigned',
    'catalog.manage': 'assigned',
    'request.read': 'assigned',
    'request.assign': 'assigned',
    'request.transition': 'assigned',
    'order.read': 'assigned',
    'order.transition': 'assigned',
    'conversation.read': 'assigned',
    'conversation.reply': 'assigned',
    'team.read': 'assigned',
    'analytics.read': 'assigned',
    'audit.read': 'assigned subset',
  },
  content_manager: {
    'organization.read': true,
    'property.read': 'assigned',
    'portal.read': 'assigned',
    'portal.update': 'assigned',
    'portal.publish': 'configurable',
    'knowledge.read': 'assigned',
    'knowledge.create': 'assigned',
    'knowledge.publish': 'configurable',
    'catalog.read': 'assigned',
    'catalog.manage': 'configurable',
  },
  staff: {
    'organization.read': true,
    'property.read': 'assigned',
    'catalog.read': 'assigned',
    'request.read': 'assigned',
    'request.assign': 'self/assigned',
    'request.transition': 'assigned',
    'order.read': 'assigned',
    'order.transition': 'assigned',
    'conversation.read': 'assigned',
    'conversation.reply': 'assigned',
  },
  viewer: {
    'organization.read': true,
    'property.read': 'assigned',
    'portal.read': true,
    'knowledge.read': true,
    'catalog.read': true,
    'request.read': true,
    'order.read': true,
    'analytics.read': true,
  },
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  if (role === 'platform_admin') {
    return true;
  }
  return MATRIX[role][permission] !== undefined;
}

export function permissionScope(role: Role, permission: Permission): Grant | false {
  if (role === 'platform_admin') {
    return true;
  }
  return MATRIX[role][permission] ?? false;
}

export function isOrgWideRole(role: Role): boolean {
  return (
    role === 'platform_admin' || role === 'organization_owner' || role === 'organization_admin'
  );
}
