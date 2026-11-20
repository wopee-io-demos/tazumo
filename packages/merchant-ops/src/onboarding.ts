import { isStaffOf, toInstant, type Actor, type Result } from './actors.ts';
import { validateStoreProfile, type FieldError, type StoreProfile } from './profile.ts';

export const onboardingStates = ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'live', 'suspended'] as const;
export type OnboardingState = (typeof onboardingStates)[number];

export type OnboardingCommand = 'submit' | 'start_review' | 'approve' | 'reject' | 'revise' | 'go_live' | 'suspend' | 'reinstate';

export type MerchantOnboarding = {
  merchantId: string;
  state: OnboardingState;
  profile: StoreProfile;
  updatedAt: string;
};

export type OnboardingError = 'illegal_transition' | 'forbidden' | 'reason_required' | 'invalid_profile' | 'invalid_instant';

type Who = 'own_staff' | 'support' | 'admin';

const transitions: Record<OnboardingCommand, { from: OnboardingState; to: OnboardingState; who: Who[]; reason?: true }> = {
  submit: { from: 'draft', to: 'submitted', who: ['own_staff'] },
  start_review: { from: 'submitted', to: 'in_review', who: ['support', 'admin'] },
  approve: { from: 'in_review', to: 'approved', who: ['support', 'admin'] },
  reject: { from: 'in_review', to: 'rejected', who: ['support', 'admin'], reason: true },
  revise: { from: 'rejected', to: 'draft', who: ['own_staff'] },
  go_live: { from: 'approved', to: 'live', who: ['own_staff', 'admin'] },
  suspend: { from: 'live', to: 'suspended', who: ['support', 'admin'], reason: true },
  reinstate: { from: 'suspended', to: 'live', who: ['admin'] },
};

export const allowedCommands = (state: OnboardingState): OnboardingCommand[] =>
  (Object.keys(transitions) as OnboardingCommand[]).filter((command) => transitions[command].from === state);

const permitted = (actor: Actor, merchantId: string, who: Who[]) =>
  who.some((w) => (w === 'own_staff' ? isStaffOf(actor, merchantId) : actor.role === w));

export function transitionOnboarding(
  merchant: MerchantOnboarding,
  command: OnboardingCommand,
  actor: Actor,
  at: Date | string,
  reason?: string,
): Result<MerchantOnboarding, OnboardingError> & { fieldErrors?: FieldError[] } {
  const rule = Object.hasOwn(transitions, command) ? transitions[command] : undefined;
  if (!rule) return { ok: false, error: 'illegal_transition' };
  if (!permitted(actor, merchant.merchantId, rule.who)) return { ok: false, error: 'forbidden' };
  if (merchant.state !== rule.from) return { ok: false, error: 'illegal_transition' };
  const trimmedReason = reason?.trim().slice(0, 500);
  if (rule.reason && !trimmedReason) return { ok: false, error: 'reason_required' };
  const instant = toInstant(at);
  if (!instant) return { ok: false, error: 'invalid_instant' };
  if (command === 'submit') {
    const fieldErrors = validateStoreProfile(merchant.profile);
    if (fieldErrors.length) return { ok: false, error: 'invalid_profile', fieldErrors };
  }

  const occurredAt = instant.toISOString();
  return {
    ok: true,
    value: { ...merchant, state: rule.to, updatedAt: occurredAt },
    audit: {
      actorUserId: actor.userId,
      action: `merchant_onboarding:${command}`,
      resourceType: 'merchant',
      resourceId: merchant.merchantId,
      occurredAt,
      details: { actorRole: actor.role, from: rule.from, to: rule.to, ...(trimmedReason ? { reason: trimmedReason } : {}) },
    },
  };
}

export const acceptsOrders = (state: OnboardingState) => state === 'live';
