CREATE TABLE IF NOT EXISTS platform_tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  database_url_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_tenants_status_idx ON platform_tenants(status);

CREATE TABLE IF NOT EXISTS platform_admin_audit (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  tenant_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_admin_audit_created_idx ON platform_admin_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS platform_backups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES platform_tenants(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_backups_tenant_created_idx ON platform_backups(tenant_id, created_at DESC);
