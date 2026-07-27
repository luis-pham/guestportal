import { createHash } from 'node:crypto';
import type { PortalLocation } from '@guestportal/contracts';

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

/** Property-scoped preview locations (no cross-property IDs). */
export function previewLocationsForProperty(propertyId: string): PortalLocation[] {
  return [
    {
      id: uuidFromSeed(`${propertyId}:lobby`),
      propertyId,
      code: 'lobby',
      name: { vi: 'Sảnh', en: 'Lobby' },
    },
    {
      id: uuidFromSeed(`${propertyId}:room`),
      propertyId,
      code: 'guest_room',
      name: { vi: 'Phòng khách', en: 'Guest room' },
    },
  ];
}

export function resolvePreviewLocation(
  propertyId: string,
  locationId: string | undefined,
): PortalLocation | null {
  if (!locationId) return null;
  const match = previewLocationsForProperty(propertyId).find((item) => item.id === locationId);
  return match ?? null;
}
