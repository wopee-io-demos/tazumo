import { CommerceRuleError } from './errors.ts';

/**
 * VAT rates are research data retrieved on 2026-11-20 and must be re-verified before any real use
 * (sources and classification assumptions: docs/adr/0018-commerce-rules.md).
 * Delivery fees and small-order surcharges are synthetic demo values, never real prices.
 */
export const VAT_DATA_RETRIEVED_ON = '2026-11-20';

export const vatCategories = ['food', 'groceries', 'flowers', 'gifts', 'electronics'] as const;
export type VatCategory = (typeof vatCategories)[number];

export const marketCodes = ['SK', 'CZ', 'DE', 'AT'] as const;
export type MarketCode = (typeof marketCodes)[number];

export type VatSource = { id: string; title: string; url: string; retrievedOn: string };

export type VatRate = { id: string; basisPoints: number; label: string; sourceIds: readonly string[] };

export type DeliveryBand = { upToMeters: number; feeMinor: number };

export type MarketConfig = {
  code: string;
  currency: string;
  locale: string;
  pricesIncludeVat: boolean;
  vat: {
    status: 'reverify';
    retrievedOn: string;
    rates: Readonly<Record<string, VatRate>>;
    categoryDefaults: Readonly<Record<VatCategory, string>>;
    /** Other rates a line of the category may opt into with `vatRateId`; anything else is rejected. */
    categoryOverrides: Readonly<Record<VatCategory, readonly string[]>>;
    feeRateId: string;
  };
  rounding: { payableIncrementMinor: number; wholeUnitDisplay: boolean };
  deliveryFee: { synthetic: true; baseMinor: number; bands: readonly DeliveryBand[] };
  smallOrderSurcharge: { synthetic: true; thresholdMinor: number; capMinor: number };
};

export const vatSources: Readonly<Record<string, VatSource>> = {
  'eu-your-europe': {
    id: 'eu-your-europe',
    title: 'Your Europe: VAT rates applied in EU countries (European Union)',
    url: 'https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'sk-fs-rates': {
    id: 'sk-fs-rates',
    title: 'Finančná správa SR: DPH, Sadzba dane, Všeobecné informácie',
    url: 'https://podpora.financnasprava.sk/525847-V%C5%A1eobecn%C3%A9-inform%C3%A1cie',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'cz-gfr-2024': {
    id: 'cz-gfr-2024',
    title: 'Generální finanční ředitelství: Informace GFŘ ke změnám sazeb DPH od 1. 1. 2024',
    url: 'https://financnisprava.gov.cz/assets/cs/prilohy/d-seznam-dani/Informace_GFR_ke_zmenam_sazeb_DPH_od_1_1_2024.pdf',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'de-ustg-12': {
    id: 'de-ustg-12',
    title: 'Umsatzsteuergesetz § 12 Steuersätze (gesetze-im-internet.de, BMJ)',
    url: 'https://www.gesetze-im-internet.de/ustg_1980/__12.html',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'de-ustg-anlage-2': {
    id: 'de-ustg-anlage-2',
    title: 'Umsatzsteuergesetz Anlage 2 (gesetze-im-internet.de, BMJ)',
    url: 'https://www.gesetze-im-internet.de/ustg_1980/anlage_2.html',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'at-ustg-10': {
    id: 'at-ustg-10',
    title: 'RIS: Umsatzsteuergesetz 1994 § 10, Fassung ab 01.07.2026 (BGBl. I Nr. 37/2026)',
    url: 'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Paragraf=10',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'at-ustg-anlage-2': {
    id: 'at-ustg-anlage-2',
    title: 'RIS: Umsatzsteuergesetz 1994 Anlage 2',
    url: 'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004873&Anlage=2',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  },
  'at-usp-4-9': {
    id: 'at-usp-4-9',
    title: 'Unternehmensserviceportal: Neuer Umsatzsteuersatz von 4,9 Prozent',
    url: 'https://www.usp.gv.at/aktuelles/newsliste/neuer_ustsatz.html',
    retrievedOn: VAT_DATA_RETRIEVED_ON
  }
};

const rate = (id: string, basisPoints: number, label: string, sourceIds: string[]): VatRate => ({ id, basisPoints, label, sourceIds });
const EU = 'eu-your-europe';
const noOverrides = { food: [], groceries: [], flowers: [], gifts: [], electronics: [] } as const;

const euroFees = {
  deliveryFee: {
    synthetic: true,
    baseMinor: 149,
    bands: [
      { upToMeters: 2000, feeMinor: 0 },
      { upToMeters: 4000, feeMinor: 100 },
      { upToMeters: 7000, feeMinor: 250 }
    ]
  },
  smallOrderSurcharge: { synthetic: true, thresholdMinor: 1000, capMinor: 300 }
} as const;

const euroRounding = { payableIncrementMinor: 1, wholeUnitDisplay: false } as const;

export const markets: Readonly<Record<MarketCode, MarketConfig>> = {
  SK: {
    code: 'SK',
    currency: 'EUR',
    locale: 'sk-SK',
    pricesIncludeVat: true,
    vat: {
      status: 'reverify',
      retrievedOn: VAT_DATA_RETRIEVED_ON,
      rates: {
        standard: rate('standard', 2300, 'Standard rate', [EU, 'sk-fs-rates']),
        reduced: rate('reduced', 1900, 'Reduced rate: listed foods', [EU, 'sk-fs-rates']),
        reduced5: rate('reduced5', 500, 'Reduced rate: listed basic foods, meals served in catering', [EU, 'sk-fs-rates'])
      },
      categoryDefaults: { food: 'reduced', groceries: 'reduced', flowers: 'standard', gifts: 'standard', electronics: 'standard' },
      categoryOverrides: { ...noOverrides, food: ['standard'], groceries: ['reduced5', 'standard'] },
      feeRateId: 'standard'
    },
    rounding: euroRounding,
    ...euroFees
  },
  CZ: {
    code: 'CZ',
    currency: 'CZK',
    locale: 'cs-CZ',
    pricesIncludeVat: true,
    vat: {
      status: 'reverify',
      retrievedOn: VAT_DATA_RETRIEVED_ON,
      rates: {
        standard: rate('standard', 2100, 'Standard rate (includes cut flowers since 2024)', [EU, 'cz-gfr-2024']),
        reduced: rate('reduced', 1200, 'Reduced rate: food and catering services', [EU, 'cz-gfr-2024'])
      },
      categoryDefaults: { food: 'reduced', groceries: 'reduced', flowers: 'standard', gifts: 'standard', electronics: 'standard' },
      categoryOverrides: noOverrides,
      feeRateId: 'standard'
    },
    rounding: { payableIncrementMinor: 100, wholeUnitDisplay: true },
    deliveryFee: {
      synthetic: true,
      baseMinor: 3900,
      bands: [
        { upToMeters: 2000, feeMinor: 0 },
        { upToMeters: 4000, feeMinor: 2000 },
        { upToMeters: 7000, feeMinor: 5000 }
      ]
    },
    smallOrderSurcharge: { synthetic: true, thresholdMinor: 25000, capMinor: 7900 }
  },
  DE: {
    code: 'DE',
    currency: 'EUR',
    locale: 'de-DE',
    pricesIncludeVat: true,
    vat: {
      status: 'reverify',
      retrievedOn: VAT_DATA_RETRIEVED_ON,
      rates: {
        standard: rate('standard', 1900, 'Regelsteuersatz', [EU, 'de-ustg-12']),
        reduced: rate('reduced', 700, 'Ermäßigter Satz: Anlage 2 goods (food, cut flowers), restaurant food', [EU, 'de-ustg-12', 'de-ustg-anlage-2'])
      },
      categoryDefaults: { food: 'reduced', groceries: 'reduced', flowers: 'reduced', gifts: 'standard', electronics: 'standard' },
      categoryOverrides: noOverrides,
      feeRateId: 'standard'
    },
    rounding: euroRounding,
    ...euroFees
  },
  AT: {
    code: 'AT',
    currency: 'EUR',
    locale: 'de-AT',
    pricesIncludeVat: true,
    vat: {
      status: 'reverify',
      retrievedOn: VAT_DATA_RETRIEVED_ON,
      rates: {
        standard: rate('standard', 2000, 'Normalsteuersatz', [EU, 'at-ustg-10']),
        reduced: rate('reduced', 1000, 'Ermäßigter Satz: Anlage 1 food, restaurant sales', [EU, 'at-ustg-10']),
        reduced13: rate('reduced13', 1300, 'Ermäßigter Satz: Anlage 2 goods (live plants, cut flowers)', [EU, 'at-ustg-10', 'at-ustg-anlage-2']),
        basicFood: rate('basicFood', 490, 'Ermäßigter Satz: Anlage 3 basic foods (since 1 July 2026)', ['at-ustg-10', 'at-usp-4-9'])
      },
      categoryDefaults: { food: 'reduced', groceries: 'reduced', flowers: 'reduced13', gifts: 'standard', electronics: 'standard' },
      categoryOverrides: { ...noOverrides, groceries: ['basicFood'] },
      feeRateId: 'standard'
    },
    rounding: euroRounding,
    ...euroFees
  }
};

export function getMarket(code: string): MarketConfig {
  const market = (markets as Record<string, MarketConfig | undefined>)[code];
  if (!Object.hasOwn(markets, code) || !market) {
    throw new CommerceRuleError('unknown_market', `Unknown market "${code}"`, { code, supported: marketCodes });
  }
  return market;
}

const isMinor = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function assertValidMarket(market: MarketConfig): void {
  const problems: string[] = [];
  if (!/^[A-Z]{3}$/.test(market.currency)) problems.push('currency must be an ISO 4217 code');
  for (const [id, r] of Object.entries(market.vat.rates)) {
    if (r.id !== id) problems.push(`rate key ${id} does not match its id`);
    if (!Number.isSafeInteger(r.basisPoints) || r.basisPoints < 0 || r.basisPoints > 10000) problems.push(`rate ${id} out of range`);
  }
  const overrides: unknown = market.vat.categoryOverrides;
  for (const category of vatCategories) {
    if (!Object.hasOwn(market.vat.rates, market.vat.categoryDefaults[category])) problems.push(`category ${category} has no rate`);
    const list = typeof overrides === 'object' && overrides !== null ? (overrides as Record<string, unknown>)[category] : undefined;
    if (!Array.isArray(list)) {
      problems.push(`category ${category} needs an overrides array`);
      continue;
    }
    for (const id of list) {
      if (typeof id !== 'string' || !Object.hasOwn(market.vat.rates, id)) problems.push(`category ${category} override ${String(id)} is not defined`);
    }
  }
  if (typeof market.pricesIncludeVat !== 'boolean') problems.push('pricesIncludeVat must be a boolean');
  try {
    const digits = new Intl.NumberFormat(market.locale, { style: 'currency', currency: market.currency }).resolvedOptions().maximumFractionDigits;
    if (digits !== 2) problems.push('only currencies with two minor digits are supported');
  } catch {
    problems.push('locale or currency is not supported by Intl');
  }
  if (!Object.hasOwn(market.vat.rates, market.vat.feeRateId)) problems.push('fee rate is not defined');
  const increment = market.rounding.payableIncrementMinor;
  if (!Number.isSafeInteger(increment) || increment < 1) problems.push('rounding increment must be a positive integer');
  if (!isMinor(market.deliveryFee.baseMinor)) problems.push('delivery base fee must be non-negative minor units');
  const { bands } = market.deliveryFee;
  if (bands.length === 0) problems.push('delivery fee needs at least one distance band');
  bands.forEach((band, i) => {
    if (!isMinor(band.upToMeters) || !isMinor(band.feeMinor)) problems.push(`band ${i} must use non-negative integers`);
    if (i > 0 && band.upToMeters <= bands[i - 1].upToMeters) problems.push('bands must be strictly ascending');
  });
  const { thresholdMinor, capMinor } = market.smallOrderSurcharge;
  if (!isMinor(thresholdMinor) || !isMinor(capMinor)) problems.push('small-order surcharge must use non-negative minor units');
  if (problems.length > 0) {
    throw new CommerceRuleError('invalid_market_config', `Invalid market ${market.code}: ${problems.join('; ')}`, { problems });
  }
}
