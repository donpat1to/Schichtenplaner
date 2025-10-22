import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || '/app/data/schichtplan.db';

// Stelle sicher, dass das Verzeichnis existiert
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        // Enable foreign keys asynchronously
        this.enableForeignKeys().catch(err => {
          console.error('Error enabling foreign keys:', err);
        });
      }
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID });
      });
    });
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  private async enableForeignKeys(): Promise<void> {
    try {
      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      console.log('Foreign keys enabled');

      // Check if it's actually enabled
      const result = await this.get<{ foreign_keys: number }>('PRAGMA foreign_keys');
      console.log('Foreign keys status:', result);
    } catch (error) {
      console.error('Error enabling foreign keys:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Export a single instance
export const db = new Database();