-- Up Migration
CREATE TABLE product_option_groups (
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  id text NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  label_key text NOT NULL CHECK (label_key ~ '^\S{1,200}$'),
  selection text NOT NULL CHECK (selection IN ('single', 'multiple')),
  min_choices integer NOT NULL CHECK (min_choices >= 0),
  max_choices integer NOT NULL CHECK (max_choices >= 1),
  required boolean NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, id),
  CHECK (min_choices <= max_choices),
  CHECK (required = (min_choices >= 1)),
  CHECK (selection = 'multiple' OR max_choices = 1)
);

CREATE TABLE product_options (
  product_id uuid NOT NULL,
  group_id text NOT NULL,
  id text NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  label_key text NOT NULL CHECK (label_key ~ '^\S{1,200}$'),
  price_delta_minor integer NOT NULL,
  availability jsonb NOT NULL DEFAULT '{"status": "in_stock"}'
    CHECK (availability ->> 'status' IN ('in_stock', 'out_of_stock', 'scheduled')),
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, id),
  FOREIGN KEY (product_id, group_id) REFERENCES product_option_groups (product_id, id) ON DELETE CASCADE
);

GRANT SELECT ON product_option_groups, product_options TO tazumo_api;

-- Down Migration
DROP TABLE product_options;
DROP TABLE product_option_groups;
