import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { createDb } from './client.js';
import { PORTAL_TEMPLATE_SEEDS } from '@guestportal/contracts';
import {
  organizationMemberships,
  organizations,
  portalTemplates,
  properties,
  propertyAssignments,
  users,
} from './schema.js';

const TEST_PASSWORD = 'Password123!';

async function upsertUser(
  db: ReturnType<typeof createDb>['db'],
  input: {
    email: string;
    displayName: string;
    locale: string;
    isPlatformAdmin?: boolean;
  },
) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing[0]) {
    return existing[0];
  }
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName,
      locale: input.locale,
      passwordHash,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
    })
    .returning();
  if (!user) throw new Error(`Failed to create user ${input.email}`);
  return user;
}

async function main() {
  const databaseUrl = process.env.DATABASE_OWNER_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_OWNER_URL or DATABASE_URL is required');

  const { db, sql } = createDb(databaseUrl);
  await sql`select set_config('app.organization_id', '', true)`;

  const aurora =
    (
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, 'aurora-hospitality'))
        .limit(1)
    )[0] ??
    (
      await db
        .insert(organizations)
        .values({
          name: 'Aurora Hospitality',
          slug: 'aurora-hospitality',
          defaultLocale: 'vi',
        })
        .returning()
    )[0];

  const nomad =
    (
      await db.select().from(organizations).where(eq(organizations.slug, 'nomad-homes')).limit(1)
    )[0] ??
    (
      await db
        .insert(organizations)
        .values({
          name: 'Nomad Homes',
          slug: 'nomad-homes',
          defaultLocale: 'en',
        })
        .returning()
    )[0];

  if (!aurora || !nomad) throw new Error('Failed to seed organizations');

  async function ensureProperty(
    organizationId: string,
    slug: string,
    name: string,
    type: string,
    timezone: string,
  ) {
    const existing = await db
      .select()
      .from(properties)
      .where(and(eq(properties.slug, slug), eq(properties.organizationId, organizationId)))
      .limit(1);
    if (existing[0]) return existing[0];
    const [row] = await db
      .insert(properties)
      .values({
        organizationId,
        slug,
        name,
        type,
        timezone,
        currency: 'USD',
        defaultLocale: 'en',
        supportedLocales: ['en', 'vi'],
      })
      .returning();
    if (!row) throw new Error(`Failed property ${slug}`);
    return row;
  }

  const hotel = await ensureProperty(
    aurora.id,
    'aurora-city-hotel',
    'Aurora City Hotel',
    'hotel',
    'Asia/Ho_Chi_Minh',
  );
  const cruise = await ensureProperty(
    aurora.id,
    'aurora-bay-cruise',
    'Aurora Bay Cruise',
    'cruise',
    'Asia/Ho_Chi_Minh',
  );
  await ensureProperty(
    aurora.id,
    'aurora-forest-resort',
    'Aurora Forest Resort',
    'resort',
    'Asia/Ho_Chi_Minh',
  );
  await ensureProperty(
    nomad.id,
    'old-quarter-loft',
    'Old Quarter Loft',
    'airbnb',
    'Asia/Ho_Chi_Minh',
  );
  await ensureProperty(nomad.id, 'riverside-villa', 'Riverside Villa', 'airbnb', 'Asia/Bangkok');

  const seedUsers: Array<{
    email: string;
    displayName: string;
    locale: string;
    org: string;
    role: string;
    properties?: string[];
  }> = [
    {
      email: 'owner@aurora.test',
      displayName: 'Aurora Owner',
      locale: 'vi',
      org: aurora.id,
      role: 'organization_owner',
    },
    {
      email: 'admin@aurora.test',
      displayName: 'Aurora Admin',
      locale: 'en',
      org: aurora.id,
      role: 'organization_admin',
    },
    {
      email: 'manager.hotel@aurora.test',
      displayName: 'Hotel Manager',
      locale: 'vi',
      org: aurora.id,
      role: 'property_manager',
      properties: [hotel.id],
    },
    {
      email: 'manager.cruise@aurora.test',
      displayName: 'Cruise Manager',
      locale: 'en',
      org: aurora.id,
      role: 'property_manager',
      properties: [cruise.id],
    },
    {
      email: 'content@aurora.test',
      displayName: 'Content Manager',
      locale: 'vi',
      org: aurora.id,
      role: 'content_manager',
      properties: [hotel.id, cruise.id],
    },
    {
      email: 'staff.hotel@aurora.test',
      displayName: 'Hotel Staff',
      locale: 'vi',
      org: aurora.id,
      role: 'staff',
      properties: [hotel.id],
    },
    {
      email: 'staff.cruise@aurora.test',
      displayName: 'Cruise Staff',
      locale: 'en',
      org: aurora.id,
      role: 'staff',
      properties: [cruise.id],
    },
    {
      email: 'viewer@aurora.test',
      displayName: 'Viewer',
      locale: 'en',
      org: aurora.id,
      role: 'viewer',
      properties: [hotel.id],
    },
    {
      email: 'owner@nomad.test',
      displayName: 'Nomad Owner',
      locale: 'en',
      org: nomad.id,
      role: 'organization_owner',
    },
  ];

  for (const item of seedUsers) {
    const user = await upsertUser(db, item);
    const membership = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.organizationId, item.org),
        ),
      )
      .limit(1);
    if (!membership[0]) {
      await db.insert(organizationMemberships).values({
        organizationId: item.org,
        userId: user.id,
        role: item.role,
      });
    }
    for (const propertyId of item.properties ?? []) {
      const assigns = await db
        .select()
        .from(propertyAssignments)
        .where(
          and(
            eq(propertyAssignments.userId, user.id),
            eq(propertyAssignments.propertyId, propertyId),
          ),
        )
        .limit(1);
      if (!assigns[0]) {
        await db.insert(propertyAssignments).values({
          organizationId: item.org,
          propertyId,
          userId: user.id,
        });
      }
    }
  }

  for (const template of PORTAL_TEMPLATE_SEEDS) {
    const existing = await db
      .select()
      .from(portalTemplates)
      .where(eq(portalTemplates.id, template.id))
      .limit(1);
    if (existing[0]) {
      await db
        .update(portalTemplates)
        .set({
          propertyType: template.propertyType,
          name: template.name,
          config: template.config,
        })
        .where(eq(portalTemplates.id, template.id));
    } else {
      await db.insert(portalTemplates).values({
        id: template.id,
        propertyType: template.propertyType,
        name: template.name,
        config: template.config,
      });
    }
  }

  console.log('Seed complete. Test password:', TEST_PASSWORD);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
