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
const psychologistQueries = readSource('./psychologists.js');
const reviewQueries = readSource('../context/ReviewContext.jsx');
const sessionContext = readSource('../context/SessionContext.jsx');
const profileContext = readSource('../context/ProfileContext.jsx');
const supportPages = readSource('../pages/SupportPages.jsx');
const createPayment = readSource('../../api/create-payment.js');
const paymentCallback = readSource('../../api/payment-callback.js');
const notificationContext = readSource('../context/NotificationContext.jsx');
const monitoring = readSource('./monitoring.js');

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
    expect(supportPages).toContain("redirectTo: `${window.location.origin}/sifre-yenile`");
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

  it('keeps production monitoring optional and disables default PII', () => {
    expect(monitoring).toContain('VITE_SENTRY_DSN');
    expect(monitoring).toContain('sendDefaultPii: false');
    expect(monitoring).toContain('delete sanitized.user');
  });
});
