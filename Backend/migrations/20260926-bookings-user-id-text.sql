BEGIN;

ALTER TABLE bookings
    ALTER COLUMN user_id TYPE TEXT
        USING user_id::text;

COMMIT;