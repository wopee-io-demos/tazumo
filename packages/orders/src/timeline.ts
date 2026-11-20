import { replay } from './machine.ts';
import type { EventType, OrderEvent, OrderStatus, Result } from './types.ts';

export type TimelineEntry = { sequence: number; type: EventType; status: OrderStatus; occurredAt: string; reason?: string };
export type CustomerTimeline = { orderId: string; status: OrderStatus; lastUpdatedAt: string; entries: TimelineEntry[] };

const customerReasons: ReadonlySet<EventType> = new Set(['merchant_declined', 'merchant_auto_declined', 'cancelled', 'failed', 'payment_failed']);

export function customerTimeline(events: readonly OrderEvent[]): Result<CustomerTimeline> {
  const state = replay(events);
  if (!state.ok) return state;
  return {
    ok: true,
    value: {
      orderId: state.value.id,
      status: state.value.status,
      lastUpdatedAt: state.value.updatedAt,
      entries: events.map((e) => ({
        sequence: e.sequence,
        type: e.type,
        status: e.status,
        occurredAt: e.occurredAt,
        ...(customerReasons.has(e.type) && e.reason ? { reason: e.reason } : {}),
      })),
    },
  };
}
