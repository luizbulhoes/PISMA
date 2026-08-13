-- Onda 4 — Prevenção de campo: Audicamp, Inspeções, PAC
CREATE TABLE IF NOT EXISTS corrective_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  origin_type TEXT NOT NULL
    CHECK (origin_type IN ('AUDICAMP','INSPECTION','OCCURRENCE','PT','MANUAL','OTHER')),
  origin_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action TEXT NOT NULL,
  owner_user_id UUID REFERENCES users(id),
  owner_text TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN (
      'OPEN','IN_PROGRESS','EVIDENCE_SUBMITTED','VERIFIED','EXTENDED','CLOSED','CANCELLED'
    )),
  priority TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  verification_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  extension_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE (work_id, number)
);

CREATE TABLE IF NOT EXISTS audicamp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  category_code TEXT NOT NULL,
  subcategory_code TEXT NOT NULL,
  record_type TEXT NOT NULL
    CHECK (record_type IN (
      'DEVIATION','INCIDENT_WITNESSED','GOOD_PRACTICE','ENVIRONMENTAL','IMPROVEMENT'
    )),
  area TEXT NOT NULL,
  team_text TEXT,
  people_observed INT,
  deviations_count INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  risk_imminent BOOLEAN NOT NULL DEFAULT FALSE,
  good_practice BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triage_status TEXT
    CHECK (triage_status IS NULL OR triage_status IN (
      'PENDING','REGISTER_ONLY','GUIDANCE','PAC_SUGGESTED','PAC_REQUIRED','IMMINENT_RISK'
    )),
  suggested_triage TEXT,
  triage_notes TEXT,
  triaged_by UUID REFERENCES users(id),
  triaged_at TIMESTAMPTZ,
  pac_id UUID REFERENCES corrective_action_plans(id),
  UNIQUE (work_id, number)
);

CREATE INDEX IF NOT EXISTS idx_audicamp_work ON audicamp_records(work_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  current_version_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE TABLE IF NOT EXISTS inspection_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUPERSEDED')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version_number)
);

ALTER TABLE inspection_templates
  DROP CONSTRAINT IF EXISTS inspection_templates_current_version_id_fkey;
ALTER TABLE inspection_templates
  ADD CONSTRAINT inspection_templates_current_version_id_fkey
  FOREIGN KEY (current_version_id) REFERENCES inspection_template_versions(id);

CREATE TABLE IF NOT EXISTS inspection_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES inspection_templates(id),
  template_version_id UUID NOT NULL REFERENCES inspection_template_versions(id),
  title TEXT,
  area TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','CLOSED','CANCELLED')),
  created_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspection_instances(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  value_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment TEXT,
  evidence_file_id UUID REFERENCES files(id),
  UNIQUE (inspection_id, question_key)
);
