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
src/lib/migration-013-email-notification-delivery.sql
src/lib/migration-014-session-room-access.sql
src/lib/migration-015-psychologist-verification.sql
src/lib/migration-016-admin-mfa.sql
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
src/lib/migration-013-email-notification-delivery.sql
src/lib/migration-014-session-room-access.sql
src/lib/migration-015-psychologist-verification.sql
src/lib/migration-016-admin-mfa.sql
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
`migration-013-email-notification-delivery.sql` adds opt-in operational email
preferences and a private delivery queue.
`migration-014-session-room-access.sql` keeps deferred payments explicit,
limits room credentials to the participant and join window, and enforces
role-based session completion in PostgreSQL.
`migration-015-psychologist-verification.sql` stores professional evidence in
a private bucket, limits access to the owner and admins, and blocks profile
approval until at least one document has been approved.
`migration-016-admin-mfa.sql` requires an AAL2 Supabase Auth session for every
database policy and trigger that grants administrator privileges.

The email worker at `api/process-email-notifications.js` also requires these
server-only environment variables before delivery is enabled:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_WORKER_SECRET=
PUBLIC_APP_URL=https://gizlibiriz.vercel.app
```

After the migrations, run `src/lib/verify-rls.sql` in the SQL Editor. The final
block raises an exception if a protected table has RLS disabled or a public
view exposes a private identifier.

The expected role access matrix is documented in `docs/security-model.md`.
Delivery and operating procedures are documented in:

```text
docs/backup-recovery.md
docs/operations-runbook.md
docs/real-device-acceptance.md
docs/release-readiness.md
```

## Admin

Promote a real admin account from Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

Administrators are redirected to `/admin-mfa` after password login. They must
enroll and verify a TOTP authenticator before `/admin` or any administrator RLS
policy becomes available.

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
- Apply `migration-015` before deploying the verification document UI.
- Run the real-device acceptance matrix before the closed pilot.
- Complete a backup restore rehearsal before storing real user data.
- Configure `VITE_SENTRY_DSN` when the production monitoring project is ready.
- Configure payment env keys only when payment implementation begins.
