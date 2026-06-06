-- Link drivers table to auth users so a driver can log in and see their own deliveries
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON drivers(user_id);
