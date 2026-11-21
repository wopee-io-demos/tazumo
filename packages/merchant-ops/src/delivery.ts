export type GeoPoint = { lat: number; lng: number };
export type DeliveryZone = { center: GeoPoint; radiusMeters: number };

export const earthRadiusMeters = 6_371_008.8;
export const maxRadiusMeters = 50_000;

const isPoint = (p: GeoPoint) =>
  Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function validateDeliveryZone(zone: DeliveryZone): string[] {
  const errors: string[] = [];
  if (!isPoint(zone?.center)) errors.push('center');
  if (!Number.isInteger(zone?.radiusMeters) || zone.radiusMeters <= 0 || zone.radiusMeters > maxRadiusMeters) errors.push('radiusMeters');
  return errors;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  if (!isPoint(a) || !isPoint(b)) throw new RangeError('coordinates out of range');
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function checkDelivery(
  zones: DeliveryZone[],
  destination: GeoPoint,
): { deliverable: true; distanceMeters: number } | { deliverable: false; reason: 'invalid_destination' | 'outside_zone' } {
  if (!isPoint(destination)) return { deliverable: false, reason: 'invalid_destination' };
  let nearest = Infinity;
  for (const zone of Array.isArray(zones) ? zones : []) {
    if (validateDeliveryZone(zone).length) continue;
    const d = distanceMeters(zone.center, destination);
    if (d <= zone.radiusMeters) nearest = Math.min(nearest, d);
  }
  return nearest === Infinity ? { deliverable: false, reason: 'outside_zone' } : { deliverable: true, distanceMeters: nearest };
}
