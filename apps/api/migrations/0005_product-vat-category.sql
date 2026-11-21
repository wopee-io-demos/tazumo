-- Up Migration
ALTER TABLE products ADD COLUMN vat_category text
  CHECK (vat_category IN ('food', 'groceries', 'flowers', 'gifts', 'electronics'));
UPDATE products SET vat_category = CASE category_code
  WHEN 'food' THEN 'food'
  WHEN 'groceries' THEN 'groceries'
  ELSE 'gifts'
END;
ALTER TABLE products ALTER COLUMN vat_category SET NOT NULL;
ALTER TABLE products ADD COLUMN vat_rate_id text CHECK (vat_rate_id ~ '^[a-z0-9_-]{1,32}$');

-- Down Migration
ALTER TABLE products DROP COLUMN vat_rate_id;
ALTER TABLE products DROP COLUMN vat_category;
