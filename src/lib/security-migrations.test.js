import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

const migration = readSource('./migration-009-privacy-boundaries.sql');
const bookingMigration = readSource('./migration-010-booking-availability.sql');
const psychologistQueries = readSource('./psychologists.js');
const reviewQueries = readSource('../context/ReviewContext.jsx');
const paymentCallback = readSource('../../api/payment-callback.js');

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

  it('never falls back to the anonymous key for payment updates', () => {
    expect(paymentCallback).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(paymentCallback).not.toContain('process.env.VITE_SUPABASE_ANON_KEY');
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

  it('keeps demo psychologist data development-only', () => {
    expect(psychologistQueries).toContain('import.meta.env.DEV');
  });
});
