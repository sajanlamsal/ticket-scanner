# Utility Scripts

This directory contains utility scripts for database management and bulk operations.

## generate_sql_inserts.ts

Generates SQL INSERT statements for populating the `ticket_entry` table with pre-generated tokens. This script outputs SQL that can be manually run in your database.

### Usage

#### Basic Usage (Console Output)

```bash
# Generate SQL for tickets 1-100 (SQLite format)
npm run generate-sql -- --start=1 --end=100

# Generate SQL for tickets 1-100 (PostgreSQL format)
npm run generate-sql -- --start=1 --end=100 --output=postgres

# Generate for a specific event
npm run generate-sql -- --start=1 --end=100 --event-id=2
```

#### Save to File

```bash
# Save SQLite INSERT statements to file
npm run generate-sql -- --start=1 --end=500 --output=sqlite --output-file=tickets_batch1.sql

# Save PostgreSQL INSERT statements to file
npm run generate-sql -- --start=1 --end=500 --output=postgres --output-file=tickets_batch1.sql
```

### Options

- `--start <number>`: Starting ticket ID (default: 1)
- `--end <number>`: Ending ticket ID (default: 20)
- `--event-id <number>`: Event ID for tickets (default: 1)
- `--output <type>`: Database type - `sqlite` or `postgres` (default: sqlite)
- `--output-file <path>`: Optional file path to save SQL statements

### Running the Generated SQL

#### SQLite

```bash
# From console output (copy-paste)
sqlite3 ./data/tickets.db
# Then paste the SQL statements

# From file
sqlite3 ./data/tickets.db < tickets_batch1.sql
```

#### PostgreSQL

```bash
# From console output (copy-paste)
psql your_database
# Then paste the SQL statements

# From file
psql your_database < tickets_batch1.sql
```

### Examples

**Example 1: Generate 1000 tickets for event 1**
```bash
npm run generate-sql -- --start=1 --end=1000 --event-id=1 --output-file=event1_tickets.sql
sqlite3 ./data/tickets.db < event1_tickets.sql
```

**Example 2: Generate tickets 1001-2000 for event 2**
```bash
npm run generate-sql -- --start=1001 --end=2000 --event-id=2 --output=postgres --output-file=event2_batch2.sql
psql nepathya_tickets < event2_batch2.sql
```

**Example 3: Preview before saving**
```bash
# First preview in console
npm run generate-sql -- --start=1 --end=10 --event-id=1

# If looks good, save to file
npm run generate-sql -- --start=1 --end=10 --event-id=1 --output-file=test.sql
```

### How It Works

The script:
1. Loads `TICKET_SECRET` from `.env.local`
2. Generates tokens using the same hashids algorithm as the main app
3. Creates INSERT statements with: `id`, `event_id`, `token`, `created_at`
4. Wraps statements in a transaction (BEGIN/COMMIT)
5. Outputs to console or file based on options

**Conflict Handling:**
- **SQLite**: Uses `INSERT OR REPLACE` - preserves existing entry data (entered_at, attendee info) and only updates the token
- **PostgreSQL**: Uses `ON CONFLICT ... DO UPDATE` - only updates the token if ticket ID already exists

This means you can safely re-run the script without losing entry or attendee data!

### Important Notes

- **Secret Consistency**: Ensure `TICKET_SECRET` in `.env.local` matches the secret used for ticket validation
- **Conflict Handling**: Script handles existing ticket IDs gracefully:
  - SQLite: `INSERT OR REPLACE` preserves entry/attendee data
  - PostgreSQL: `ON CONFLICT DO UPDATE` only updates token
- **Safe Re-runs**: You can re-run the script without losing existing entry or attendee data
- **Event IDs**: Make sure the event exists in the `events` table before inserting tickets
- **Transaction Safety**: All statements are wrapped in a transaction for atomicity

### Difference from generate_tokens.ts

| Feature | generate_tokens.ts | generate_sql_inserts.ts |
|---------|-------------------|------------------------|
| Database writes | Directly inserts into DB | Outputs SQL only |
| Use case | Automated generation | Manual DB population |
| CSV generation | Yes | No |
| Flexibility | Limited to configured DB | Works with any DB |
| Review before insert | No | Yes |

Use `generate_sql_inserts.ts` when you:
- Want to review SQL before execution
- Need to import into a remote database
- Are working with multiple databases
- Need SQL for documentation/auditing
