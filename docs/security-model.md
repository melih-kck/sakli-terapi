# Supabase Security Model

Migrations 009 through 016 are the canonical authorization boundary for
application tables. Run `src/lib/verify-rls.sql` after applying them to a
Supabase project.

## Access Matrix

| Role | Allowed access |
| --- | --- |
| `anon` | Read `public_psychologists` and `public_reviews` only |
| `client` | Read/update own profile, client profile, mood entries, permitted session fields, reviews, and notifications |
| `psychologist` | Read/update own profile and application; upload/read own private verification documents; read participant sessions, complete/cancel permitted sessions, and read own notifications |
| `admin` | With an AAL2 session, review profiles, applications, and private verification documents; read the admin audit log and own notifications |
| `service_role` | Process the private operational-email outbox and perform trusted maintenance |

## Public Projections

`public_psychologists` excludes application-only fields such as
`document_url` and `approval_status`.

`public_reviews` excludes `client_id` and `session_id`. Anonymous reviews
always return a generic alias.

The base `psychologists` and `reviews` tables are not readable by `anon`.

`psychologist-documents` is a private Storage bucket. Objects are addressed by
the owning psychologist UUID, restricted to PDF/JPEG/PNG and 8 MB, and opened
only through short-lived signed URLs. Document metadata is protected by RLS.

## Server-Managed Fields

Browser-authenticated users cannot change:

- profile roles;
- psychologist approval status or rating aggregates;
- session payment fields, participant IDs, schedule, fee, or room credentials;
- existing review rows.

Notification rows can only be created by trusted database triggers. Users can
read their own rows and update only the `read_at` column. The admin audit log is
append-only from trigger functions and visible only to admins.

Migration 016 changes the shared private admin predicate so both the `admin`
profile role and an `aal2` JWT claim are required. The frontend redirects AAL1
admin sessions to TOTP enrollment or challenge, while PostgreSQL independently
denies admin policies and review triggers until the second factor is verified.

Psychologists can delete pending or rejected documents, but cannot delete an
approved document. A profile cannot become `approved` without an approved
document, and its last approved document cannot be rejected while the profile
remains active.

Migration 011 also derives session aliases, psychologist display fields, fee,
initial workflow state, and room token in PostgreSQL. The browser supplies only
the target psychologist, schedule, and requested channel.

Migration 014 removes all room credentials from ordinary session reads. During
the 15-minute-early to 90-minute-late join window, an authenticated participant
can request only their own and the other participant's random PeerJS IDs through
`get_session_room_access`. Clients can cancel sessions; only the assigned
psychologist can complete one after its scheduled start.

`payment_required=false` records the current deferred-payment phase without
marking a session as paid. If payment is enabled later, server-created sessions
can require a provider-confirmed `paid` status before room access.

Payment endpoints are disabled until a provider-authenticated server flow is
implemented. The existing service-role key is used only by the server-side,
secret-protected operational-email worker and must never be exposed to Vite.

## Verification

1. Apply migrations 009 through 016 in order.
2. Run `src/lib/verify-rls.sql`.
3. Test with separate client, psychologist, and admin accounts.
4. Confirm anonymous requests can query only the two public views.
5. Confirm the service-role key exists only in server environment variables.
6. Confirm ordinary participant queries cannot select any room credential
   column and `anon` cannot execute `get_session_room_access`.
7. Confirm an AAL1 admin session cannot read the audit log or verification
   documents, and the same session succeeds only after reaching AAL2.
