# Utility Scripts

This directory contains utility scripts for database management and bulk operations.

## Table of Contents
- [generate_sql_inserts.ts](#generate_sql_insertsts) - Generate SQL INSERT statements
- [generate_vip_passes.ts](#generate_vip_passests) - Generate printable VIP passes with QR codes

---

## generate_vip_passes.ts

Generates beautiful, printable VIP passes as PDF files. Each pass is one A4 page with QR code, ticket details, and professional branding. Perfect for distributing to VIP guests.

**Note**: This script generates tokens on-the-fly using `TICKET_SECRET` from `.env.local` - no database connection required.

### Features

- 🎨 Professional VIP pass design with gold accents
- 📄 One page per ticket (A4 format)
- 🔲 High-quality QR codes for scanning
- 🎫 Ticket ID, token, and event information
- � Uses same token generation as main system (hashids with event ID)
- 🎭 Customizable event name, subtitle, and footer
- ⚡ Fast generation without database overhead

### Usage

#### Generate Range of Passes

```bash
# Generate VIP passes for tickets 1-10 (Event 1)
npm run generate-vip-passes -- --start=1 --end=10 --event-id=1

# Generate with custom event name
npm run generate-vip-passes -- --start=1 --end=10 --event-id=1 --event-name="Nepathya Concert 2025"

# Generate for Event 2 with all customizations
npm run generate-vip-passes -- --start=1 --end=20 --event-id=2 \
  --event-name="Nepathya Live 2025" \
  --subtitle="BACKSTAGE ACCESS" \
  --footer="NEPATHYA ENTERTAINMENT" \
  --output=backstage-passes.pdf
```

#### Generate Specific Tickets

```bash
# Generate passes for specific ticket IDs in Event 1
npm run generate-vip-passes -- --tickets=1,5,10,25,50 --event-id=1

# Generate for VIP guests in Event 3
npm run generate-vip-passes -- --tickets=101,102,103,104,105 --event-id=3 \
  --event-name="VIP Meet & Greet" \
  --output=vip-meetgreet.pdf
```

#### Production URL

```bash
# Generate with production URL for QR codes
npm run generate-vip-passes -- --start=1 --end=100 --event-id=1 \
  --host=https://tickets.yoursite.com \
  --event-name="Nepathya World Tour 2025" \
  --output=vip-passes-production.pdf
```

### Options

- `--start <number>`: Starting ticket ID (required if not using --tickets)
- `--end <number>`: Ending ticket ID (required if not using --tickets)
- `--tickets <list>`: Comma-separated ticket IDs (alternative to start/end)
- `--event-id <number>`: Event ID for token generation (required, default: 1)
- `--host <url>`: Host URL for QR codes (default: http://localhost:3000)
- `--output <file>`: Output PDF filename (default: vip-passes.pdf)
- `--event-name <name>`: Custom event name displayed on pass
- `--subtitle <text>`: Custom subtitle (default: "EXCLUSIVE ACCESS PASS")
- `--footer <text>`: Custom footer text

### Pass Design

Each VIP pass includes:

- **Gold accent branding** at top and bottom
- **VIP badge** with circular gold design
- **Event title** prominently displayed
- **QR code** centered for easy scanning (90mm x 90mm)
- **Ticket number** with leading zeros (e.g., #0001)
- **Token** for verification
- **Entry instructions** for guests
- **Decorative corner elements** for premium look
- **Scan URL** in footer for reference

### Examples

**Example 1: Basic VIP passes for first 50 tickets**
```bash
npm run generate-vip-passes -- --start=1 --end=50 --event-id=1 --event-name="Nepathya Concert 2025"
```

**Example 2: Specific VIP guests with custom branding**
```bash
npm run generate-vip-passes -- --tickets=1,2,3,4,5 --event-id=1 \
  --event-name="Nepathya VIP Lounge" \
  --subtitle="PREMIUM ACCESS • ALL AREAS" \
  --footer="PRESENTED BY NEPATHYA ENTERTAINMENT" \
  --output=vip-lounge-passes.pdf
```

**Example 3: Multiple events with different passes**
```bash
# Event 1 - Main Concert
npm run generate-vip-passes -- --start=1 --end=50 --event-id=1 \
  --event-name="Nepathya Main Concert" \
  --output=event1-vip.pdf

# Event 2 - After Party
npm run generate-vip-passes -- --start=1 --end=20 --event-id=2 \
  --event-name="Nepathya After Party" \
  --output=event2-vip.pdf
```

### Printing Instructions

1. Open the generated PDF file
2. Print settings:
   - Paper size: A4 (210mm x 297mm)
   - Orientation: Portrait
   - Scale: 100% (Actual size)
   - Print quality: High/Best
3. Use card stock or premium paper for best results
4. Each pass is one page - no need to cut or fold

### How It Works

The script:
1. Loads `TICKET_SECRET` from `.env.local`
2. Generates tokens using hashids with event_id and ticket_id (same as `generate_tokens.ts`)
3. Creates QR codes linking to `/entry/{token}`
4. Generates professional PDF with one A4 page per ticket
5. No database connection required - pure token generation

**Token Generation:**
- Uses `hashids.encode(eventId, ticketId)` 
- Same algorithm as main ticket generation system
- Ensures tokens match across all systems
- Different event IDs produce different tokens for same ticket number

---

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
