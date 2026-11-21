import type { ProductOptions } from './types.ts';

export type SyntheticProductOptions = ProductOptions & { synthetic: true };

/** Synthetic demo options for existing `@tazumo/core` fixture products. Not a real menu or real prices. */
export const syntheticProductOptions: readonly SyntheticProductOptions[] = [
  {
    productId: 'pizza',
    currency: 'EUR',
    synthetic: true,
    groups: [
      {
        id: 'size',
        labelKey: 'options.pizza.size',
        selection: 'single',
        min: 1,
        max: 1,
        required: true,
        options: [
          { id: 'small', labelKey: 'options.pizza.size.small', priceDeltaMinor: -200, available: true },
          { id: 'medium', labelKey: 'options.pizza.size.medium', priceDeltaMinor: 0, available: true, isDefault: true },
          { id: 'large', labelKey: 'options.pizza.size.large', priceDeltaMinor: 350, available: true }
        ]
      },
      {
        id: 'extras',
        labelKey: 'options.pizza.extras',
        selection: 'multiple',
        min: 0,
        max: 3,
        required: false,
        options: [
          { id: 'olives', labelKey: 'options.pizza.extras.olives', priceDeltaMinor: 90, available: true },
          { id: 'mushrooms', labelKey: 'options.pizza.extras.mushrooms', priceDeltaMinor: 90, available: true },
          { id: 'extra-mozzarella', labelKey: 'options.pizza.extras.extraMozzarella', priceDeltaMinor: 150, available: true },
          { id: 'chilli-oil', labelKey: 'options.pizza.extras.chilliOil', priceDeltaMinor: 60, available: true },
          { id: 'truffle', labelKey: 'options.pizza.extras.truffle', priceDeltaMinor: 400, available: false }
        ]
      }
    ]
  },
  {
    productId: 'burger',
    currency: 'EUR',
    synthetic: true,
    groups: [
      {
        id: 'sauce',
        labelKey: 'options.burger.sauce',
        selection: 'single',
        min: 0,
        max: 1,
        required: false,
        options: [
          { id: 'house-sauce', labelKey: 'options.burger.sauce.house', priceDeltaMinor: 0, available: true, isDefault: true },
          { id: 'bbq', labelKey: 'options.burger.sauce.bbq', priceDeltaMinor: 40, available: true },
          { id: 'garlic-mayo', labelKey: 'options.burger.sauce.garlicMayo', priceDeltaMinor: 40, available: true }
        ]
      },
      {
        id: 'toppings',
        labelKey: 'options.burger.toppings',
        selection: 'multiple',
        min: 0,
        max: 2,
        required: false,
        options: [
          { id: 'cheddar', labelKey: 'options.burger.toppings.cheddar', priceDeltaMinor: 100, available: true },
          { id: 'bacon', labelKey: 'options.burger.toppings.bacon', priceDeltaMinor: 180, available: true },
          { id: 'jalapenos', labelKey: 'options.burger.toppings.jalapenos', priceDeltaMinor: 60, available: true }
        ]
      }
    ]
  },
  {
    productId: 'bowl',
    currency: 'EUR',
    synthetic: true,
    groups: [
      {
        id: 'base',
        labelKey: 'options.bowl.base',
        selection: 'single',
        min: 1,
        max: 1,
        required: true,
        options: [
          { id: 'grains', labelKey: 'options.bowl.base.grains', priceDeltaMinor: 0, available: true, isDefault: true },
          { id: 'greens', labelKey: 'options.bowl.base.greens', priceDeltaMinor: 0, available: true }
        ]
      },
      {
        id: 'protein',
        labelKey: 'options.bowl.protein',
        selection: 'single',
        min: 0,
        max: 1,
        required: false,
        options: [
          { id: 'tofu', labelKey: 'options.bowl.protein.tofu', priceDeltaMinor: 250, available: true },
          { id: 'halloumi', labelKey: 'options.bowl.protein.halloumi', priceDeltaMinor: 300, available: true }
        ]
      }
    ]
  }
];

export function syntheticOptionsFor(productId: string): SyntheticProductOptions | undefined {
  return syntheticProductOptions.find((def) => def.productId === productId);
}

export type OptionLabelLanguage = 'en' | 'cs' | 'de';

/** Synthetic display labels for the fixture label keys. */
export const syntheticOptionLabels: Readonly<Record<OptionLabelLanguage, Readonly<Record<string, string>>>> = {
  en: {
    'options.pizza.size': 'Size',
    'options.pizza.size.small': 'Small',
    'options.pizza.size.medium': 'Medium',
    'options.pizza.size.large': 'Large',
    'options.pizza.extras': 'Extras',
    'options.pizza.extras.olives': 'Olives',
    'options.pizza.extras.mushrooms': 'Mushrooms',
    'options.pizza.extras.extraMozzarella': 'Extra mozzarella',
    'options.pizza.extras.chilliOil': 'Chilli oil',
    'options.pizza.extras.truffle': 'Truffle',
    'options.burger.sauce': 'Sauce',
    'options.burger.sauce.house': 'House sauce',
    'options.burger.sauce.bbq': 'BBQ',
    'options.burger.sauce.garlicMayo': 'Garlic mayo',
    'options.burger.toppings': 'Toppings',
    'options.burger.toppings.cheddar': 'Cheddar',
    'options.burger.toppings.bacon': 'Bacon',
    'options.burger.toppings.jalapenos': 'Jalapeños',
    'options.bowl.base': 'Base',
    'options.bowl.base.grains': 'Grains',
    'options.bowl.base.greens': 'Greens',
    'options.bowl.protein': 'Protein',
    'options.bowl.protein.tofu': 'Tofu',
    'options.bowl.protein.halloumi': 'Halloumi'
  },
  cs: {
    'options.pizza.size': 'Velikost',
    'options.pizza.size.small': 'Malá',
    'options.pizza.size.medium': 'Střední',
    'options.pizza.size.large': 'Velká',
    'options.pizza.extras': 'Přísady navíc',
    'options.pizza.extras.olives': 'Olivy',
    'options.pizza.extras.mushrooms': 'Žampiony',
    'options.pizza.extras.extraMozzarella': 'Mozzarella navíc',
    'options.pizza.extras.chilliOil': 'Chilli olej',
    'options.pizza.extras.truffle': 'Lanýž',
    'options.burger.sauce': 'Omáčka',
    'options.burger.sauce.house': 'Domácí omáčka',
    'options.burger.sauce.bbq': 'BBQ',
    'options.burger.sauce.garlicMayo': 'Česneková majonéza',
    'options.burger.toppings': 'Přísady',
    'options.burger.toppings.cheddar': 'Čedar',
    'options.burger.toppings.bacon': 'Slanina',
    'options.burger.toppings.jalapenos': 'Jalapeños',
    'options.bowl.base': 'Základ',
    'options.bowl.base.grains': 'Obiloviny',
    'options.bowl.base.greens': 'Zelený salát',
    'options.bowl.protein': 'Bílkovina',
    'options.bowl.protein.tofu': 'Tofu',
    'options.bowl.protein.halloumi': 'Halloumi'
  },
  de: {
    'options.pizza.size': 'Größe',
    'options.pizza.size.small': 'Klein',
    'options.pizza.size.medium': 'Mittel',
    'options.pizza.size.large': 'Groß',
    'options.pizza.extras': 'Extras',
    'options.pizza.extras.olives': 'Oliven',
    'options.pizza.extras.mushrooms': 'Champignons',
    'options.pizza.extras.extraMozzarella': 'Extra Mozzarella',
    'options.pizza.extras.chilliOil': 'Chiliöl',
    'options.pizza.extras.truffle': 'Trüffel',
    'options.burger.sauce': 'Soße',
    'options.burger.sauce.house': 'Haussoße',
    'options.burger.sauce.bbq': 'BBQ',
    'options.burger.sauce.garlicMayo': 'Knoblauchmayo',
    'options.burger.toppings': 'Beläge',
    'options.burger.toppings.cheddar': 'Cheddar',
    'options.burger.toppings.bacon': 'Speck',
    'options.burger.toppings.jalapenos': 'Jalapeños',
    'options.bowl.base': 'Basis',
    'options.bowl.base.grains': 'Getreide',
    'options.bowl.base.greens': 'Blattsalat',
    'options.bowl.protein': 'Protein',
    'options.bowl.protein.tofu': 'Tofu',
    'options.bowl.protein.halloumi': 'Halloumi'
  }
};

/** Display label for a label key, or the key itself when it has no label. */
export function syntheticOptionLabel(language: OptionLabelLanguage, labelKey: string): string {
  return syntheticOptionLabels[language][labelKey] ?? labelKey;
}
