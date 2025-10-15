#!/usr/bin/env tsx

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Environment setup
config({ path: '.env.local' });

interface AdminData {
  email: string;
  password: string;
  displayName?: string;
}

interface DBManager {
  createAdmin(email: string, passwordHash: string, displayName?: string): Promise<any> | any;
  close(): Promise<void> | void;
}

class SQLiteManager implements DBManager {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DATABASE_PATH || './data/tickets.db';
    const dbDir = path.dirname(dbPath);
    
    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    
    // Create tables if they don't exist
    const schema = fs.readFileSync('./db/sql/sqlite_create_tables.sql', 'utf-8');
    this.db.exec(schema);
  }

  createAdmin(email: string, passwordHash: string, displayName?: string): any {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO admin_user (email, password_hash, display_name)
      VALUES (?, ?, ?)
    `);
    return stmt.run(email, passwordHash, displayName);
  }

  close(): void {
    this.db.close();
  }
}

class PostgresManager implements DBManager {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async createAdmin(email: string, passwordHash: string, displayName?: string): Promise<any> {
    const result = await this.pool.query(
      'INSERT INTO admin_user (email, password_hash, display_name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name RETURNING *',
      [email, passwordHash, displayName]
    );
    return result.rows[0];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function seedAdmin(adminData: AdminData) {
  console.log(`Seeding admin user: ${adminData.email}`);
  
  const dbType = (process.env.DATABASE_TYPE as 'sqlite' | 'postgres') || 'sqlite';
  const dbManager: DBManager = dbType === 'sqlite' 
    ? new SQLiteManager() 
    : new PostgresManager();

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(adminData.password, 12);
    console.log('Password hashed successfully');
    
    // Create admin user
    const result = await dbManager.createAdmin(
      adminData.email,
      passwordHash,
      adminData.displayName
    );
    
    console.log('Admin user created/updated successfully:');
    console.log(`- Email: ${adminData.email}`);
    console.log(`- Display Name: ${adminData.displayName || 'Not provided'}`);
    console.log(`- Password Hash: ${passwordHash.substring(0, 20)}...`);
    
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

// Default admin data
const defaultAdmin: AdminData = {
  email: 'admin@example.com',
  password: 'admin123',
  displayName: 'Gate Admin'
};

// Allow custom admin via command line arguments
const args = process.argv.slice(2);
let adminData = defaultAdmin;

if (args.length >= 2) {
  adminData = {
    email: args[0],
    password: args[1],
    displayName: args[2] || undefined
  };
}

console.log('Nepathya Ticket System - Admin Seeder');
console.log('====================================');

// If called directly (not imported)
if (require.main === module) {
  seedAdmin(adminData).then(() => {
    console.log('\nAdmin seeding completed successfully!');
    console.log(`\nYou can now login with:`);
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
  });
}