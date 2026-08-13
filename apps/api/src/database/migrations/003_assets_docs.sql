-- Onda 2 — Equipamentos, checklists e documentos controlados
CREATE TABLE IF NOT EXISTS equipment_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','BLOCKED','INACTIVE','DISPOSED')),
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES users(id),
  next_inspection_at DATE,
  next_calibration_at DATE,
  current_checklist_template_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_equipment_work_tag ON equipment_assets(work_id, tag);

CREATE TABLE IF NOT EXISTS equipment_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL,
  issued_at DATE NOT NULL,
  valid_until DATE,
  issuer TEXT,
  file_id UUID REFERENCES files(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED','CANCELLED')),
  supersedes_id UUID REFERENCES equipment_certificates(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  equipment_category TEXT,
  revision TEXT NOT NULL DEFAULT '01',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code, revision)
);

CREATE TABLE IF NOT EXISTS equipment_checklist_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES equipment_checklist_templates(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'general',
  text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'YES_NO_NA'
    CHECK (answer_type IN ('YES_NO_NA','TEXT','NUMBER','PHOTO')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  blocking_on_no BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (template_id, question_key)
);

ALTER TABLE equipment_assets
  DROP CONSTRAINT IF EXISTS equipment_assets_current_checklist_template_id_fkey;
ALTER TABLE equipment_assets
  ADD CONSTRAINT equipment_assets_current_checklist_template_id_fkey
  FOREIGN KEY (current_checklist_template_id)
  REFERENCES equipment_checklist_templates(id);

CREATE TABLE IF NOT EXISTS equipment_checklist_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  equipment_asset_id UUID NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES equipment_checklist_templates(id),
  technician_user_id UUID NOT NULL REFERENCES users(id),
  pt_id UUID,
  result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','INCOMPLETE')),
  answers_hash TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_runs_equip
  ON equipment_checklist_runs(equipment_asset_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS equipment_checklist_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES equipment_checklist_runs(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  value TEXT CHECK (value IS NULL OR value IN ('YES','NO','NA')),
  comment TEXT,
  evidence_file_id UUID REFERENCES files(id),
  UNIQUE (run_id, question_key)
);

CREATE TABLE IF NOT EXISTS controlled_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  applicability TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','CURRENT','SUPERSEDED','BLOCKED','ARCHIVED')),
  current_version_id UUID,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE TABLE IF NOT EXISTS controlled_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  revision TEXT NOT NULL,
  file_id UUID REFERENCES files(id),
  sha256 TEXT,
  change_summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','CURRENT','SUPERSEDED')),
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, revision)
);

ALTER TABLE controlled_documents
  DROP CONSTRAINT IF EXISTS controlled_documents_current_version_id_fkey;
ALTER TABLE controlled_documents
  ADD CONSTRAINT controlled_documents_current_version_id_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES controlled_document_versions(id);
