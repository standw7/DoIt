-- Add auto_assign_enabled to user_settings
ALTER TABLE user_settings ADD COLUMN auto_assign_enabled BOOLEAN NOT NULL DEFAULT true;
