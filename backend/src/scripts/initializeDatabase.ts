// backend/src/scripts/initializeDatabase.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../services/databaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase(): Promise<void> {
  const possiblePaths = [
    path.join(__dirname, '../database/schema.sql'),
    path.join(__dirname, '../../database/schema.sql'),
    path.join(process.cwd(), 'database/schema.sql'),
    path.join(process.cwd(), 'src/database/schema.sql'),
    path.join(process.cwd(), 'dist/database/schema.sql')
  ];

  let schemaPath: string | null = null;

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      schemaPath = p;
      break;
    }
  }

  if (!schemaPath) {
    throw new Error(
      `❌ schema.sql not found in any of the tested paths:\n${possiblePaths.join('\n')}`
    );
  }

  console.log(`✅ Using schema at: ${schemaPath}`);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    console.log('Starting database initialization...');

        // ✅ Set PRAGMA statements FIRST, before any transactions
    await db.run('PRAGMA journal_mode = WAL;');
    await db.run('PRAGMA synchronous = NORMAL;');
    await db.run('PRAGMA foreign_keys = ON;');
    await db.run('PRAGMA secure_delete = ON;');
    await db.run('PRAGMA auto_vacuum = INCREMENTAL;');

    
    // ❌ REMOVE this line - synchronous cannot be changed in transaction
    // await db.run('PRAGMA synchronous = NORMAL;');
    
    console.log('✅ Database PRAGMA settings configured');
    
    try {
      const existingAdmin = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count 
         FROM employees e
         JOIN employee_roles er ON e.id = er.employee_id
         WHERE er.role = 'admin' AND e.is_active = 1`
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
      
      // UPDATED: Drop tables in correct dependency order for new schema
      const tablesToDrop = [
        'employee_availability',
        'shift_assignments', 
        'scheduled_shifts',
        'shifts',
        'time_slots',
        'employee_roles',
        'roles',
        'employees',
        'employee_types',
        'shift_plans',
        'applied_migrations'
      ];
      
      for (const table of tablesToDrop) {
        if (existingTables.some(t => t.name === table)) {
          console.log(`Dropping table: ${table}`);
          try {
            await db.run(`DROP TABLE IF EXISTS ${table}`);
          } catch (error) {
            console.warn(`Could not drop table ${table}:`, error);
          }
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
    
    // UPDATED: Insert default data in correct order
    try {
      console.log('Inserting default employee types...');
      await db.run(`INSERT OR IGNORE INTO employee_types (type, category, has_contract_type) VALUES ('manager', 'internal', 1)`);
      await db.run(`INSERT OR IGNORE INTO employee_types (type, category, has_contract_type) VALUES ('personell', 'internal', 1)`);
      await db.run(`INSERT OR IGNORE INTO employee_types (type, category, has_contract_type) VALUES ('apprentice', 'internal', 1)`);
      await db.run(`INSERT OR IGNORE INTO employee_types (type, category, has_contract_type) VALUES ('guest', 'external', 0)`);
      console.log('✅ Default employee types inserted');
      
      console.log('Inserting default roles...');
      await db.run(`INSERT OR IGNORE INTO roles (role, authority_level, description) VALUES ('admin', 100, 'Vollzugriff')`);
      await db.run(`INSERT OR IGNORE INTO roles (role, authority_level, description) VALUES ('maintenance', 50, 'Wartungszugriff')`);
      await db.run(`INSERT OR IGNORE INTO roles (role, authority_level, description) VALUES ('user', 10, 'Standardbenutzer')`);
      console.log('✅ Default roles inserted');
    } catch (error) {
      console.error('Error inserting default data:', error);
      await db.run('ROLLBACK');
      throw error;
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