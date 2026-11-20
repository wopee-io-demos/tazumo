-- Up Migration
CREATE TABLE markets (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{1,64}$'),
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  locale text NOT NULL CHECK (locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalogue_categories (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{1,64}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE merchants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
  market_code text NOT NULL REFERENCES markets (code) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  accepting_orders boolean NOT NULL DEFAULT false,
  delivery_eta_minutes integer CHECK (delivery_eta_minutes >= 0),
  synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchants_market_code_idx ON merchants (market_code);

CREATE TABLE products (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
  merchant_id uuid NOT NULL REFERENCES merchants (id) ON DELETE RESTRICT,
  category_code text NOT NULL REFERENCES catalogue_categories (code) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  available boolean NOT NULL DEFAULT false,
  synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_merchant_id_idx ON products (merchant_id);
CREATE INDEX products_category_code_idx ON products (category_code);

-- Down Migration
DROP TABLE products;
DROP TABLE merchants;
DROP TABLE catalogue_categories;
DROP TABLE markets;
