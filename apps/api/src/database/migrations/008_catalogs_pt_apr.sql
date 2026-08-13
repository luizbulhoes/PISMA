-- Locais de trabalho (usados em PT, PREA, resíduos)
CREATE TABLE IF NOT EXISTS work_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

CREATE INDEX IF NOT EXISTS idx_work_locations_work ON work_locations(work_id) WHERE active;

-- Categorias Audicamp cadastráveis
CREATE TABLE IF NOT EXISTS audicamp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

-- Categorias / modelos de inspeção (rótulo de categoria)
CREATE TABLE IF NOT EXISTS inspection_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (work_id, code)
);

-- Aprovações de APR: até 4 técnicos + gestor
CREATE TABLE IF NOT EXISTS risk_analysis_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_analysis_id UUID NOT NULL REFERENCES risk_analyses(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN (
    'TECHNICIAN_1','TECHNICIAN_2','TECHNICIAN_3','TECHNICIAN_4','MANAGER'
  )),
  signer_user_id UUID NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  signature_credential_id UUID REFERENCES signature_credentials(id),
  document_hash TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (risk_analysis_id, slot)
);

-- Check-in de técnicos incluídos na PT (gera assinatura digital)
CREATE TABLE IF NOT EXISTS pt_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_id UUID NOT NULL REFERENCES pt_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  signature_credential_id UUID REFERENCES signature_credentials(id),
  document_hash TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pt_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pt_checkins_pt ON pt_checkins(pt_id);
