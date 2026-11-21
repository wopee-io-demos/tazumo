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
