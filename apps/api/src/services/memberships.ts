import { eq } from 'drizzle-orm';
import type { Role } from '@guestportal/auth';
import { organizationMemberships, propertyAssignments, type Database } from '@guestportal/db';

export async function loadMemberships(db: Database, userId: string) {
  const membershipRows = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.userId, userId));

  const assignmentRows = await db
    .select()
    .from(propertyAssignments)
    .where(eq(propertyAssignments.userId, userId));

  return membershipRows
    .filter((row) => row.status === 'active')
    .map((row) => ({
      organizationId: row.organizationId,
      role: row.role as Role,
      propertyIds: assignmentRows
        .filter((assignment) => assignment.organizationId === row.organizationId)
        .map((assignment) => assignment.propertyId),
    }));
}
