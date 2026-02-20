-- Supabase schema for products, inputs, inventory, production, and costing

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  description text,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  name text NOT NULL,
  unit text NOT NULL,
  is_critical boolean NOT NULL DEFAULT false,
  reorder_point numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS input_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_id uuid NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  cost_per_unit numeric NOT NULL CHECK (cost_per_unit >= 0),
  currency text NOT NULL DEFAULT 'CLP',
  valid_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  input_id uuid NOT NULL REFERENCES inputs(id),
  quantity_per_unit numeric NOT NULL CHECK (quantity_per_unit >= 0),
  wastage_rate numeric NOT NULL DEFAULT 0 CHECK (wastage_rate >= 0 AND wastage_rate <= 1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, input_id)
);

CREATE TABLE IF NOT EXISTS inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('input', 'product')),
  item_id uuid NOT NULL,
  location_id uuid REFERENCES inventory_locations(id),
  qty numeric NOT NULL CHECK (qty <> 0),
  reason text NOT NULL CHECK (reason IN (
    'purchase',
    'sale',
    'production_consume',
    'adjustment',
    'wastage'
  )),
  reference_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity_produced numeric NOT NULL CHECK (quantity_produced >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS production_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  input_id uuid NOT NULL REFERENCES inputs(id),
  qty_used numeric NOT NULL CHECK (qty_used >= 0),
  qty_wasted numeric NOT NULL CHECK (qty_wasted >= 0)
);

CREATE TABLE IF NOT EXISTS ad_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  social_network text NOT NULL CHECK (social_network IN ('instagram')),
  campaign_start date NOT NULL,
  campaign_end date NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  product_id uuid REFERENCES products(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (campaign_end >= campaign_start)
);

CREATE TABLE IF NOT EXISTS pricing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  computed_material_cost numeric NOT NULL CHECK (computed_material_cost >= 0),
  computed_ad_allocated_cost numeric NOT NULL CHECK (computed_ad_allocated_cost >= 0),
  computed_total_cost numeric NOT NULL CHECK (computed_total_cost >= 0),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_inputs_sku ON inputs (sku);
CREATE INDEX IF NOT EXISTS idx_input_costs_input ON input_costs (input_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_bom_product ON product_bom (product_id);
CREATE INDEX IF NOT EXISTS idx_bom_input ON product_bom (input_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory_movements (item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory_movements (location_id);
CREATE INDEX IF NOT EXISTS idx_batches_product ON production_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_consumptions_batch ON production_consumptions (batch_id);
CREATE INDEX IF NOT EXISTS idx_ad_costs_product ON ad_costs (product_id);
CREATE INDEX IF NOT EXISTS idx_ad_costs_period ON ad_costs (campaign_start, campaign_end);
