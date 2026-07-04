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
```

For an already-created database, run the latest incremental migrations in order:

```text
src/lib/migration-006-rls-hardening.sql
src/lib/migration-007-session-update-hardening.sql
src/lib/migration-008-auth-profile-trigger.sql
```

`migration-008-auth-profile-trigger.sql` keeps profile creation working when Supabase Auth email confirmation is enabled.

## Admin

Promote a real admin account from Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

Demoting or deleting temporary test users:

```text
src/lib/cleanup-test-users.sql
```

## Payment Status

Payment is intentionally deferred. Browser-authenticated users cannot mark sessions as `paid`; that status must be set later by a server-side payment callback using a Supabase service role key.

## Pre-Deploy Checklist

- Run `npm run lint`.
- Run `npm run build`.
- Confirm only real admins have `role = 'admin'`.
- Run `cleanup-test-users.sql` after test rounds.
- Verify Supabase Auth redirect URLs for the production domain.
- Keep email confirmation policy consistent with `migration-008`.
- Configure payment env keys only when payment implementation begins.
