import { CommerceRuleError } from './errors.ts';
import { assertValidMarket, vatCategories, type MarketConfig, type VatCategory } from './markets.ts';
import { divideRoundHalfUp, formatMinor, formatPercent, roundToIncrement, toSafeNumber, type Money } from './money.ts';

export const MAX_LINE_QUANTITY = 999;
export const MAX_LINES = 100;

export type OrderLineInput = {
  id: string;
  quantity: number;
  unitPrice: Money;
  vatCategory: VatCategory;
  /** Overrides the category default with another rate of the same market, for example a basic food at a lower rate. */
  vatRateId?: string;
};

export type OrderInput = { lines: readonly OrderLineInput[]; deliveryDistanceMeters: number };

export type BreakdownLine = {
  id: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  vatRateId: string;
  vatBasisPoints: number;
  explanation: string;
};

export type VatGroup = {
  rateId: string;
  basisPoints: number;
  label: string;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  explanation: string;
};

export type ComponentKind = 'line' | 'subtotal' | 'delivery_fee' | 'small_order_surcharge' | 'vat' | 'total' | 'rounding' | 'payable';

export type BreakdownComponent = {
  kind: ComponentKind;
  amountMinor: number;
  /** Components with `addsToPayable` sum to `payableMinor`. VAT already contained in VAT-inclusive prices is shown but not added. */
  addsToPayable: boolean;
  synthetic: boolean;
  explanation: string;
};

export type PriceBreakdown = {
  market: string;
  currency: string;
  pricesIncludeVat: boolean;
  lines: BreakdownLine[];
  subtotalMinor: number;
  deliveryFee: { amountMinor: number; baseMinor: number; bandFeeMinor: number; bandUpToMeters: number; distanceMeters: number; synthetic: true };
  smallOrderSurcharge: { amountMinor: number; thresholdMinor: number; capMinor: number; synthetic: true };
  vat: VatGroup[];
  totalMinor: number;
  roundingMinor: number;
  payableMinor: number;
  components: BreakdownComponent[];
  dataStatus: { vatRates: 'reverify'; vatRetrievedOn: string; feesSynthetic: true; notice: string };
};

const NOTICE = 'Demo pricing: delivery fee and small-order surcharge are synthetic, and VAT rates are research data to re-verify. Not a real quote or tax advice.';

function validateLine(market: MarketConfig, line: OrderLineInput, seen: Set<string>): { rateId: string } {
  if (typeof line !== 'object' || line === null) throw new CommerceRuleError('invalid_line', 'Every line must be an object');
  if (typeof line.id !== 'string' || line.id.length === 0) {
    throw new CommerceRuleError('invalid_line', 'Every line needs a non-empty id');
  }
  if (seen.has(line.id)) throw new CommerceRuleError('duplicate_line', `Line "${line.id}" appears twice`, { lineId: line.id });
  seen.add(line.id);
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_LINE_QUANTITY) {
    throw new CommerceRuleError('invalid_quantity', `Line "${line.id}" quantity must be an integer from 1 to ${MAX_LINE_QUANTITY}`, {
      lineId: line.id,
      quantity: line.quantity
    });
  }
  const minor = typeof line.unitPrice === 'object' && line.unitPrice !== null ? line.unitPrice.minorUnits : undefined;
  if (!Number.isSafeInteger(minor) || (minor as number) < 0) {
    throw new CommerceRuleError('invalid_amount', `Line "${line.id}" unit price must be non-negative integer minor units`, {
      lineId: line.id,
      minorUnits: minor
    });
  }
  if (line.unitPrice.currency !== market.currency) {
    throw new CommerceRuleError('currency_mismatch', `Line "${line.id}" is priced in ${line.unitPrice.currency}, market ${market.code} uses ${market.currency}`, {
      lineId: line.id,
      expected: market.currency,
      actual: line.unitPrice.currency
    });
  }
  if (!(vatCategories as readonly string[]).includes(line.vatCategory)) {
    throw new CommerceRuleError('unknown_vat_category', `Line "${line.id}" has unknown VAT category "${line.vatCategory}"`, {
      lineId: line.id,
      vatCategory: line.vatCategory
    });
  }
  if (line.vatRateId !== undefined && typeof line.vatRateId !== 'string') {
    throw new CommerceRuleError('invalid_line', `Line "${line.id}" vatRateId must be a string when present`, { lineId: line.id });
  }
  const defaultRateId = market.vat.categoryDefaults[line.vatCategory];
  const rateId = line.vatRateId ?? defaultRateId;
  const allowed = rateId === defaultRateId || market.vat.categoryOverrides[line.vatCategory].includes(rateId);
  if (!allowed || !Object.hasOwn(market.vat.rates, rateId)) {
    throw new CommerceRuleError('unknown_vat_rate', `Line "${line.id}" uses VAT rate "${rateId}", which market ${market.code} does not allow for ${line.vatCategory}`, {
      lineId: line.id,
      vatRateId: rateId,
      allowed: [defaultRateId, ...market.vat.categoryOverrides[line.vatCategory]]
    });
  }
  return { rateId };
}

function vatGroup(market: MarketConfig, rateId: string, amount: bigint): VatGroup {
  const r = market.vat.rates[rateId];
  const bp = BigInt(r.basisPoints);
  let net: bigint;
  let vat: bigint;
  if (market.pricesIncludeVat) {
    vat = divideRoundHalfUp(amount * bp, 10000n + bp);
    net = amount - vat;
  } else {
    net = amount;
    vat = divideRoundHalfUp(amount * bp, 10000n);
  }
  const netMinor = toSafeNumber(net, 'VAT base');
  const vatMinor = toSafeNumber(vat, 'VAT amount');
  const grossMinor = toSafeNumber(net + vat, 'gross amount');
  const how = market.pricesIncludeVat
    ? `contained in ${formatMinor(market, grossMinor)} (gross × ${r.basisPoints} ÷ ${10000 + r.basisPoints}, rounded half up)`
    : `added to ${formatMinor(market, netMinor)} (net × ${r.basisPoints / 10000}, rounded half up)`;
  return {
    rateId,
    basisPoints: r.basisPoints,
    label: r.label,
    netMinor,
    vatMinor,
    grossMinor,
    explanation: `VAT ${formatPercent(r.basisPoints)} (${r.label}): ${formatMinor(market, vatMinor)} ${how}. Rate to re-verify, retrieved ${market.vat.retrievedOn}.`
  };
}

/**
 * Server-authoritative price breakdown. Amounts are integer minor units of the market currency.
 * Throws CommerceRuleError for any invalid input instead of guessing.
 */
export function priceBreakdown(market: MarketConfig, order: OrderInput): PriceBreakdown {
  assertValidMarket(market);
  if (typeof order !== 'object' || order === null || !Array.isArray(order.lines) || order.lines.length === 0) {
    throw new CommerceRuleError('empty_order', 'An order needs at least one line');
  }
  if (order.lines.length > MAX_LINES) {
    throw new CommerceRuleError('too_many_lines', `An order may have at most ${MAX_LINES} lines`, { lines: order.lines.length });
  }
  const fmt = (minor: number) => formatMinor(market, minor);
  const seen = new Set<string>();
  const byRate = new Map<string, bigint>();
  const add = (rateId: string, amount: bigint) => byRate.set(rateId, (byRate.get(rateId) ?? 0n) + amount);

  const lines: BreakdownLine[] = order.lines.map((line) => {
    const { rateId } = validateLine(market, line, seen);
    const amount = BigInt(line.quantity) * BigInt(line.unitPrice.minorUnits);
    add(rateId, amount);
    const amountMinor = toSafeNumber(amount, `line ${line.id}`);
    const bp = market.vat.rates[rateId].basisPoints;
    return {
      id: line.id,
      quantity: line.quantity,
      unitPriceMinor: line.unitPrice.minorUnits,
      amountMinor,
      vatRateId: rateId,
      vatBasisPoints: bp,
      explanation: `${line.quantity} × ${fmt(line.unitPrice.minorUnits)} = ${fmt(amountMinor)}, VAT ${formatPercent(bp)} (${line.vatCategory})`
    };
  });
  const subtotalMinor = toSafeNumber(
    lines.reduce((sum, l) => sum + BigInt(l.amountMinor), 0n),
    'subtotal'
  );

  const distance = order.deliveryDistanceMeters;
  if (!Number.isFinite(distance) || distance < 0) {
    throw new CommerceRuleError('invalid_distance', 'Delivery distance must be a finite, non-negative number of metres', { distance });
  }
  const { baseMinor, bands } = market.deliveryFee;
  const band = bands.find((b) => distance <= b.upToMeters);
  if (!band) {
    throw new CommerceRuleError('outside_delivery_area', `Delivery distance ${distance} m is beyond the last band (${bands[bands.length - 1].upToMeters} m)`, {
      distance,
      maxMeters: bands[bands.length - 1].upToMeters
    });
  }
  const deliveryMinor = toSafeNumber(BigInt(baseMinor) + BigInt(band.feeMinor), 'delivery fee');

  const { thresholdMinor, capMinor } = market.smallOrderSurcharge;
  const surchargeMinor = subtotalMinor < thresholdMinor ? Math.min(thresholdMinor - subtotalMinor, capMinor) : 0;

  add(market.vat.feeRateId, BigInt(deliveryMinor) + BigInt(surchargeMinor));
  const vat = [...byRate.entries()]
    .filter(([, amount]) => amount > 0n)
    .sort(([a], [b]) => market.vat.rates[b].basisPoints - market.vat.rates[a].basisPoints || a.localeCompare(b))
    .map(([rateId, amount]) => vatGroup(market, rateId, amount));

  const totalMinor = market.pricesIncludeVat
    ? toSafeNumber(BigInt(subtotalMinor) + BigInt(deliveryMinor) + BigInt(surchargeMinor), 'total')
    : toSafeNumber(vat.reduce((sum, g) => sum + BigInt(g.grossMinor), 0n), 'total');
  const payableMinor = roundToIncrement(totalMinor, market.rounding.payableIncrementMinor);
  const roundingMinor = payableMinor - totalMinor;

  const feeVat = `taxed at the ${market.vat.feeRateId} rate as a platform service`;
  const components: BreakdownComponent[] = [
    ...lines.map((l): BreakdownComponent => ({ kind: 'line', amountMinor: l.amountMinor, addsToPayable: false, synthetic: false, explanation: l.explanation })),
    {
      kind: 'subtotal',
      amountMinor: subtotalMinor,
      addsToPayable: true,
      synthetic: false,
      explanation: `Items subtotal ${fmt(subtotalMinor)}, prices ${market.pricesIncludeVat ? 'include' : 'exclude'} VAT`
    },
    {
      kind: 'delivery_fee',
      amountMinor: deliveryMinor,
      addsToPayable: true,
      synthetic: true,
      explanation: `Synthetic delivery fee: base ${fmt(baseMinor)} + ${fmt(band.feeMinor)} for ${distance} m (band up to ${band.upToMeters} m), ${feeVat}. Not a real quote.`
    },
    {
      kind: 'small_order_surcharge',
      amountMinor: surchargeMinor,
      addsToPayable: true,
      synthetic: true,
      explanation:
        surchargeMinor > 0
          ? `Synthetic small-order surcharge: subtotal is ${fmt(thresholdMinor - subtotalMinor)} below ${fmt(thresholdMinor)}, charged up to ${fmt(capMinor)}, ${feeVat}.`
          : `No synthetic small-order surcharge: subtotal reaches the synthetic threshold of ${fmt(thresholdMinor)}.`
    },
    ...vat.map((g): BreakdownComponent => ({ kind: 'vat', amountMinor: g.vatMinor, addsToPayable: !market.pricesIncludeVat, synthetic: false, explanation: g.explanation })),
    { kind: 'total', amountMinor: totalMinor, addsToPayable: false, synthetic: false, explanation: `Total ${fmt(totalMinor)}` }
  ];
  if (roundingMinor !== 0) {
    components.push({
      kind: 'rounding',
      amountMinor: roundingMinor,
      addsToPayable: true,
      synthetic: false,
      explanation: `Rounded to the nearest ${fmt(market.rounding.payableIncrementMinor)}: ${roundingMinor > 0 ? '+' : ''}${fmt(roundingMinor)}, not subject to VAT`
    });
  }
  components.push({ kind: 'payable', amountMinor: payableMinor, addsToPayable: false, synthetic: false, explanation: `Amount to pay ${fmt(payableMinor)}` });

  return {
    market: market.code,
    currency: market.currency,
    pricesIncludeVat: market.pricesIncludeVat,
    lines,
    subtotalMinor,
    deliveryFee: { amountMinor: deliveryMinor, baseMinor, bandFeeMinor: band.feeMinor, bandUpToMeters: band.upToMeters, distanceMeters: distance, synthetic: true },
    smallOrderSurcharge: { amountMinor: surchargeMinor, thresholdMinor, capMinor, synthetic: true },
    vat,
    totalMinor,
    roundingMinor,
    payableMinor,
    components,
    dataStatus: { vatRates: 'reverify', vatRetrievedOn: market.vat.retrievedOn, feesSynthetic: true, notice: NOTICE }
  };
}
