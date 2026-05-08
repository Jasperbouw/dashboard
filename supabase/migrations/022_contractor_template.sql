ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS contract_template TEXT NOT NULL DEFAULT 'standaard';

-- Hollands Prefab uses the split-payment (2,5% + 2,5%) template
UPDATE contractors
SET contract_template = 'hollands-prefab'
WHERE LOWER(name) LIKE '%hollands prefab%';
