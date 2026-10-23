ALTER TABLE "stock_levels"
ADD COLUMN "low_stock_threshold" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in_at" TIMESTAMP(3);
ALTER TABLE "notification_queue" ADD COLUMN "dispatched_at" TIMESTAMP(3);
CREATE INDEX "notification_queue_channel_status_dispatched_at_idx"
ON "notification_queue"("channel", "status", "dispatched_at");

CREATE TABLE "deliveries" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "tracking_number" VARCHAR(100),
    "note" VARCHAR(500),
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_items" (
    "id" BIGSERIAL NOT NULL,
    "delivery_id" BIGINT NOT NULL,
    "order_item_id" BIGINT NOT NULL,
    "qty" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "reference" VARCHAR(100),
    "note" VARCHAR(500),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deliveries_order_id_delivered_at_idx" ON "deliveries"("order_id", "delivered_at");
CREATE INDEX "delivery_items_delivery_id_idx" ON "delivery_items"("delivery_id");
CREATE INDEX "delivery_items_order_item_id_idx" ON "delivery_items"("order_item_id");
CREATE INDEX "payments_user_id_received_at_idx" ON "payments"("user_id", "received_at");

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_fkey"
FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_order_item_id_fkey"
FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Preserve existing delivered orders in the new delivery and account ledgers.
INSERT INTO "deliveries" ("order_id", "note", "delivered_at", "created_at")
SELECT o."id", 'تسليم سابق قبل تفعيل سجل الشحنات', o."updated_at", o."updated_at"
FROM "orders" o
WHERE o."status" = 'delivered';

INSERT INTO "delivery_items" ("delivery_id", "order_item_id", "qty", "amount")
SELECT d."id", oi."id", oi."qty", oi."line_total"
FROM "deliveries" d
JOIN "orders" o ON o."id" = d."order_id"
JOIN "order_items" oi ON oi."order_id" = o."id"
WHERE d."note" = 'تسليم سابق قبل تفعيل سجل الشحنات';
