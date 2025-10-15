#!/usr/bin/env tsx

import { Command } from 'commander';
import Hashids from 'hashids';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Environment setup
config({ path: '.env.local' });

const TICKET_SECRET = process.env.TICKET_SECRET || 'MnepThaya2025';
const hashids = new Hashids(TICKET_SECRET, 6);

interface DBManager {
  insertOrUpdateTicket(id: number, token: string, eventId?: number): Promise<void> | void;
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

  insertOrUpdateTicket(id: number, token: string, eventId: number = 1): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ticket_entry (id, event_id, token, created_at)
      VALUES (?, ?, ?, COALESCE((SELECT created_at FROM ticket_entry WHERE id = ? AND event_id = ?), CURRENT_TIMESTAMP))
    `);
    stmt.run(id, eventId, token, id, eventId);
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

  async insertOrUpdateTicket(id: number, token: string, eventId: number = 1): Promise<void> {
    await this.pool.query(`
      INSERT INTO ticket_entry (id, event_id, token, created_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (id, event_id) DO UPDATE SET token = EXCLUDED.token
    `, [id, eventId, token]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function generateTokens(start: number, end: number, host: string, eventId: number = 1, dryRun: boolean = false) {
  console.log(`Generating tokens from ${start} to ${end} for event ${eventId}...`);
  console.log(`Host: ${host}`);
  console.log(`Secret: ${TICKET_SECRET.slice(0, 4)}***`);
  
  if (dryRun) {
    console.log('DRY RUN MODE - No database changes will be made');
  }

  const dbType = (process.env.DATABASE_TYPE as 'sqlite' | 'postgres') || 'sqlite';
  const dbManager: DBManager = dbType === 'sqlite' 
    ? new SQLiteManager() 
    : new PostgresManager();

  const csvLines = ['ticketId,eventId,token,qrUrl'];
  
  try {
    for (let i = start; i <= end; i++) {
      const token = hashids.encode(eventId, i);
      const qrUrl = `${host}/entry/${token}`;
      
      console.log(`Event ${eventId}, Ticket ${i}: ${token} -> ${qrUrl}`);
      
      if (!dryRun) {
        await dbManager.insertOrUpdateTicket(i, token, eventId);
      }
      
      csvLines.push(`${i},${eventId},${token},${qrUrl}`);
    }

    // Write CSV file
    const csvFilename = `tickets-event${eventId}-${start}-${end}.csv`;
    const csvContent = csvLines.join('\n');
    
    if (!dryRun) {
      fs.writeFileSync(csvFilename, csvContent);
      console.log(`\nCSV file written: ${csvFilename}`);
    } else {
      console.log(`\nCSV content (not saved):\n${csvContent}`);
    }

    console.log(`\nGenerated ${end - start + 1} tokens successfully!`);
    
  } catch (error) {
    console.error('Error generating tokens:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

// CLI setup
const program = new Command();

program
  .name('generate-tokens')
  .description('Generate QR tokens for tickets')
  .option('--start <number>', 'Starting ticket ID', '1')
  .option('--end <number>', 'Ending ticket ID', '20')
  .option('--event-id <number>', 'Event ID for tickets', '1')
  .option('--host <url>', 'Host URL for QR codes', 'http://localhost:3000')
  .option('--dry-run', 'Preview tokens without saving to database', false)
  .action((options) => {
    const start = parseInt(options.start);
    const end = parseInt(options.end);
    const eventId = parseInt(options.eventId);
    const host = options.host;
    const dryRun = options.dryRun;

    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      console.error('Invalid start/end values. Start must be >= 1 and <= end.');
      process.exit(1);
    }

    if (isNaN(eventId) || eventId < 1) {
      console.error('Invalid event ID. Event ID must be >= 1.');
      process.exit(1);
    }

    generateTokens(start, end, host, eventId, dryRun);
  });

// If called directly (not imported)
if (require.main === module) {
  program.parse();
}