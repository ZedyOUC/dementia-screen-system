-- AD/SCD backend assignment schema for PostgreSQL.
-- Source of fields: backend/src/database/schema.ts.
-- Clinical scoring formulas are intentionally stored as JSONB metadata and
-- are not invented by this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL CHECK (auth_provider IN ('web', 'mini_program', 'seed')),
  open_id TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  role_codes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'pending')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT PRIMARY KEY,
  patient_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  id_number_ciphertext TEXT,
  phone_ciphertext TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
  birth_date DATE,
  education_years INTEGER CHECK (education_years IS NULL OR education_years >= 0),
  profile JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale_configs (
  scale_config_id TEXT PRIMARY KEY,
  scale_code TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('screening', 'cognitive', 'mood', 'sleep', 'function', 'biomarker')
  ),
  source_document TEXT NOT NULL,
  instructions JSONB NOT NULL DEFAULT '[]',
  items JSONB NOT NULL DEFAULT '[]',
  scoring JSONB NOT NULL DEFAULT '{}',
  stimulus_assets JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scale_configs_code_version_unique UNIQUE (scale_code, version)
);

CREATE TABLE IF NOT EXISTS assessment_records (
  assessment_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients (patient_id),
  scale_code TEXT NOT NULL,
  scale_version TEXT NOT NULL,
  assessor_id TEXT NOT NULL REFERENCES users (user_id),
  informant_id TEXT REFERENCES users (user_id),
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'in_progress', 'submitted', 'reviewed', 'void')
  ),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  score_summary JSONB NOT NULL DEFAULT '{}',
  algorithm_version TEXT,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_answers (
  answer_id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessment_records (assessment_id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  answer_status TEXT NOT NULL CHECK (
    answer_status IN ('answered', 'unanswered', 'na', 'unknown', 'refused')
  ),
  observation JSONB NOT NULL DEFAULT '{}',
  recorded_by TEXT NOT NULL REFERENCES users (user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_answers_assessment_item_unique UNIQUE (assessment_id, item_code)
);

CREATE TABLE IF NOT EXISTS files (
  file_id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  related_type TEXT NOT NULL CHECK (
    related_type IN ('scale_config', 'assessment', 'patient', 'report')
  ),
  related_id TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users (user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operation_logs (
  log_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (user_id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patients_name_idx ON patients (name);
CREATE INDEX IF NOT EXISTS scale_configs_status_idx ON scale_configs (status);
CREATE INDEX IF NOT EXISTS assessment_records_patient_created_idx
  ON assessment_records (patient_id, created_at);
CREATE INDEX IF NOT EXISTS assessment_records_assessor_status_idx
  ON assessment_records (assessor_id, status);
CREATE INDEX IF NOT EXISTS files_related_idx ON files (related_type, related_id);
CREATE INDEX IF NOT EXISTS operation_logs_user_created_idx
  ON operation_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS operation_logs_resource_created_idx
  ON operation_logs (resource_type, resource_id, created_at);

COMMIT;
