ALTER TABLE products ADD COLUMN pieces_per_unit INTEGER NOT NULL DEFAULT 1 CHECK (pieces_per_unit > 0);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_status;
UPDATE orders SET status = 'confirmed' WHERE status = 'in_production';
ALTER TABLE orders ADD CONSTRAINT ck_orders_status CHECK (status IN ('new','confirmed','ready','delivered','cancelled'));

ALTER TABLE products DROP CONSTRAINT IF EXISTS ck_products_unit;
CREATE TABLE app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE product_units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(40) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO product_units(name,label) VALUES ('piece','قطعة'),('meter','متر'),('sqm','متر مربع');
INSERT INTO app_settings(key,value) VALUES ('max_order_items','20');

CREATE TABLE purchases (
  id BIGSERIAL PRIMARY KEY,
  invoice_no VARCHAR(60) NOT NULL UNIQUE,
  supplier VARCHAR(160) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  note VARCHAR(500),
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX purchases_created_at_idx ON purchases(created_at);
CREATE TABLE purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL REFERENCES product_variants(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  qty INTEGER NOT NULL CHECK(qty > 0),
  unit_cost DECIMAL(12,2) NOT NULL CHECK(unit_cost >= 0),
  line_total DECIMAL(12,2) NOT NULL CHECK(line_total >= 0)
);
CREATE INDEX purchase_items_variant_id_idx ON purchase_items(variant_id);
CREATE INDEX purchase_items_warehouse_id_idx ON purchase_items(warehouse_id);
ALTER TABLE products ADD CONSTRAINT products_unit_fkey FOREIGN KEY (unit) REFERENCES product_units(name) ON DELETE NO ACTION ON UPDATE CASCADE;
