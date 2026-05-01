-- Business documents: Meta analyses, meeting agendas, profit sheets, etc.
-- Grouped by month (YYYY-MM). Storage bucket: dashboard-documents (create manually in Supabase Storage).
CREATE TABLE IF NOT EXISTS documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        text        NOT NULL,
  storage_path    text        NOT NULL,
  file_size_bytes bigint,
  mime_type       text,
  month           text        NOT NULL,  -- 'YYYY-MM'
  category        text        NOT NULL DEFAULT 'algemeen',
  title           text,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_by     text
);

CREATE INDEX IF NOT EXISTS idx_documents_month ON documents(month DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
