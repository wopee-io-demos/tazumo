import { isAvailableAt, type Availability } from '@tazumo/merchant-ops';
import type { Option, OptionGroup, SelectionMode } from '@tazumo/product-options';
import type pg from 'pg';

type OptionRow = {
  productId: string;
  groupId: string;
  groupLabelKey: string;
  selection: SelectionMode;
  min: number;
  max: number;
  required: boolean;
  optionId: string | null;
  labelKey: string | null;
  priceDeltaMinor: number | null;
  availability: Availability | null;
  isDefault: boolean | null;
};

type Group = OptionGroup & { options: Option[] };

/** Option groups per product, with each option's availability resolved at `at`. Products without groups are absent. */
export async function loadOptionGroups(pool: pg.Pool, productIds: string[], at: Date = new Date()): Promise<Map<string, OptionGroup[]>> {
  const { rows } = await pool.query<OptionRow>(
    `SELECT g.product_id AS "productId", g.id AS "groupId", g.label_key AS "groupLabelKey", g.selection,
            g.min_choices AS min, g.max_choices AS max, g.required,
            o.id AS "optionId", o.label_key AS "labelKey", o.price_delta_minor AS "priceDeltaMinor", o.availability,
            o.is_default AS "isDefault"
       FROM product_option_groups g
       LEFT JOIN product_options o ON o.product_id = g.product_id AND o.group_id = g.id
      WHERE g.product_id = ANY($1::uuid[])
      ORDER BY g.product_id, g.sort_order, g.id, o.sort_order, o.id`,
    [productIds]
  );
  const byProduct = new Map<string, Group[]>();
  for (const row of rows) {
    const groups = byProduct.get(row.productId) ?? [];
    byProduct.set(row.productId, groups);
    let group = groups.at(-1);
    if (!group || group.id !== row.groupId) {
      group = { id: row.groupId, labelKey: row.groupLabelKey, selection: row.selection, min: row.min, max: row.max, required: row.required, options: [] };
      groups.push(group);
    }
    if (row.optionId === null) continue;
    group.options.push({
      id: row.optionId,
      labelKey: row.labelKey!,
      priceDeltaMinor: row.priceDeltaMinor!,
      available: isAvailableAt(row.availability!, at),
      isDefault: row.isDefault!
    });
  }
  return byProduct;
}
