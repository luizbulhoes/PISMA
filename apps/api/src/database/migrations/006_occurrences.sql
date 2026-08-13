-- Onda 5 — Ocorrências RA/RQA (PRD 8B.33)
CREATE TABLE IF NOT EXISTS occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('RA','RQA')),
  display_number TEXT NOT NULL,
  sequence_number INT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  equipment_tag TEXT,
  related_os_number TEXT,
  related_pt_id UUID REFERENCES pt_instances(id),
  initial_description TEXT NOT NULL,
  immediate_consequences TEXT,
  immediate_actions TEXT,
  initial_classification TEXT,
  primary_involved_user_id UUID REFERENCES users(id),
  responsible_tst_user_id UUID REFERENCES users(id),
  responsible_manager_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','COLLECTING_INFO','AWAITING_STATEMENTS','IN_ANALYSIS',
      'CONCLUSION_DRAFT','AWAITING_SIGNATURES','CONCLUDED','REOPENED',
      'CANCELLED','ARCHIVED','AWAITING_DOCUMENTS'
    )),
  cat_applicability TEXT NOT NULL DEFAULT 'UNDER_REVIEW'
    CHECK (cat_applicability IN ('YES','NO','UNDER_REVIEW')),
  cat_number TEXT,
  cat_pdf_file_id UUID REFERENCES files(id),
  cat_pdf_uploaded_by UUID REFERENCES users(id),
  cat_pdf_uploaded_at TIMESTAMPTZ,
  esocial_s2210_status TEXT,
  opened_by UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluded_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  UNIQUE (work_id, display_number),
  UNIQUE (work_id, occurrence_type, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_work ON occurrences(work_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  process_role TEXT NOT NULL
    CHECK (process_role IN (
      'PRIMARY_INVOLVED','WITNESS','OTHER_INVOLVED','TECHNICIAN_DESIGNATED'
    )),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  added_by UUID NOT NULL REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_from_future_collection_at TIMESTAMPTZ,
  removal_reason TEXT
);

CREATE TABLE IF NOT EXISTS occurrence_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES users(id),
  task_type TEXT NOT NULL
    CHECK (task_type IN (
      'INITIAL_STATEMENT','SUPPLEMENTAL_STATEMENT','CLARIFICATION',
      'FINAL_ACKNOWLEDGEMENT','OTHER'
    )),
  instructions TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','DONE','CANCELLED','WAIVED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS occurrence_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  task_id UUID REFERENCES occurrence_tasks(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  statement_number INT NOT NULL,
  statement_type TEXT NOT NULL
    CHECK (statement_type IN ('INITIAL','SUPPLEMENTAL','CLARIFICATION')),
  parent_statement_id UUID REFERENCES occurrence_statements(id),
  content_jsonb JSONB NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  signature_credential_id UUID REFERENCES signature_credentials(id),
  signature_crypto TEXT,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SIGNED')),
  immutable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (occurrence_id, statement_number)
);

CREATE TABLE IF NOT EXISTS occurrence_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_id UUID NOT NULL REFERENCES files(id),
  document_date DATE,
  confidentiality_level TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (confidentiality_level IN ('PUBLIC_INTERNAL','INTERNAL','RESTRICTED','MEDICAL')),
  subject_user_id UUID REFERENCES users(id),
  supersedes_id UUID REFERENCES occurrence_evidence(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUPERSEDED','CANCELLED')),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occurrence_analysis_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  supersedes_id UUID REFERENCES occurrence_analysis_versions(id),
  UNIQUE (occurrence_id, version_number)
);

CREATE TABLE IF NOT EXISTS occurrence_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible_user_id UUID REFERENCES users(id),
  responsible_text TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  evidence_file_id UUID REFERENCES files(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occurrence_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  summary TEXT NOT NULL,
  confirmed_facts TEXT,
  evidence_basis TEXT,
  chronology_basis TEXT,
  contributing_factors TEXT,
  reasoning TEXT,
  conclusion_text TEXT NOT NULL,
  measures_taken TEXT,
  future_actions TEXT,
  open_items TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','AWAITING_SIGNATURES','SIGNED','SUPERSEDED')),
  snapshot_sha256 TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  supersedes_id UUID REFERENCES occurrence_conclusions(id),
  UNIQUE (occurrence_id, version_number)
);

CREATE TABLE IF NOT EXISTS occurrence_conclusion_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conclusion_id UUID NOT NULL REFERENCES occurrence_conclusions(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('TECHNICIAN','TST','MANAGER')),
  signer_user_id UUID NOT NULL REFERENCES users(id),
  signature_credential_id UUID REFERENCES signature_credentials(id),
  signature_crypto TEXT,
  document_hash TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conclusion_id, slot)
);

CREATE TABLE IF NOT EXISTS occurrence_addenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('INFORMATION','EVIDENCE','ADMINISTRATIVE')),
  description TEXT NOT NULL,
  file_id UUID REFERENCES files(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
