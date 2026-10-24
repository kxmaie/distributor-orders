ALTER TABLE users ADD COLUMN registration_rejected_at TIMESTAMP(3);

INSERT INTO product_units(name, label)
VALUES ('carton', 'كرتونة')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, is_active = TRUE;

-- Existing rows with 100 (or any count) attached to "piece" represent a package.
-- Re-label them as cartons while preserving base price, package count, and stock quantities.
UPDATE products
SET unit = 'carton'
WHERE unit = 'piece' AND pieces_per_unit > 1;
