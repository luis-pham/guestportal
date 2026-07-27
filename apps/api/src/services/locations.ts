import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { PortalLocation } from '@guestportal/contracts';
import { locations } from '@guestportal/db';

function uuidFromSeed(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const DEFAULT_LOCATION_SPECS = [
  {
    seed: 'lobby',
    code: 'lobby',
    type: 'area',
    name: { vi: 'Sảnh', en: 'Lobby' },
  },
  {
    seed: 'room',
    code: 'guest_room',
    type: 'room',
    name: { vi: 'Phòng khách', en: 'Guest room' },
  },
] as const;

export function defaultLocationId(propertyId: string, seed: string): string {
  return uuidFromSeed(`${propertyId}:${seed}`);
}

export async function ensureDefaultLocations(
  app: FastifyInstance,
  property: { id: string; organizationId: string },
): Promise<PortalLocation[]> {
  const existing = await app.db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.propertyId, property.id),
        eq(locations.organizationId, property.organizationId),
        eq(locations.status, 'active'),
      ),
    );

  if (existing.length > 0) {
    return existing.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      code: row.code,
      name: row.name,
    }));
  }

  const created: PortalLocation[] = [];
  for (const spec of DEFAULT_LOCATION_SPECS) {
    const id = defaultLocationId(property.id, spec.seed);
    const [row] = await app.db
      .insert(locations)
      .values({
        id,
        organizationId: property.organizationId,
        propertyId: property.id,
        type: spec.type,
        code: spec.code,
        name: spec.name,
        status: 'active',
      })
      .onConflictDoNothing()
      .returning();

    if (row) {
      created.push({
        id: row.id,
        propertyId: row.propertyId,
        code: row.code,
        name: row.name,
      });
      continue;
    }

    const fallback = await app.db
      .select()
      .from(locations)
      .where(and(eq(locations.propertyId, property.id), eq(locations.code, spec.code)))
      .limit(1);
    if (fallback[0]) {
      created.push({
        id: fallback[0].id,
        propertyId: fallback[0].propertyId,
        code: fallback[0].code,
        name: fallback[0].name,
      });
    }
  }

  return created;
}

export async function loadPropertyLocation(
  app: FastifyInstance,
  property: { id: string; organizationId: string },
  locationId: string,
) {
  const rows = await app.db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.propertyId, property.id),
        eq(locations.organizationId, property.organizationId),
        eq(locations.status, 'active'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
