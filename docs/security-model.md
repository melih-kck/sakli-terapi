# Supabase Security Model

Migration 009 is the canonical authorization boundary for application tables.
Run `src/lib/verify-rls.sql` after applying it to a Supabase project.

## Access Matrix

| Role | Allowed access |
| --- | --- |
| `anon` | Read `public_psychologists` and `public_reviews` only |
| `client` | Read/update own profile, client profile, mood entries, sessions, and reviews |
| `psychologist` | Read/update own profile and application; read/update participant sessions |
| `admin` | Review profiles and applications through admin policies |
| `service_role` | Trusted server operations such as payment status updates |

## Public Projections

`public_psychologists` excludes application-only fields such as
`document_url` and `approval_status`.

`public_reviews` excludes `client_id` and `session_id`. Anonymous reviews
always return a generic alias.

The base `psychologists` and `reviews` tables are not readable by `anon`.

## Server-Managed Fields

Browser-authenticated users cannot change:

- profile roles;
- psychologist approval status or rating aggregates;
- session payment fields, participant IDs, schedule, fee, or room token;
- existing review rows.

The payment callback requires `SUPABASE_SERVICE_ROLE_KEY`. It never falls back
to the browser-safe anonymous key.

## Verification

1. Apply `src/lib/migration-009-privacy-boundaries.sql`.
2. Run `src/lib/verify-rls.sql`.
3. Test with separate client, psychologist, and admin accounts.
4. Confirm anonymous requests can query only the two public views.
5. Confirm the service-role key exists only in server environment variables.
