// backend/src/services/databaseService.ts
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname für ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../database/schichtplan.db');

export class DatabaseService {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initializeDatabase();
      }
    });
  }

  private initializeDatabase() {
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'instandhalter', 'user')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shift_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS template_shifts (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        required_employees INTEGER DEFAULT 1,
        color TEXT DEFAULT '#3498db',
        FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS shift_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        template_id TEXT,
        status TEXT CHECK(status IN ('draft', 'published')) DEFAULT 'draft',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (template_id) REFERENCES shift_templates(id)
      );

      CREATE TABLE IF NOT EXISTS assigned_shifts (
        id TEXT PRIMARY KEY,
        shift_plan_id TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        required_employees INTEGER DEFAULT 1,
        assigned_employees TEXT DEFAULT '[]',
        FOREIGN KEY (shift_plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE
      );
    `;

    this.db.exec(schema, (err) => {
      if (err) {
        console.error('Database initialization error:', err);
      } else {
        console.log('Database initialized successfully');
      }
    });
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new DatabaseService();