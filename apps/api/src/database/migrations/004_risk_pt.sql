-- Onda 3 — Riscos (APR/PGR) e Permissão de Trabalho
CREATE TABLE IF NOT EXISTS risk_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('BASE_AR','TASK_APR')),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  activity TEXT NOT NULL,
  area_id TEXT,
  process_id TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  current_version_id UUID,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','ARCHIVED')),
  derived_from_id UUID REFERENCES risk_analyses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE TABLE IF NOT EXISTS risk_analysis_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_analysis_id UUID NOT NULL REFERENCES risk_analyses(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  matrix_version_id TEXT,
  content_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  sha256 TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (risk_analysis_id, version_number)
);

ALTER TABLE risk_analyses
  DROP CONSTRAINT IF EXISTS risk_analyses_current_version_id_fkey;
ALTER TABLE risk_analyses
  ADD CONSTRAINT risk_analyses_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES risk_analysis_versions(id);

CREATE TABLE IF NOT EXISTS risk_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  hazard_group TEXT NOT NULL,
  hazard_description TEXT NOT NULL,
  consequences TEXT,
  exposure_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  controls_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  assessment_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE TABLE IF NOT EXISTS risk_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL,
  risk_kind TEXT NOT NULL DEFAULT 'ANALYSIS'
    CHECK (risk_kind IN ('ANALYSIS','INVENTORY')),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'RELATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_links_source ON risk_links(source_type, source_id);

CREATE TABLE IF NOT EXISTS pt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  revision TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_validity_hours INT NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code, revision)
);

CREATE TABLE IF NOT EXISTS pt_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  os_number TEXT NOT NULL,
  issue_number INT NOT NULL DEFAULT 1,
  template_id UUID REFERENCES pt_templates(id),
  current_version_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT','SUBMITTED','PARTIALLY_APPROVED','APPROVED','REJECTED',
      'EDIT_AUTHORIZED','IN_EXECUTION','SUSPENDED','CLOSED','CANCELLED'
    )),
  edit_count INT NOT NULL DEFAULT 0 CHECK (edit_count >= 0 AND edit_count <= 1),
  max_validity_hours INT NOT NULL DEFAULT 12,
  valid_until TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  reissued_from_pt_id UUID REFERENCES pt_instances(id),
  risk_analysis_id UUID REFERENCES risk_analyses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, os_number, issue_number)
);

CREATE INDEX IF NOT EXISTS idx_pt_work_status ON pt_instances(work_id, status);
CREATE INDEX IF NOT EXISTS idx_pt_os ON pt_instances(work_id, os_number);

CREATE TABLE IF NOT EXISTS pt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_id UUID NOT NULL REFERENCES pt_instances(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  template_id UUID REFERENCES pt_templates(id),
  source_version_id UUID REFERENCES pt_versions(id),
  answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','SUPERSEDED','ACTIVE','CANCELLED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (pt_id, version_number)
);

ALTER TABLE pt_instances
  DROP CONSTRAINT IF EXISTS pt_instances_current_version_id_fkey;
ALTER TABLE pt_instances
  ADD CONSTRAINT pt_instances_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES pt_versions(id);

ALTER TABLE equipment_checklist_runs
  DROP CONSTRAINT IF EXISTS equipment_checklist_runs_pt_id_fkey;
ALTER TABLE equipment_checklist_runs
  ADD CONSTRAINT equipment_checklist_runs_pt_id_fkey
  FOREIGN KEY (pt_id) REFERENCES pt_instances(id);

CREATE TABLE IF NOT EXISTS pt_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_version_id UUID NOT NULL REFERENCES pt_versions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('TST','SUPERVISOR')),
  signer_user_id UUID NOT NULL REFERENCES users(id),
  signer_role_used TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  reason TEXT,
  signature_credential_id UUID REFERENCES signature_credentials(id),
  signature_crypto TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_hash TEXT,
  operationally_valid BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_approvals_slot_valid
  ON pt_approvals(pt_version_id, slot)
  WHERE operationally_valid;

CREATE TABLE IF NOT EXISTS pt_edit_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_id UUID NOT NULL REFERENCES pt_instances(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  tst_decision TEXT CHECK (tst_decision IS NULL OR tst_decision IN ('APPROVED','REJECTED')),
  tst_decided_by UUID REFERENCES users(id),
  tst_decided_at TIMESTAMPTZ,
  supervisor_decision TEXT
    CHECK (supervisor_decision IS NULL OR supervisor_decision IN ('APPROVED','REJECTED')),
  supervisor_decided_by UUID REFERENCES users(id),
  supervisor_decided_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','AUTHORIZED','REJECTED','CONSUMED','CANCELLED')),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pt_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_version_id UUID NOT NULL REFERENCES pt_versions(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  description TEXT NOT NULL,
  action TEXT,
  responsible TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','VERIFIED','CANCELLED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  evidence_file_id UUID REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS pt_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_version_id UUID NOT NULL REFERENCES pt_versions(id) ON DELETE CASCADE,
  linked_user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  job_function TEXT,
  employee_number TEXT,
  employer TEXT,
  acknowledgement_method TEXT
    CHECK (acknowledgement_method IS NULL OR acknowledgement_method IN (
      'DIGITAL','HANDWRITTEN_ATTACHMENT','NOT_REQUIRED'
    )),
  acknowledgement_signature_file_id UUID REFERENCES files(id),
  acknowledged_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pt_equipment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_version_id UUID NOT NULL REFERENCES pt_versions(id) ON DELETE CASCADE,
  equipment_asset_id UUID NOT NULL REFERENCES equipment_assets(id),
  checklist_run_id UUID REFERENCES equipment_checklist_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pt_version_id, equipment_asset_id)
);
