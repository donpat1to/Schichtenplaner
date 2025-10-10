import { db } from '../services/databaseService.js';
import { readFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to ensure migrations are tracked
async function ensureMigrationTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Helper function to check if a migration has been applied
async function isMigrationApplied(migrationName: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM applied_migrations WHERE name = ?',
    [migrationName]
  );
  return (result?.count ?? 0) > 0;
}

// Helper function to mark a migration as applied
async function markMigrationAsApplied(migrationName: string) {
  await db.run(
    'INSERT INTO applied_migrations (id, name) VALUES (?, ?)',
    [crypto.randomUUID(), migrationName]
  );
}

export async function applyMigration() {
  try {
    console.log('📦 Starting database migration...');
    
    // Ensure migration tracking table exists
    await ensureMigrationTable();
    
    // Get all migration files
    const migrationsDir = join(__dirname, '../database/migrations');
    const files = await readdir(migrationsDir);
    
    // Sort files to ensure consistent order
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // Process each migration file
    for (const migrationFile of migrationFiles) {
      if (await isMigrationApplied(migrationFile)) {
        console.log(`ℹ️ Migration ${migrationFile} already applied, skipping...`);
        continue;
      }
      
      console.log(`📄 Applying migration: ${migrationFile}`);
      const migrationPath = join(migrationsDir, migrationFile);
      const migrationSQL = await readFile(migrationPath, 'utf-8');
      
      // Split into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      // Start transaction for this migration
      await db.run('BEGIN TRANSACTION');
      
      try {
        // Execute each statement
        for (const statement of statements) {
          try {
            await db.exec(statement);
            console.log('✅ Executed:', statement.slice(0, 50) + '...');
          } catch (error) {
            const err = error as { code: string; message: string };
            if (err.code === 'SQLITE_ERROR' && err.message.includes('duplicate column name')) {
              console.log('ℹ️ Column already exists, skipping...');
              continue;
            }
            throw error;
          }
        }
        
        // Mark migration as applied
        await markMigrationAsApplied(migrationFile);
        await db.run('COMMIT');
        console.log(`✅ Migration ${migrationFile} applied successfully`);
        
      } catch (error) {
        await db.run('ROLLBACK');
        throw error;
      }
    }
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}