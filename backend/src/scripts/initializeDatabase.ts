// backend/src/scripts/initializeDatabase.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../services/databaseService.js';
import { setupDefaultTemplate } from './setupDefaultTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase(): Promise<void> {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    console.log('Starting database initialization...');
    
    // Check if users table exists and has data
    try {
      const existingAdmin = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      
      if (existingAdmin && existingAdmin.count > 0) {
        console.log('✅ Database already initialized with admin user');
        return;
      }
    } catch (error) {
      console.log('ℹ️ Database tables might not exist yet, creating schema...');
    }
    
    // Get list of existing tables
    interface TableInfo {
      name: string;
    }
    
    try {
      const existingTables = await db.all<TableInfo>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      
      console.log('Existing tables found:', existingTables.map(t => t.name).join(', ') || 'none');
      
      // Drop existing tables in reverse order of dependencies if they exist
      const tablesToDrop = [
        'employee_availabilities',
        'assigned_shifts',
        'shift_plans',
        'template_shifts',
        'shift_templates',
        'users'
      ];
      
      for (const table of tablesToDrop) {
        if (existingTables.some(t => t.name === table)) {
          console.log(`Dropping table: ${table}`);
          await db.run(`DROP TABLE IF EXISTS ${table}`);
        }
      }
    } catch (error) {
      console.error('Error checking/dropping existing tables:', error);
      // Continue with schema creation even if table dropping fails
    }
    
    // Execute schema creation in a transaction
    await db.run('BEGIN EXCLUSIVE TRANSACTION');
    
    // Execute each statement separately for better error reporting
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .map(stmt => {
        // Remove any single-line comments
        return stmt.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      try {
        console.log('Executing statement:', statement.substring(0, 50) + '...');
        await db.run(statement);
      } catch (error) {
        console.error('Failed SQL statement:', statement);
        console.error('Error details:', error);
        await db.run('ROLLBACK');
        throw error;
      }
    }
    
    await db.run('COMMIT');
    console.log('✅ Database schema successfully initialized');
    
    // Give a small delay to ensure all transactions are properly closed
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}