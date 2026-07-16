import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

const migration = readSource('./migration-009-privacy-boundaries.sql');
const bookingMigration = readSource('./migration-010-booking-availability.sql');
const sessionInsertMigration = readSource('./migration-011-session-insert-hardening.sql');
const operationsMigration = readSource('./migration-012-notifications-operations.sql');
const emailDeliveryMigration = readSource('./migration-013-email-notification-delivery.sql');
const sessionRoomMigration = readSource('./migration-014-session-room-access.sql');
const verificationMigration = readSource('./migration-015-psychologist-verification.sql');
const adminMfaMigration = readSource('./migration-016-admin-mfa.sql');
const verificationQuery = readSource('./verify-rls.sql');
const verificationDocuments = readSource('./verification-documents.js');
const adminQueries = readSource('./admin.js');
const psychologistQueries = readSource('./psychologists.js');
const reviewQueries = readSource('../context/ReviewContext.jsx');
const sessionContext = readSource('../context/SessionContext.jsx');
const profileContext = readSource('../context/ProfileContext.jsx');
const supportPages = readSource('../pages/SupportPages.jsx');
const createPayment = readSource('../../api/create-payment.js');
const paymentCallback = readSource('../../api/payment-callback.js');
const notificationContext = readSource('../context/NotificationContext.jsx');
const monitoring = readSource('./monitoring.js');
const appRoutes = readSource('../App.jsx');
const authContext = readSource('../context/AuthContext.jsx');

describe('Supabase privacy boundaries', () => {
  it('removes legacy policies before recreating the canonical policy set', () => {
    expect(migration).toContain('FROM pg_policies');
    expect(migration).toContain('DROP POLICY IF EXISTS %I ON public.%I');
    expect(migration).toContain('TO authenticated');
  });

  it('keeps private identifiers out of the public review projection', () => {
    const publicReviewView = migration.match(
      /CREATE VIEW public\.public_reviews[\s\S]*?FROM public\.reviews/,
    )?.[0];

    expect(publicReviewView).toBeTruthy();
    expect(publicReviewView).not.toMatch(/\breviews\.client_id\b/);
    expect(publicReviewView).not.toMatch(/\breviews\.session_id\b/);
  });

  it('keeps application-only psychologist fields out of the public view', () => {
    const publicPsychologistView = migration.match(
      /CREATE VIEW public\.public_psychologists[\s\S]*?FROM public\.psychologists/,
    )?.[0];

    expect(publicPsychologistView).toBeTruthy();
    expect(publicPsychologistView).not.toMatch(/\bdocument_url\b/);
    expect(publicPsychologistView).not.toMatch(/\bapproval_status\b/);
  });

  it('binds reviews to the completed paid session and its psychologist', () => {
    expect(migration).toContain('sessions.psychologist_id = psychologist_id');
    expect(migration).toContain("sessions.payment_status = 'paid'");
    expect(migration).toContain('sessions.reviewed = false');
    expect(migration).toContain('sessions.channel = reviews.channel');
  });

  it('prevents anonymous access to base tables and public helper functions', () => {
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.reviews FROM anon',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.is_admin_user()',
    );
  });

  it('requires an AAL2 session for every database-level admin check', () => {
    expect(adminMfaMigration).toContain('CREATE OR REPLACE FUNCTION private.is_admin_user()');
    expect(adminMfaMigration).toContain("auth.jwt() ->> 'aal'");
    expect(adminMfaMigration).toContain("= 'aal2'");
    expect(adminMfaMigration).toContain("role = 'admin'");
    expect(appRoutes).toContain('path="/admin-mfa"');
    expect(appRoutes).toContain('!mfaStatus.verified');
    expect(authContext).toContain('readAdminMfaStatus(supabase.auth, role)');
    expect(verificationQuery).toContain("pg_catalog.strpos(");
    expect(verificationQuery).toContain("'aal2'");
  });

  it('uses safe public views for unauthenticated catalog reads', () => {
    expect(psychologistQueries).toContain(".from('public_psychologists')");
    expect(reviewQueries).toContain(".from('public_reviews')");
  });

  it('keeps incomplete payment endpoints explicitly disabled', () => {
    expect(createPayment).toContain("code: 'payments_disabled'");
    expect(paymentCallback).toContain("code: 'payments_disabled'");
    expect(createPayment).toContain('status(503)');
    expect(paymentCallback).toContain('status(503)');
    expect(createPayment).not.toContain('Iyzipay');
    expect(paymentCallback).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('keeps occupied-slot lookup authenticated and free of client identifiers', () => {
    const bookedSlotsFunction = bookingMigration.match(
      /CREATE OR REPLACE FUNCTION public\.get_booked_slots[\s\S]*?REVOKE ALL ON FUNCTION/,
    )?.[0];

    expect(bookedSlotsFunction).toBeTruthy();
    expect(bookedSlotsFunction).not.toMatch(/\bclient_id\b/);
    expect(bookingMigration).toContain(
      'REVOKE ALL ON FUNCTION public.get_booked_slots(uuid, date, date)',
    );
    expect(bookingMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_booked_slots(uuid, date, date)',
    );
  });

  it('enforces one active appointment for each psychologist slot', () => {
    expect(bookingMigration).toContain('idx_sessions_unique_active_slot');
    expect(bookingMigration).toContain(
      'ON public.sessions(psychologist_id, scheduled_date, scheduled_time)',
    );
    expect(bookingMigration).toContain("WHERE status <> 'cancelled'");
    expect(bookingMigration).toContain("scheduled_time::time");
    expect(bookingMigration).toContain("timezone('Europe/Istanbul', now())");
  });

  it('derives sensitive booking fields and room credentials in PostgreSQL', () => {
    expect(sessionInsertMigration).toContain('private.prepare_session_insert()');
    expect(sessionInsertMigration).toContain('NEW.client_id := actor_id');
    expect(sessionInsertMigration).toContain('NEW.fee := GREATEST');
    expect(sessionInsertMigration).toContain("NEW.payment_status := 'pending'");
    expect(sessionInsertMigration).toContain('NEW.peer_room_token := pg_catalog.gen_random_uuid()');
    expect(sessionInsertMigration).toContain("psychologists.approval_status = 'approved'");
  });

  it('keeps deferred payments explicit without marking sessions as paid', () => {
    expect(sessionRoomMigration).toContain('payment_required boolean NOT NULL DEFAULT false');
    expect(sessionRoomMigration).toContain('NEW.payment_required := false');
    expect(sessionRoomMigration).toContain('NOT sessions.payment_required');
    expect(sessionRoomMigration).not.toContain("NEW.payment_status := 'paid'");
  });

  it('exposes room identities only through a participant and time limited RPC', () => {
    expect(sessionRoomMigration).toContain('public.get_session_room_access');
    expect(sessionRoomMigration).toContain('actor_id IN (sessions.client_id, sessions.psychologist_id)');
    expect(sessionRoomMigration).toContain("INTERVAL '15 minutes'");
    expect(sessionRoomMigration).toContain("INTERVAL '90 minutes'");
    expect(sessionRoomMigration).toContain('REVOKE SELECT ON TABLE public.sessions FROM authenticated');
    expect(sessionRoomMigration).toContain('client_peer_token');
    expect(sessionRoomMigration).toContain('psychologist_peer_token');
    expect(sessionContext).not.toContain(".select('*')");
    expect(sessionContext).not.toContain('peer_room_token');
  });

  it('limits session completion to the psychologist after the scheduled start', () => {
    expect(sessionRoomMigration).toContain('only the psychologist can complete a session');
    expect(sessionRoomMigration).toContain('a session cannot be completed before its scheduled start');
    expect(sessionRoomMigration).toContain('clients can only cancel an upcoming session');
  });

  it('derives review identity and aggregate rating in PostgreSQL', () => {
    expect(sessionInsertMigration).toContain('private.prepare_review_insert()');
    expect(sessionInsertMigration).toContain('NEW.client_id := actor_id');
    expect(sessionInsertMigration).toContain('NEW.psychologist_id := session_psychologist_id');
    expect(sessionInsertMigration).toContain("WHEN NEW.anonymous THEN 'Anonim Danisan'");
    expect(sessionInsertMigration).toContain('NEW.rating := ROUND');
    expect(sessionInsertMigration).toContain('NEW.comment := LEFT');
  });

  it('sends only user-selectable booking fields from the browser', () => {
    const realInsertBlock = sessionContext.match(
      /\/\/ Real Supabase insert[\s\S]*?try \{/,
    )?.[0];

    expect(realInsertBlock).toBeTruthy();
    expect(realInsertBlock).toContain('psychologist_id');
    expect(realInsertBlock).toContain('scheduled_date');
    expect(realInsertBlock).toContain('scheduled_time');
    expect(realInsertBlock).toContain('channel');
    expect(realInsertBlock).not.toContain('client_id');
    expect(realInsertBlock).not.toContain('payment_status');
    expect(realInsertBlock).not.toContain('fee:');
    expect(realInsertBlock).not.toContain('peer_room_token');
  });

  it('requires current-password verification for in-session password changes', () => {
    expect(profileContext).toContain('supabase.auth.signInWithPassword');
    expect(profileContext).toContain('password: currentPassword');
  });

  it('provides a complete password recovery destination', () => {
    expect(supportPages).toContain("redirectTo: getAuthRedirectUrl('/sifre-yenile')");
    expect(supportPages).toContain("event === 'PASSWORD_RECOVERY'");
    expect(supportPages).toContain('supabase.auth.updateUser({ password })');
  });

  it('keeps demo psychologist data development-only', () => {
    expect(psychologistQueries).toContain('import.meta.env.DEV');
  });

  it('keeps notifications private and limits users to read-state updates', () => {
    expect(operationsMigration).toContain('ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY');
    expect(operationsMigration).toContain('(SELECT auth.uid()) = user_id');
    expect(operationsMigration).toContain('GRANT UPDATE (read_at) ON TABLE public.notifications');
    expect(operationsMigration).toContain('REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated');
    expect(notificationContext).toContain("filter: `user_id=eq.${userId}`");
  });

  it('records admin review actions and requires reasons for negative decisions', () => {
    expect(operationsMigration).toContain("NEW.approval_status IN ('rejected', 'suspended')");
    expect(operationsMigration).toContain('a review reason is required');
    expect(operationsMigration).toContain('INSERT INTO public.admin_audit_log');
    expect(operationsMigration).toContain('USING ((SELECT private.is_admin_user()))');
  });

  it('uses the psychologist owner relationship in admin profile queries', () => {
    expect(adminQueries).toContain('profiles!psychologists_id_fkey(email, role)');
    expect(adminQueries).not.toContain('profiles!inner(email, role)');
  });

  it('keeps operational email opt-in and the delivery queue server-only', () => {
    expect(emailDeliveryMigration).toContain('email_session_updates boolean NOT NULL DEFAULT false');
    expect(emailDeliveryMigration).toContain('ALTER TABLE public.email_notification_outbox ENABLE ROW LEVEL SECURITY');
    expect(emailDeliveryMigration).toContain('REVOKE ALL ON TABLE public.email_notification_outbox FROM PUBLIC, anon, authenticated');
    expect(emailDeliveryMigration).toContain('FOR UPDATE SKIP LOCKED');
    expect(emailDeliveryMigration).toContain('TO service_role');
  });

  it('keeps production monitoring optional and disables default PII', () => {
    expect(monitoring).toContain('VITE_SENTRY_DSN');
    expect(monitoring).toContain('sendDefaultPii: false');
    expect(monitoring).toContain('delete sanitized.user');
  });

  it('stores psychologist verification files in a private restricted bucket', () => {
    expect(verificationMigration).toContain("'psychologist-documents'");
    expect(verificationMigration).toContain('public = false');
    expect(verificationMigration).toContain('8388608');
    expect(verificationMigration).toContain("'application/pdf', 'image/jpeg', 'image/png'");
    expect(verificationDocuments).not.toContain('getPublicUrl');
    expect(verificationDocuments).toContain('createSignedUrl(storagePath, 120)');
  });

  it('limits verification document rows to their owner and administrators', () => {
    expect(verificationMigration).toContain('ALTER TABLE public.psychologist_verification_documents ENABLE ROW LEVEL SECURITY');
    expect(verificationMigration).toContain('verification_documents_select_owner');
    expect(verificationMigration).toContain('verification_documents_select_admin');
    expect(verificationMigration).toContain("private.has_profile_role('psychologist')");
    expect(verificationMigration).toContain('GRANT UPDATE (status, review_reason)');
    expect(verificationMigration).toContain('status <> \'approved\'');
    expect(verificationMigration).not.toContain('CREATE POLICY "verification_documents_delete_admin"');
  });

  it('binds private storage paths to the authenticated psychologist', () => {
    expect(verificationMigration).toContain('(storage.foldername(name))[1] = (SELECT auth.uid())::text');
    expect(verificationMigration).toContain('psychologist_documents_storage_insert_owner');
    expect(verificationMigration).toContain('psychologist_documents_storage_select_admin');
    expect(verificationMigration).toContain('documents.storage_path = name');
    expect(verificationMigration).not.toContain('CREATE POLICY "psychologist_documents_storage_delete_admin"');
  });

  it('requires approved evidence before activating a psychologist profile', () => {
    expect(verificationMigration).toContain("NEW.approval_status = 'approved'");
    expect(verificationMigration).toContain("documents.status = 'approved'");
    expect(verificationMigration).toContain('at least one approved verification document is required');
    expect(verificationMigration).toContain('an approved profile must retain an approved document');
  });

  it('audits document review decisions and notifies the psychologist', () => {
    expect(verificationMigration).toContain("'verification_document_' || NEW.status");
    expect(verificationMigration).toContain('INSERT INTO public.admin_audit_log');
    expect(verificationMigration).toContain('PERFORM private.create_notification');
    expect(verificationMigration).toContain("'/ayarlar?tab=verification'");
  });
});
