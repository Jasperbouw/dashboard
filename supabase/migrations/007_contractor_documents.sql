CREATE TABLE IF NOT EXISTS contractor_documents (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id) on delete cascade not null,
  document_type text not null check (document_type in (
    'contract',
    'contract_signed',
    'intake',
    'addendum',
    'other'
  )),
  title text not null,
  file_path text not null,
  file_size_bytes bigint,
  mime_type text,
  uploaded_at timestamptz default now(),
  uploaded_by text default 'jasper',
  notes text,
  status text default 'active' check (status in ('active', 'archived')),
  supersedes_id uuid references contractor_documents(id) on delete set null,
  metadata jsonb default '{}'::jsonb
);

CREATE INDEX idx_contractor_documents_contractor
  ON contractor_documents(contractor_id, uploaded_at DESC);
CREATE INDEX idx_contractor_documents_type
  ON contractor_documents(contractor_id, document_type, status);

ALTER TABLE contractor_documents ENABLE ROW LEVEL SECURITY;
