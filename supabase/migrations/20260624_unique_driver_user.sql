-- Enforce 1:1 mapping: one auth user can only be linked to one driver
-- NULLs are distinct in Postgres so multiple unlinked drivers are allowed
ALTER TABLE drivers ADD CONSTRAINT drivers_user_id_unique UNIQUE (user_id);
