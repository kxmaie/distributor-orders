-- PostgreSQL CHECK constraints for values enforced by the application types.
ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('distributor','admin','super_admin'));
ALTER TABLE users ADD CONSTRAINT ck_users_discount CHECK (default_discount_pct BETWEEN 0 AND 100);

ALTER TABLE products ADD CONSTRAINT ck_products_unit CHECK (unit IN ('piece','meter','sqm'));
ALTER TABLE products ADD CONSTRAINT ck_products_price CHECK (base_price >= 0);

ALTER TABLE stock_levels ADD CONSTRAINT ck_stock_levels
  CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand);

ALTER TABLE stock_movements ADD CONSTRAINT ck_stock_movements_type
  CHECK (type IN ('receipt','adjustment','reserve','release','ship'));

ALTER TABLE reservations ADD CONSTRAINT ck_reservations_status CHECK (status IN ('active','released','fulfilled'));
ALTER TABLE reservations ADD CONSTRAINT ck_reservations_qty CHECK (qty > 0);

ALTER TABLE orders ADD CONSTRAINT ck_orders_status
  CHECK (status IN ('new','confirmed','in_production','ready','delivered','cancelled'));

ALTER TABLE order_items ADD CONSTRAINT ck_order_items_qty CHECK (qty > 0);
ALTER TABLE order_items ADD CONSTRAINT ck_order_items_discount CHECK (discount_pct BETWEEN 0 AND 100);

ALTER TABLE discounts ADD CONSTRAINT ck_discounts_pct CHECK (pct BETWEEN 0 AND 100);

ALTER TABLE password_requests ADD CONSTRAINT ck_password_requests_status
  CHECK (status IN ('pending','resolved','rejected'));

ALTER TABLE notification_queue ADD CONSTRAINT ck_queue_channel CHECK (channel IN ('whatsapp','in_app'));
ALTER TABLE notification_queue ADD CONSTRAINT ck_queue_status CHECK (status IN ('pending','sent','failed'));
ALTER TABLE notification_queue ADD CONSTRAINT ck_queue_payload_json CHECK (payload::jsonb IS NOT NULL);

ALTER TABLE audit_logs ADD CONSTRAINT ck_audit_meta_json
  CHECK (meta IS NULL OR meta::jsonb IS NOT NULL);
