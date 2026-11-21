import { replay } from './machine.ts';
import type { EventType, OrderEvent, OrderStatus, Result } from './types.ts';

export const customerReasons = Object.freeze([
  'out_of_stock',
  'too_busy',
  'closing_soon',
  'other',
  'merchant_did_not_respond',
  'payment_failed',
  'technical_problem',
  'customer_request',
  'cancelled_by_support',
] as const);
export type CustomerReason = (typeof customerReasons)[number];

export type TimelineEntry = { sequence: number; type: EventType; status: OrderStatus; occurredAt: string; reason?: CustomerReason };
export type CustomerTimeline = { orderId: string; status: OrderStatus; lastUpdatedAt: string; entries: TimelineEntry[] };

function customerReason(event: OrderEvent): CustomerReason | undefined {
  switch (event.type) {
    case 'merchant_declined':
      return (customerReasons as readonly string[]).includes(event.reason ?? '') ? (event.reason as CustomerReason) : 'other';
    case 'merchant_auto_declined':
      return 'merchant_did_not_respond';
    case 'payment_failed':
      return 'payment_failed';
    case 'failed':
      return 'technical_problem';
    case 'cancelled':
      return event.actor.kind === 'user' && event.actor.role === 'customer' ? 'customer_request' : 'cancelled_by_support';
    default:
      return undefined;
  }
}

export function customerTimeline(events: readonly OrderEvent[]): Result<CustomerTimeline> {
  const state = replay(events);
  if (!state.ok) return state;
  return {
    ok: true,
    value: {
      orderId: state.value.id,
      status: state.value.status,
      lastUpdatedAt: state.value.updatedAt,
      entries: events.map((e) => {
        const reason = customerReason(e);
        return { sequence: e.sequence, type: e.type, status: e.status, occurredAt: e.occurredAt, ...(reason ? { reason } : {}) };
      }),
    },
  };
}
