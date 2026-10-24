-- Backfill accounting entries for supplier returns created before return posting was connected to the ledger.
WITH eligible AS (
  SELECT r.id, r.return_no, r.total, r.created_by, r.created_at
  FROM purchase_returns r
  WHERE EXISTS (SELECT 1 FROM ledger_accounts WHERE code = '2000' AND is_active = TRUE)
    AND EXISTS (SELECT 1 FROM ledger_accounts WHERE code = '1200' AND is_active = TRUE)
    AND NOT EXISTS (
      SELECT 1 FROM journal_vouchers v
      WHERE v.description = 'مرتجع مشتريات ' || r.return_no
    )
), inserted AS (
  INSERT INTO journal_vouchers (voucher_no, type, date, description, created_by, created_at)
  SELECT 'JV-PR-BACKFILL-' || id::text, 'journal', created_at::date,
         'مرتجع مشتريات ' || return_no, created_by, created_at
  FROM eligible
  RETURNING id, description
)
INSERT INTO journal_entries (voucher_id, account_id, debit, credit)
SELECT i.id, a.id,
       CASE WHEN a.code = '2000' THEN r.total ELSE 0 END,
       CASE WHEN a.code = '1200' THEN r.total ELSE 0 END
FROM inserted i
JOIN purchase_returns r ON i.description = 'مرتجع مشتريات ' || r.return_no
JOIN ledger_accounts a ON a.code IN ('2000', '1200') AND a.is_active = TRUE;
