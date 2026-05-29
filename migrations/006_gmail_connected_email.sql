-- Add connected_email column to integration_tokens so each provider row
-- can record the email address of the authorized account (e.g. Gmail address).
ALTER TABLE integration_tokens ADD COLUMN IF NOT EXISTS connected_email VARCHAR;
