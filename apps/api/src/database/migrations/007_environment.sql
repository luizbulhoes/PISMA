-- Onda 6 — Meio ambiente: PREA e resíduos + sync offline
CREATE TABLE IF NOT EXISTS environmental_emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  content_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SUBMITTED','PARTIALLY_APPROVED','APPROVED','REJECTED','CLOSED','CANCELLED'
    )),
  tst_approved_by UUID REFERENCES users(id),
  tst_approved_at TIMESTAMPTZ,
  manager_approved_by UUID REFERENCES users(id),
  manager_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, number)
);

CREATE TABLE IF NOT EXISTS waste_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  hazard_class TEXT,
  unit TEXT NOT NULL DEFAULT 'KG' CHECK (unit IN ('KG','L','UN','M3')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE TABLE IF NOT EXISTS waste_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES waste_catalog(id),
  lot_number TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'KG' CHECK (unit IN ('KG','L','UN','M3')),
  origin_area TEXT,
  storage_location TEXT,
  status TEXT NOT NULL DEFAULT 'STORED'
    CHECK (status IN ('STORED','RESERVED','REMOVED','DISPOSED','CANCELLED')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, lot_number)
);

CREATE TABLE IF NOT EXISTS waste_removal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  destination TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SUBMITTED','MANAGER_SIGNED','IN_TRANSIT','DISPOSED','CANCELLED'
    )),
  manager_signed_by UUID REFERENCES users(id),
  manager_signed_at TIMESTAMPTZ,
  disposal_proof_file_id UUID REFERENCES files(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, number)
);

CREATE TABLE IF NOT EXISTS waste_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES waste_removal_requests(id) ON DELETE CASCADE,
  waste_lot_id UUID NOT NULL REFERENCES waste_lots(id),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'KG' CHECK (unit IN ('KG','L','UN','M3')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  client_mutation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  expected_version_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
  payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPLIED','CONFLICT','REJECTED','FAILED')),
  conflict_reason TEXT,
  created_offline_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status
  ON sync_queue_items(user_id, status, created_at DESC);
