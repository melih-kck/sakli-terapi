# GizliBiriz

Anonim psikolojik danismanlik platformu. Frontend React + Vite, backend Supabase uzerinde calisir.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the local Supabase values.

Required local env keys:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend env files.
`VITE_SENTRY_DSN` and `VITE_APP_RELEASE` are optional. When a Sentry DSN is
configured, production errors are reported without sending default user PII.

## Quality Checks

Run the same checks used by GitHub Actions:

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm test
npm run build
```

Tests use Vitest, React Testing Library, and jsdom. Pull requests and pushes to
`main` run the full check suite automatically.

## Database Setup

For a fresh Supabase project, run:

```text
src/lib/supabase-complete-setup.sql
src/lib/migration-009-privacy-boundaries.sql
src/lib/migration-010-booking-availability.sql
src/lib/migration-011-session-insert-hardening.sql
src/lib/migration-012-notifications-operations.sql
```

For an already-created database, run the latest incremental migrations in order:

```text
src/lib/migration-006-rls-hardening.sql
src/lib/migration-007-session-update-hardening.sql
src/lib/migration-008-auth-profile-trigger.sql
src/lib/migration-009-privacy-boundaries.sql
src/lib/migration-010-booking-availability.sql
src/lib/migration-011-session-insert-hardening.sql
src/lib/migration-012-notifications-operations.sql
```

`migration-008-auth-profile-trigger.sql` keeps profile creation working when Supabase Auth email confirmation is enabled.
`migration-009-privacy-boundaries.sql` replaces legacy policies, limits public
catalog data to safe views, and protects server-managed role, payment, and
rating fields.
`migration-010-booking-availability.sql` exposes occupied slots only to
authenticated booking participants and enforces one active appointment per
psychologist, date, and time.
`migration-011-session-insert-hardening.sql` derives participant display
fields, price, workflow state, and the private room token inside PostgreSQL
instead of trusting browser input.
`migration-012-notifications-operations.sql` adds private in-app notifications,
review reasons, suspended psychologist accounts, and an admin-only audit log.

After the migrations, run `src/lib/verify-rls.sql` in the SQL Editor. The final
block raises an exception if a protected table has RLS disabled or a public
view exposes a private identifier.

The expected role access matrix is documented in `docs/security-model.md`.

## Admin

Promote a real admin account from Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

## Payment Status

Payment is intentionally deferred. The payment API routes return
`503 payments_disabled`, the production UI does not offer an active payment
button, and browser-authenticated users cannot mark sessions as `paid`.
A future implementation must authenticate the caller, read the canonical
session price from Supabase, and update payment state only after provider-side
verification.

## Pre-Deploy Checklist

- Run `npm run lint`.
- Run `npm run build`.
- Confirm only real admins have `role = 'admin'`.
- Verify Supabase Auth redirect URLs include `/sifre-yenile` for the production domain.
- Keep email confirmation policy consistent with `migration-008`.
- Apply `migration-012` before deploying the notification UI.
- Configure `VITE_SENTRY_DSN` when the production monitoring project is ready.
- Configure payment env keys only when payment implementation begins.
