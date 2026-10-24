CREATE TABLE "purchase_returns" ("id" BIGSERIAL PRIMARY KEY,"purchase_id" BIGINT NOT NULL REFERENCES "purchases"("id"),"return_no" VARCHAR(60) NOT NULL UNIQUE,"supplier" VARCHAR(160) NOT NULL,"total" DECIMAL(12,2) NOT NULL,"note" VARCHAR(500),"created_by" BIGINT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "purchase_return_items" ("id" BIGSERIAL PRIMARY KEY,"return_id" BIGINT NOT NULL REFERENCES "purchase_returns"("id") ON DELETE CASCADE,"purchase_item_id" BIGINT NOT NULL REFERENCES "purchase_items"("id"),"variant_id" BIGINT NOT NULL REFERENCES "product_variants"("id"),"warehouse_id" INTEGER NOT NULL REFERENCES "warehouses"("id"),"qty" INTEGER NOT NULL CHECK ("qty">0),"unit_cost" DECIMAL(12,2) NOT NULL,"line_total" DECIMAL(12,2) NOT NULL);
CREATE INDEX "purchase_return_items_purchase_item_id_idx" ON "purchase_return_items"("purchase_item_id");
CREATE INDEX "purchase_return_items_variant_id_warehouse_id_idx" ON "purchase_return_items"("variant_id","warehouse_id");
CREATE TABLE "sales_returns" ("id" BIGSERIAL PRIMARY KEY,"return_no" VARCHAR(60) NOT NULL UNIQUE,"order_id" BIGINT NOT NULL REFERENCES "orders"("id"),"total" DECIMAL(12,2) NOT NULL,"note" VARCHAR(500),"created_by" BIGINT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "sales_return_items" ("id" BIGSERIAL PRIMARY KEY,"return_id" BIGINT NOT NULL REFERENCES "sales_returns"("id") ON DELETE CASCADE,"order_item_id" BIGINT NOT NULL REFERENCES "order_items"("id"),"variant_id" BIGINT NOT NULL REFERENCES "product_variants"("id"),"warehouse_id" INTEGER NOT NULL REFERENCES "warehouses"("id"),"qty" INTEGER NOT NULL CHECK ("qty">0),"unit_price" DECIMAL(12,2) NOT NULL,"line_total" DECIMAL(12,2) NOT NULL);
CREATE INDEX "sales_return_items_order_item_id_idx" ON "sales_return_items"("order_item_id");
CREATE INDEX "sales_return_items_variant_id_warehouse_id_idx" ON "sales_return_items"("variant_id","warehouse_id");
CREATE INDEX "sales_returns_order_id_created_at_idx" ON "sales_returns"("order_id","created_at");
CREATE TABLE "ledger_accounts" ("id" BIGSERIAL PRIMARY KEY,"code" VARCHAR(30) NOT NULL UNIQUE,"name" VARCHAR(120) NOT NULL,"type" VARCHAR(20) NOT NULL CHECK ("type" IN ('asset','liability','equity','revenue','expense')),"parent_id" BIGINT REFERENCES "ledger_accounts"("id"),"is_active" BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE "journal_vouchers" ("id" BIGSERIAL PRIMARY KEY,"voucher_no" VARCHAR(60) NOT NULL UNIQUE,"type" VARCHAR(20) NOT NULL CHECK ("type" IN ('receipt','payment','journal')),"date" DATE NOT NULL DEFAULT CURRENT_DATE,"description" VARCHAR(500) NOT NULL,"created_by" BIGINT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "journal_entries" ("id" BIGSERIAL PRIMARY KEY,"voucher_id" BIGINT NOT NULL REFERENCES "journal_vouchers"("id") ON DELETE CASCADE,"account_id" BIGINT NOT NULL REFERENCES "ledger_accounts"("id"),"debit" DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK ("debit">=0),"credit" DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK ("credit">=0),"memo" VARCHAR(300),CHECK (("debit"=0) <> ("credit"=0)));
CREATE INDEX "journal_entries_account_id_idx" ON "journal_entries"("account_id");
INSERT INTO "ledger_accounts" (code,name,type) VALUES ('1000','النقدية','asset'),('1100','العملاء','asset'),('1200','المخزون','asset'),('2000','الموردون','liability'),('3000','رأس المال','equity'),('4000','المبيعات','revenue'),('4100','مرتجعات المبيعات','revenue'),('5000','تكلفة البضاعة المباعة','expense'),('5200','مرتجعات المشتريات','expense') ON CONFLICT (code) DO NOTHING;




-- Seed opening journal postings so the new trial balance includes existing active invoices and deliveries.
INSERT INTO "journal_vouchers" ("voucher_no","type","date","description","created_by","created_at")
SELECT 'JV-LEGACY-PUR-'||p."id",'journal',p."created_at"::date,'فاتورة مشتريات '||p."invoice_no",p."created_by",p."created_at"
FROM "purchases" p WHERE p."voided_at" IS NULL ON CONFLICT ("voucher_no") DO NOTHING;
INSERT INTO "journal_entries" ("voucher_id","account_id","debit","credit")
SELECT v."id",a."id",p."total",0 FROM "purchases" p JOIN "journal_vouchers" v ON v."voucher_no"='JV-LEGACY-PUR-'||p."id" JOIN "ledger_accounts" a ON a."code"='1200'
WHERE p."voided_at" IS NULL AND NOT EXISTS (SELECT 1 FROM "journal_entries" e WHERE e."voucher_id"=v."id");
INSERT INTO "journal_entries" ("voucher_id","account_id","debit","credit")
SELECT v."id",a."id",0,p."total" FROM "purchases" p JOIN "journal_vouchers" v ON v."voucher_no"='JV-LEGACY-PUR-'||p."id" JOIN "ledger_accounts" a ON a."code"='2000'
WHERE p."voided_at" IS NULL AND NOT EXISTS (SELECT 1 FROM "journal_entries" e WHERE e."voucher_id"=v."id" AND e."credit">0);
INSERT INTO "journal_vouchers" ("voucher_no","type","date","description","created_by","created_at")
SELECT 'JV-LEGACY-SALE-'||d."id",'journal',d."delivered_at"::date,'فاتورة مبيعات '||o."order_no",COALESCE(d."created_by",0),d."created_at"
FROM "deliveries" d JOIN "orders" o ON o."id"=d."order_id" ON CONFLICT ("voucher_no") DO NOTHING;
INSERT INTO "journal_entries" ("voucher_id","account_id","debit","credit")
SELECT v."id",a."id",SUM(di."amount"),0 FROM "deliveries" d JOIN "delivery_items" di ON di."delivery_id"=d."id" JOIN "journal_vouchers" v ON v."voucher_no"='JV-LEGACY-SALE-'||d."id" JOIN "ledger_accounts" a ON a."code"='1100'
GROUP BY v."id",a."id" HAVING SUM(di."amount")>0 AND NOT EXISTS (SELECT 1 FROM "journal_entries" e WHERE e."voucher_id"=v."id");
INSERT INTO "journal_entries" ("voucher_id","account_id","debit","credit")
SELECT v."id",a."id",0,SUM(di."amount") FROM "deliveries" d JOIN "delivery_items" di ON di."delivery_id"=d."id" JOIN "journal_vouchers" v ON v."voucher_no"='JV-LEGACY-SALE-'||d."id" JOIN "ledger_accounts" a ON a."code"='4000'
GROUP BY v."id",a."id" HAVING SUM(di."amount")>0 AND NOT EXISTS (SELECT 1 FROM "journal_entries" e WHERE e."voucher_id"=v."id" AND e."credit">0);
CREATE INDEX "purchase_returns_created_at_idx" ON "purchase_returns"("created_at");
CREATE INDEX "journal_vouchers_date_idx" ON "journal_vouchers"("date");
