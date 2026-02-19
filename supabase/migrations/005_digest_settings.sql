-- Add digest columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN digest_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN digest_city TEXT,
  ADD COLUMN digest_latitude DOUBLE PRECISION,
  ADD COLUMN digest_longitude DOUBLE PRECISION;
