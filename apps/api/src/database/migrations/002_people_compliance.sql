-- Onda 1 — Pessoas e conformidade
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS corporate_phone TEXT,
  ADD COLUMN IF NOT EXISTS corporate_email TEXT,
  ADD COLUMN IF NOT EXISTS profile_validation_status TEXT
    DEFAULT 'NOT_REQUIRED'
    CHECK (profile_validation_status IN ('NOT_REQUIRED','PENDING_VALIDATION','VALIDATED','REJECTED'));

CREATE TABLE IF NOT EXISTS employee_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  technician_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  completed_at DATE NOT NULL,
  validity_value INT,
  validity_unit TEXT CHECK (validity_unit IS NULL OR validity_unit IN ('DAYS','MONTHS','YEARS')),
  valid_until DATE,
  notes TEXT,
  certificate_file_id UUID REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED','CANCELLED')),
  supersedes_id UUID REFERENCES employee_trainings(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_trainings_tech ON employee_trainings(work_id, technician_user_id, status);

CREATE TABLE IF NOT EXISTS employee_aso_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  technician_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aso_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  administrative_notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED','CANCELLED')),
  supersedes_id UUID REFERENCES employee_aso_records(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_aso_tech ON employee_aso_records(work_id, technician_user_id, status);

CREATE TABLE IF NOT EXISTS ppe_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  technician_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT 'INITIAL'
    CHECK (reason IN ('INITIAL','EXCHANGE','REPLACEMENT','LOSS','DAMAGE','OTHER')),
  notes TEXT,
  old_photo_file_id UUID REFERENCES files(id),
  new_photo_file_id UUID REFERENCES files(id),
  returned_condition TEXT,
  old_item_destination TEXT,
  term_status TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE'
    CHECK (term_status IN ('PENDING_SIGNATURE','SIGNED','CANCELLED','SUPERSEDED')),
  term_file_id UUID REFERENCES files(id),
  term_document_hash TEXT,
  term_signed_at TIMESTAMPTZ,
  term_signature_credential_id UUID REFERENCES signature_credentials(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED','CANCELLED')),
  supersedes_id UUID REFERENCES ppe_deliveries(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS ppe_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ppe_delivery_id UUID NOT NULL REFERENCES ppe_deliveries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ca_number TEXT NOT NULL,
  size_value TEXT,
  quantity INT DEFAULT 1,
  manufacturer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppe_tech ON ppe_deliveries(work_id, technician_user_id, status);

CREATE TABLE IF NOT EXISTS competency_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job_function TEXT,
  activity_nature TEXT,
  equipment_class TEXT,
  requirement_type TEXT NOT NULL
    CHECK (requirement_type IN ('TRAINING','ASO','AUTHORIZATION','DOCUMENT','OPERATIONAL_BLOCK')),
  requirement_key TEXT NOT NULL,
  blocking BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competency_work ON competency_rules(work_id) WHERE active;

CREATE TABLE IF NOT EXISTS technician_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  technician_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('SIGN_PPE_TERM','OTHER')),
  reference_type TEXT,
  reference_id UUID,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tech_tasks_open ON technician_tasks(technician_user_id, status);
