import { matchingRole, toInstant, type Principal, type Result, type Rule } from './actors.ts';
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

export type OnboardingError = 'illegal_transition' | 'forbidden' | 'reason_required' | 'reason_too_long' | 'invalid_profile' | 'invalid_instant';

export const maxReasonLength = 500;

const transitions: Record<OnboardingCommand, { from: OnboardingState; to: OnboardingState; who: Rule[]; reason?: true }> = {
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

export function transitionOnboarding(
  merchant: MerchantOnboarding,
  command: OnboardingCommand,
  principal: Principal,
  at: Date | string,
  reason?: string,
): Result<MerchantOnboarding, OnboardingError> & { fieldErrors?: FieldError[] } {
  const rule = Object.hasOwn(transitions, command) ? transitions[command] : undefined;
  if (!rule) return { ok: false, error: 'illegal_transition' };
  const role = matchingRole(principal, merchant.merchantId, rule.who);
  if (!role) return { ok: false, error: 'forbidden' };
  if (merchant.state !== rule.from) return { ok: false, error: 'illegal_transition' };
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (rule.reason && !trimmedReason) return { ok: false, error: 'reason_required' };
  if (trimmedReason.length > maxReasonLength) return { ok: false, error: 'reason_too_long' };
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
      actorUserId: principal.userId,
      action: `merchant_onboarding:${command}`,
      resourceType: 'merchant',
      resourceId: merchant.merchantId,
      occurredAt,
      details: { actorRole: role, from: rule.from, to: rule.to, ...(trimmedReason ? { reason: trimmedReason } : {}) },
    },
  };
}

export const acceptsOrders = (state: OnboardingState) => state === 'live';
