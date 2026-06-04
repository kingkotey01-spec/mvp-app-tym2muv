import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load and parse environment variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        // Strip quotes if any
        let cleanVal = val;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          cleanVal = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = cleanVal;
        }
      }
    }
  }
}

async function run() {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    console.warn('💡 Please configure DATABASE_URL in your .env file with your direct Supabase connection string.');
    process.exit(1);
  }

  console.log('🔄 Connecting to Supabase database...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!');

    // Create migrations meta tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Fetch previously applied migrations
    const { rows } = await client.query('SELECT version FROM public.schema_migrations');
    const appliedSet = new Set<string>(rows.map(row => row.version));

    // Define all migration steps in sequential order
    const migrationQueue: { version: string; filePath: string }[] = [];

    // Add baseline
    const baselinePath = path.resolve(process.cwd(), 'FULL_SUPABASE_SCHEMA.sql');
    if (fs.existsSync(baselinePath)) {
      migrationQueue.push({ version: '0000_baseline', filePath: baselinePath });
    } else {
      console.warn('⚠️ Warning: FULL_SUPABASE_SCHEMA.sql not found at project root.');
    }

    // Add other system schemas if they exist but aren't in standard migration folders
    const extraSchemas = [
      { name: 'supabase_production_schema', path: 'supabase_production_schema.sql' },
      { name: 'supabase_production_hardening', path: 'supabase_production_hardening.sql' },
      { name: 'supabase_admin_system', path: 'supabase_admin_system.sql' },
      { name: 'supabase_agent_system', path: 'supabase_agent_system.sql' }
    ];

    for (const schema of extraSchemas) {
      const p = path.resolve(process.cwd(), schema.path);
      if (fs.existsSync(p)) {
        migrationQueue.push({ version: `extra_${schema.name}`, filePath: p });
      }
    }

    // Read custom migrations directory `/migrations`
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        migrationQueue.push({
          version: `custom_mig_${file}`,
          filePath: path.join(migrationsDir, file)
        });
      }
    }

    // Read supabase internal migrations `/supabase/migrations`
    const supabaseMigrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
    if (fs.existsSync(supabaseMigrationsDir)) {
      const files = fs.readdirSync(supabaseMigrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        migrationQueue.push({
          version: `supabase_mig_${file}`,
          filePath: path.join(supabaseMigrationsDir, file)
        });
      }
    }

    console.log(`📋 Found ${migrationQueue.length} potential schema parts to verify.`);

    let migrationCounter = 0;
    for (const migration of migrationQueue) {
      if (appliedSet.has(migration.version)) {
        console.log(`⏭️  Skipping previously applied schema part: ${migration.version}`);
        continue;
      }

      console.log(`🚀 Applying schema part: ${migration.version} (${path.basename(migration.filePath)})...`);
      const sql = fs.readFileSync(migration.filePath, 'utf-8');
      
      // Execute as a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [migration.version]);
        await client.query('COMMIT');
        console.log(`✅ Applied successfully!`);
        migrationCounter++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Fail to apply ${migration.version}:`, err.message || err);
        throw err;
      }
    }

    if (migrationCounter === 0) {
      console.log('✅ Supabase schema is completely up-to-date! No changes required.');
    } else {
      console.log(`🎉 Success! Applied ${migrationCounter} schema updates to Supabase.`);
    }

  } catch (error: any) {
    console.error('❌ Synchronizer error:', error.message || error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
