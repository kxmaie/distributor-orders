-- Replaces MySQL ENUMs / UNSIGNED / JSON validation. Apply once, right after the init migration
-- (see README). Safe to keep as a migration file.

ALTER TABLE users ADD CONSTRAINT CK_users_role CHECK (role IN ('distributor','admin','super_admin'));
ALTER TABLE users ADD CONSTRAINT CK_users_discount CHECK (default_discount_pct BETWEEN 0 AND 100);

ALTER TABLE products ADD CONSTRAINT CK_products_unit CHECK (unit IN ('piece','meter','sqm'));
ALTER TABLE products ADD CONSTRAINT CK_products_price CHECK (base_price >= 0);

ALTER TABLE stock_levels ADD CONSTRAINT CK_stock_levels
  CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand);

ALTER TABLE stock_movements ADD CONSTRAINT CK_stock_movements_type
  CHECK (type IN ('receipt','adjustment','reserve','release','ship'));

ALTER TABLE reservations ADD CONSTRAINT CK_reservations_status CHECK (status IN ('active','released','fulfilled'));
ALTER TABLE reservations ADD CONSTRAINT CK_reservations_qty CHECK (qty > 0);

ALTER TABLE orders ADD CONSTRAINT CK_orders_status
  CHECK (status IN ('new','confirmed','in_production','ready','delivered','cancelled'));

ALTER TABLE order_items ADD CONSTRAINT CK_order_items_qty CHECK (qty > 0);
ALTER TABLE order_items ADD CONSTRAINT CK_order_items_discount CHECK (discount_pct BETWEEN 0 AND 100);

ALTER TABLE discounts ADD CONSTRAINT CK_discounts_pct CHECK (pct BETWEEN 0 AND 100);

ALTER TABLE password_requests ADD CONSTRAINT CK_password_requests_status
  CHECK (status IN ('pending','resolved','rejected'));

ALTER TABLE notification_queue ADD CONSTRAINT CK_queue_channel CHECK (channel IN ('whatsapp','in_app'));
ALTER TABLE notification_queue ADD CONSTRAINT CK_queue_status CHECK (status IN ('pending','sent','failed'));
ALTER TABLE notification_queue ADD CONSTRAINT CK_queue_payload_json CHECK (ISJSON(payload) = 1);

ALTER TABLE audit_logs ADD CONSTRAINT CK_audit_meta_json CHECK (meta IS NULL OR ISJSON(meta) = 1);
