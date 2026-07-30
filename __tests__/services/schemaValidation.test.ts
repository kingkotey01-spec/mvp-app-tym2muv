import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Schema and Migrations Verification Suite', () => {
  it('verifies that the 100_ensure_rls_and_policies.sql contains chats table creation with chat_id relation', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/100_ensure_rls_and_policies.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf8');
    
    // Check tables existence and chat_id column addition
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.chats');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.messages');
    expect(content).toContain('ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.chats(id)');
  });

  it('verifies that the self-review constraint reviews_no_self_review is defined', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/100_ensure_rls_and_policies.sql');
    const content = fs.readFileSync(migrationPath, 'utf8');

    // Expected check constraint
    expect(content).toContain('reviews_no_self_review CHECK (vendor_id <> customer_id)');
  });

  it('verifies that column privileges are revoked for is_premium and premium_upgraded_at', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/100_ensure_rls_and_policies.sql');
    const content = fs.readFileSync(migrationPath, 'utf8');

    expect(content).toContain('REVOKE INSERT (is_premium, premium_upgraded_at), UPDATE (is_premium, premium_upgraded_at)');
    expect(content).toContain('ON public.properties');
    expect(content).toContain('FROM authenticated, anon, PUBLIC;');
  });

  it('verifies that get_dashboard_stats and get_user_activity_daily exist in database_linter_fixes.sql', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/database_linter_fixes.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf8');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.get_dashboard_stats()');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.get_user_activity_daily()');
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.get_listing_stats()');
  });

  it('verifies sync-schema.ts handles and throws migration errors loudly without swallowing', () => {
    const syncSchemaPath = path.resolve(process.cwd(), 'scripts/sync-schema.ts');
    expect(fs.existsSync(syncSchemaPath)).toBe(true);

    const content = fs.readFileSync(syncSchemaPath, 'utf8');
    // Ensure "throw err" is executed on failure
    expect(content).toContain('console.error(`❌ Fail to apply ${migration.version}:`, err.message || err);');
    expect(content).toContain('throw err; // Fail loudly on any migration failure!');
  });
});
