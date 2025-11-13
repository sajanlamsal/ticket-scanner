#!/usr/bin/env tsx

/**
 * Generate SQL INSERT statements for ticket_entry table
 * 
 * This script generates SQL that can be manually run in your database.
 * It creates INSERT statements with id, event_id, token, and created_at fields.
 * 
 * Usage:
 *   tsx scripts/utilities/generate_sql_inserts.ts --start=1 --end=100 --event-id=1
 *   tsx scripts/utilities/generate_sql_inserts.ts --start=1 --end=100 --event-id=1 --output=sqlite
 *   tsx scripts/utilities/generate_sql_inserts.ts --start=1 --end=100 --event-id=1 --output=postgres
 */

import { Command } from 'commander';
import Hashids from 'hashids';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const TICKET_SECRET = process.env.TICKET_SECRET || 'MnepThaya2025';
const hashids = new Hashids(TICKET_SECRET, 6);

interface GenerateOptions {
  start: number;
  end: number;
  eventId: number;
  output: 'sqlite' | 'postgres';
  outputFile?: string;
}

function generateToken(ticketId: number, eventId: number): string {
  return hashids.encode(eventId, ticketId);
}

function generateSQLiteInserts(start: number, end: number, eventId: number): string[] {
  const statements: string[] = [
    '-- SQLite INSERT statements for ticket_entry table',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Ticket range: ${start} to ${end}`,
    `-- Event ID: ${eventId}`,
    `-- Secret: ${TICKET_SECRET.slice(0, 4)}***`,
    `-- Note: Uses INSERT OR REPLACE to handle existing tickets`,
    '',
    'BEGIN TRANSACTION;',
    ''
  ];

  for (let i = start; i <= end; i++) {
    const token = generateToken(i, eventId);
    // INSERT OR REPLACE: Updates token if ticket exists, preserves other fields
    statements.push(
      `INSERT OR REPLACE INTO ticket_entry (id, event_id, token, created_at, entered_at, entered_by, attendee_name, attendee_phone, metadata_updated_at) ` +
      `VALUES (${i}, ${eventId}, '${token}', ` +
      `COALESCE((SELECT created_at FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}), datetime('now')), ` +
      `(SELECT entered_at FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}), ` +
      `(SELECT entered_by FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}), ` +
      `(SELECT attendee_name FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}), ` +
      `(SELECT attendee_phone FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}), ` +
      `(SELECT metadata_updated_at FROM ticket_entry WHERE id = ${i} AND event_id = ${eventId}));`
    );
  }

  statements.push('');
  statements.push('COMMIT;');
  statements.push('');
  statements.push(`-- Total tickets processed: ${end - start + 1}`);
  statements.push('-- Existing tickets will have their tokens updated while preserving entry data');

  return statements;
}

function generatePostgresInserts(start: number, end: number, eventId: number): string[] {
  const statements: string[] = [
    '-- PostgreSQL INSERT statements for ticket_entry table',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Ticket range: ${start} to ${end}`,
    `-- Event ID: ${eventId}`,
    `-- Secret: ${TICKET_SECRET.slice(0, 4)}***`,
    `-- Note: Uses ON CONFLICT to handle existing tickets`,
    '',
    'BEGIN;',
    ''
  ];

  for (let i = start; i <= end; i++) {
    const token = generateToken(i, eventId);
    // ON CONFLICT: Updates only the token if ticket exists, preserves entry data
    statements.push(
      `INSERT INTO ticket_entry (id, event_id, token, created_at) ` +
      `VALUES (${i}, ${eventId}, '${token}', now()) ` +
      `ON CONFLICT (id, event_id) DO UPDATE SET token = EXCLUDED.token;`
    );
  }

  statements.push('');
  statements.push('COMMIT;');
  statements.push('');
  statements.push(`-- Total tickets processed: ${end - start + 1}`);
  statements.push('-- Existing tickets will have their tokens updated while preserving entry data');

  return statements;
}

function generateSQL(options: GenerateOptions): void {
  const { start, end, eventId, output, outputFile } = options;

  console.log(`Generating ${output.toUpperCase()} INSERT statements...`);
  console.log(`Ticket range: ${start} to ${end}`);
  console.log(`Event ID: ${eventId}`);
  console.log(`Using secret: ${TICKET_SECRET.slice(0, 4)}***`);
  console.log('');

  const statements = output === 'sqlite' 
    ? generateSQLiteInserts(start, end, eventId)
    : generatePostgresInserts(start, end, eventId);

  const sqlContent = statements.join('\n');

  // Output to file or console
  if (outputFile) {
    fs.writeFileSync(outputFile, sqlContent);
    console.log(`✅ SQL statements written to: ${outputFile}`);
    console.log('');
    console.log('To run in your database:');
    if (output === 'sqlite') {
      console.log(`  sqlite3 your_database.db < ${outputFile}`);
    } else {
      console.log(`  psql your_database < ${outputFile}`);
    }
  } else {
    console.log('--- SQL STATEMENTS ---');
    console.log(sqlContent);
    console.log('--- END SQL STATEMENTS ---');
    console.log('');
    console.log('💡 Tip: Use --output-file to save to a file');
  }

  console.log('');
  console.log(`Generated ${end - start + 1} INSERT statements successfully!`);
}

// CLI setup
const program = new Command();

program
  .name('generate-sql-inserts')
  .description('Generate SQL INSERT statements for ticket_entry table')
  .option('--start <number>', 'Starting ticket ID', '1')
  .option('--end <number>', 'Ending ticket ID', '20')
  .option('--event-id <number>', 'Event ID for tickets', '1')
  .option('--output <type>', 'Database type: sqlite or postgres', 'sqlite')
  .option('--output-file <path>', 'Save SQL to file (optional)')
  .action((options) => {
    const start = parseInt(options.start);
    const end = parseInt(options.end);
    const eventId = parseInt(options.eventId);
    const output = options.output.toLowerCase();

    // Validation
    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      console.error('❌ Error: Invalid start/end values. Start must be >= 1 and <= end.');
      process.exit(1);
    }

    if (isNaN(eventId) || eventId < 1) {
      console.error('❌ Error: Invalid event ID. Event ID must be >= 1.');
      process.exit(1);
    }

    if (output !== 'sqlite' && output !== 'postgres') {
      console.error('❌ Error: Output type must be "sqlite" or "postgres".');
      process.exit(1);
    }

    generateSQL({
      start,
      end,
      eventId,
      output: output as 'sqlite' | 'postgres',
      outputFile: options.outputFile
    });
  });

// Parse CLI arguments
program.parse();
