import { toInstant } from './actors.ts';
import { isOpenAt, type OpeningHours } from './hours.ts';
import { acceptsOrders, type OnboardingState } from './onboarding.ts';

export type Availability = { status: 'in_stock' } | { status: 'out_of_stock' } | { status: 'scheduled'; from: string; until?: string };

export function validateAvailability(availability: Availability): string[] {
  if (availability.status !== 'scheduled') return availability.status === 'in_stock' || availability.status === 'out_of_stock' ? [] : ['status'];
  const from = toInstant(availability.from);
  if (!from) return ['from'];
  if (availability.until === undefined) return [];
  const until = toInstant(availability.until);
  return until && until > from ? [] : ['until'];
}

export function isAvailableAt(availability: Availability, at: Date | string): boolean {
  const instant = toInstant(at);
  if (!instant || validateAvailability(availability).length) return false;
  if (availability.status !== 'scheduled') return availability.status === 'in_stock';
  const until = availability.until === undefined ? null : toInstant(availability.until);
  return instant >= toInstant(availability.from)! && (!until || instant < until);
}

export type OrderableCheck = { ok: true } | { ok: false; reason: 'merchant_not_live' | 'merchant_closed' | 'item_unavailable' };

export function checkOrderable(
  input: { onboardingState: OnboardingState; hours: OpeningHours; availability: Availability },
  at: Date | string,
): OrderableCheck {
  if (!acceptsOrders(input.onboardingState)) return { ok: false, reason: 'merchant_not_live' };
  if (!isOpenAt(input.hours, at)) return { ok: false, reason: 'merchant_closed' };
  if (!isAvailableAt(input.availability, at)) return { ok: false, reason: 'item_unavailable' };
  return { ok: true };
}
