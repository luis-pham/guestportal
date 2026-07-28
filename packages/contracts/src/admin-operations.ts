import { z } from 'zod';

export const adminRoleSchema = z.enum([
  'organization_owner',
  'organization_admin',
  'property_manager',
  'content_manager',
  'staff',
  'viewer',
]);

export const adminTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  locale: z.string(),
  role: adminRoleSchema,
  status: z.enum(['active', 'revoked', 'invited']),
  propertyIds: z.array(z.string().uuid()),
  lastActiveAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const adminTeamMemberUpdateSchema = z
  .object({
    role: adminRoleSchema.optional(),
    propertyIds: z.array(z.string().uuid()).optional(),
    status: z.enum(['active', 'revoked']).optional(),
    confirm: z.literal(true).optional(),
  })
  .refine(
    (value) =>
      value.role !== undefined || value.propertyIds !== undefined || value.status !== undefined,
    { message: 'At least one team member field is required' },
  )
  .refine((value) => value.status !== 'revoked' || value.confirm === true, {
    message: 'Revoking a team member requires explicit confirmation',
  });

export const organizationAdminSettingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    defaultLocale: z.enum(['vi', 'en']).optional(),
  })
  .refine((value) => value.name !== undefined || value.defaultLocale !== undefined, {
    message: 'At least one organization setting field is required',
  });

export const knowledgeSourceActionSchema = z.object({
  confirm: z.literal(true),
});

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminTeamMember = z.infer<typeof adminTeamMemberSchema>;
export type AdminTeamMemberUpdateInput = z.infer<typeof adminTeamMemberUpdateSchema>;
export type OrganizationAdminSettingsUpdateInput = z.infer<
  typeof organizationAdminSettingsUpdateSchema
>;
