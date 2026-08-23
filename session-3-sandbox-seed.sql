\set ON_ERROR_STOP on

-- PostgreSQL runs this file only when the shared data volume is first created.
-- Keep the SQL practice database separate from Prisma's `eventify` database.
SELECT 'CREATE DATABASE eventify_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eventify_test') \gexec

SELECT 'CREATE DATABASE sandbox'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sandbox') \gexec

\connect sandbox

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ATTENDEE', 'ORGANIZER', 'ADMIN')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  venue text NOT NULL,
  starts_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  organizer_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  event_id uuid NOT NULL REFERENCES events(id),
  status text NOT NULL CHECK (status IN ('CONFIRMED', 'CANCELLED', 'WAITLISTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_event_id_user_id_key UNIQUE (event_id, user_id)
);

-- Deterministic IDs make the seed safe to rerun and make exercises reproducible.
INSERT INTO users (id, email, password_hash, name, role, created_at)
SELECT
  ('10000000-0000-4000-8000-' || lpad(user_number::text, 12, '0'))::uuid,
  'user' || user_number || '@eventify.test',
  '$2b$12$session3.demo.hash.not.for.authentication',
  'User ' || user_number,
  CASE
    WHEN user_number = 1 THEN 'ADMIN'
    WHEN user_number <= 51 THEN 'ORGANIZER'
    ELSE 'ATTENDEE'
  END,
  timestamptz '2025-01-01 09:00:00+00' + (user_number * interval '7 minutes')
FROM generate_series(1, 2000) AS generated(user_number)
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (
  id,
  title,
  description,
  venue,
  starts_at,
  capacity,
  price_cents,
  organizer_id,
  created_at
)
SELECT
  ('20000000-0000-4000-8000-' || lpad(event_number::text, 12, '0'))::uuid,
  CASE
    WHEN event_number = 1 THEN 'TS Conf'
    WHEN event_number = 2 THEN 'Deliberately Oversold A'
    WHEN event_number = 3 THEN 'Deliberately Oversold B'
    ELSE 'Event ' || event_number
  END,
  'Session 3 SQL practice event ' || event_number,
  'Venue ' || (((event_number - 1) % 25) + 1),
  timestamptz '2026-09-01 10:00:00+00' + (event_number * interval '18 hours'),
  CASE WHEN event_number IN (2, 3) THEN 10 ELSE 100 END,
  1000 + ((event_number * 137) % 19000),
  ('10000000-0000-4000-8000-' || lpad((((event_number - 1) % 50) + 2)::text, 12, '0'))::uuid,
  timestamptz '2025-03-01 12:00:00+00' + (event_number * interval '2 hours')
FROM generate_series(1, 220) AS generated(event_number)
ON CONFLICT (id) DO NOTHING;

-- Events 211-220 deliberately receive no bookings. Events 2 and 3 have a
-- capacity of 10 but fifty confirmed bookings each, so HAVING returns
-- real results. Timestamp ordering is realistic enough for practice but is
-- intentionally not a strict causal history.
INSERT INTO bookings (id, user_id, event_id, status, created_at)
SELECT
  ('30000000-0000-4000-8000-' || lpad(booking_number::text, 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || lpad(((((booking_number * 37) + ((booking_number - 1) / 210)) % 2000) + 1)::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(((((booking_number - 1) % 210) + 1))::text, 12, '0'))::uuid,
  CASE
    WHEN booking_number % 20 = 0 THEN 'WAITLISTED'
    WHEN booking_number % 10 = 0 THEN 'CANCELLED'
    ELSE 'CONFIRMED'
  END,
  timestamptz '2025-06-01 08:00:00+00' + (booking_number * interval '11 minutes')
FROM generate_series(1, 10500) AS generated(booking_number)
ON CONFLICT (id) DO NOTHING;

ANALYZE users;
ANALYZE events;
ANALYZE bookings;
