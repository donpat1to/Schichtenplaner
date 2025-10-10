import { db } from '../services/databaseService.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function applyMigration() {
  try {
    console.log('📦 Starting database migration...');
    
    // Read the migration file
    const migrationPath = join(__dirname, '../database/migrations/002_add_employee_fields.sql');
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
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
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}