ALTER TABLE "orders" ADD COLUMN "admin_discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchases" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "purchases" ADD COLUMN "voided_by" BIGINT;

CREATE TABLE "company_profile" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "name" VARCHAR(160) NOT NULL DEFAULT 'Turk-pen',
  "address" VARCHAR(300),
  "tax_number" VARCHAR(80),
  "commercial_register" VARCHAR(80),
  "phone" VARCHAR(30),
  "logo_url" VARCHAR(500),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_profile_pkey" PRIMARY KEY ("id")
);

INSERT INTO "company_profile" ("id", "name", "updated_at") VALUES (1, 'Turk-pen', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
