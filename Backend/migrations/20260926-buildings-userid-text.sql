BEGIN;

ALTER TABLE buildings
    ALTER COLUMN userid TYPE TEXT
        USING userid::text;

COMMIT;