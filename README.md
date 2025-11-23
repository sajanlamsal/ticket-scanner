# Nepathya Ticket System

A Next.js TypeScript application for QR-based event ticket verification with admin scanner functionality and optional attendee metadata collection.

## Features

- 🎫 **Pre-generated QR tokens** using hashids with server-side secret
- 📱 **Mobile QR scanner** for admin staff with live camera feed
- ✅ **Real-time entry validation** with duplicate prevention
- 👤 **Optional attendee information** collection (name/phone)
- 🔐 **JWT-based admin authentication** with secure token handling
- 📊 **Admin dashboard** for ticket management and search
- 🗄️ **Raw SQL support** for both SQLite and PostgreSQL
- 🔒 **Security-first design** - secret never exposed to frontend
- 🎨 **VIP Pass Generator** - Create beautiful, printable VIP passes (PDF)

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Backend**: Next.js API routes, Raw SQL (no ORM)
- **Database**: SQLite (dev) or PostgreSQL (production)
- **Authentication**: JWT with bcrypt password hashing
- **QR Generation**: hashids with configurable secret
- **QR Scanning**: html5-qrcode for browser-based scanning

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd nepathya-ticket-prototype

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
```

### 2. Environment Configuration

Edit `.env.local` with your settings:

```bash
# Required: Token generation secret (keep secure!)
TICKET_SECRET=MnepThaya2025

# Required: JWT signing secret (at least 32 characters)
ADMIN_JWT_SECRET=your_super_secure_jwt_secret_here_at_least_32_chars

# Database configuration
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/tickets.db

# For PostgreSQL (uncomment if using):
# DATABASE_TYPE=postgres
# DATABASE_URL=postgresql://user:password@localhost:5432/tickets
```

### 3. Database Setup

The application will automatically create tables on first run. For manual setup:

**SQLite:**
```bash
# Tables are created automatically when the app starts
# Or run manually:
sqlite3 ./data/tickets.db < ./db/sql/sqlite_create_tables.sql
```

**PostgreSQL:**
```bash
# Connect to your database and run:
psql your_database < ./db/sql/postgres_create_tables.sql
```

### 4. Seed Admin User

Create your first admin user:

```bash
# Using default credentials (admin@example.com / admin123)
npm run seed-admin

# Or with custom credentials:
npm run seed-admin -- admin@yoursite.com yourpassword "Admin Name"
```

### 5. Generate Tickets

Generate QR tokens and CSV for printing:

```bash
# Generate tokens 1-100 with local host
npm run generate-tokens -- --start=1 --end=100 --host=http://localhost:3000

# Generate for production
npm run generate-tokens -- --start=1 --end=1000 --host=https://yoursite.com

# Preview without database changes
npm run generate-tokens -- --start=1 --end=5 --dry-run
```

This creates a CSV file `tickets-1-100.csv` with columns:
- `ticketId`: Sequential ID (1, 2, 3...)
- `token`: Generated hash (e.g., "x9K2mE")
- `qrUrl`: Full URL for QR codes (e.g., "http://localhost:3000/entry/x9K2mE")

### 6. Generate VIP Passes (Optional)

Create beautiful, printable VIP passes with QR codes:

```bash
# Generate VIP passes for tickets 1-20 (Event 1)
npm run generate-vip-passes -- --start=1 --end=20 --event-id=1 --event-name="Nepathya Concert 2025"

# Generate for specific VIP guests (Event 1)
npm run generate-vip-passes -- --tickets=1,5,10,25 --event-id=1 --event-name="VIP Backstage Pass"

# Generate for different event (Event 2)
npm run generate-vip-passes -- --start=1 --end=30 --event-id=2 --event-name="After Party VIP"
```

This creates a PDF file with one A4 page per ticket, ready for printing and distribution to VIP guests. Tokens are generated using the same algorithm as the main system (with event_id), ensuring they work seamlessly with your scanner.

📖 **Full documentation**: See [VIP Pass Guide](./docs/VIP_PASS_GUIDE.md)

### 7. Start Development Server

```bash
npm run dev
```

Visit:
- **Homepage**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin/login
- **QR Scanner**: http://localhost:3000/admin/scanner
- **Example Ticket**: http://localhost:3000/entry/[token]

## API Documentation

### Public Endpoints (No Auth Required)

#### GET `/entry/[token]`
Landing page for ticket holders. Shows ticket status and allows metadata entry.

#### GET `/api/ticket/by-token?token={token}`
```bash
curl "http://localhost:3000/api/ticket/by-token?token=x9K2mE"
```
**Response:**
```json
{
  "id": 123,
  "entered_at": "2024-01-15T10:30:00Z",
  "attendee_name": "John Doe",
  "attendee_phone": "+1234567890",
  "metadata_updated_at": "2024-01-15T09:15:00Z"
}
```

#### POST `/api/attendee`
Update attendee information for a ticket.
```bash
curl -X POST http://localhost:3000/api/attendee \
  -H "Content-Type: application/json" \
  -d '{
    "token": "x9K2mE",
    "name": "John Doe",
    "phone": "+1234567890"
  }'
```

### Admin Endpoints (Auth Required)

#### POST `/api/admin/login`
Authenticate admin and receive JWT token.
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```
**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "displayName": "Gate Admin"
  }
}
```

#### POST `/api/validate`
Mark ticket as entered (admin scanner endpoint).
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"token": "x9K2mE"}'
```

**Response (First Entry):**
```json
{
  "ok": true,
  "entered": true,
  "ticketId": 123,
  "enteredAt": "2024-01-15T10:30:00Z"
}
```

**Response (Already Entered):**
```json
{
  "ok": true,
  "entered": false,
  "alreadyEntered": true,
  "ticketId": 123,
  "enteredAt": "2024-01-15T09:00:00Z",
  "enteredBy": "admin@example.com"
}
```

#### GET `/api/admin/tickets`
List and search tickets (admin only).
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/api/admin/tickets?entered=false&q=123"
```

## Database Schema

### SQLite Schema
```sql
-- Combined ticket and entry table
CREATE TABLE ticket_entry (
  id            INTEGER PRIMARY KEY,         -- ticket id (1..N)
  token         TEXT NOT NULL UNIQUE,        -- pre-generated token
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  entered_at    DATETIME NULL,               -- set once by admin scan
  entered_by    TEXT NULL,                   -- admin who scanned
  attendee_name TEXT NULL,
  attendee_phone TEXT NULL,
  metadata_updated_at DATETIME NULL
);

-- Admin users for scanner authentication
CREATE TABLE admin_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- bcrypt hashed
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### PostgreSQL Schema
```sql
-- Same structure but with PostgreSQL data types
CREATE TABLE ticket_entry (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  entered_at TIMESTAMP WITH TIME ZONE,
  entered_by TEXT,
  attendee_name TEXT,
  attendee_phone TEXT,
  metadata_updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE admin_user (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## Token Algorithm

Tokens are generated using **hashids** with the following configuration:
- **Salt**: `process.env.TICKET_SECRET`
- **Minimum Length**: 6 characters
- **Input**: Sequential ticket IDs (1, 2, 3...)
- **Output**: URL-safe tokens (e.g., "x9K2mE", "jR8Nq1")

```typescript
// Server-side only
import Hashids from 'hashids/cjs';
const hashids = new Hashids(process.env.TICKET_SECRET, 6);

// Generate
const token = hashids.encode(ticketId); // "x9K2mE"

// Decode (server-side validation)
const [ticketId] = hashids.decode(token); // [123]
```

## Security Features

### Server-Side Secret Protection
- ✅ `TICKET_SECRET` only accessible on server
- ✅ Token generation/validation server-side only
- ✅ No secret exposure in frontend bundles
- ✅ Admin JWT with short expiry (6 hours)

### Database Security
- ✅ Prepared statements prevent SQL injection
- ✅ Bcrypt password hashing (rounds: 12)
- ✅ Transaction-based entry validation prevents race conditions
- ✅ Input sanitization and validation

### Access Control
- ✅ JWT-based admin authentication
- ✅ Bearer token validation on protected endpoints
- ✅ Rate limiting ready for production
- ✅ CORS and HTTPS ready

## Concurrency & Race Conditions

Entry validation uses database transactions to prevent duplicate entries:

**SQLite**: `BEGIN IMMEDIATE` transaction with row locks
```sql
BEGIN IMMEDIATE;
SELECT * FROM ticket_entry WHERE id = ? AND entered_at IS NULL;
UPDATE ticket_entry SET entered_at = CURRENT_TIMESTAMP, entered_by = ? WHERE id = ?;
COMMIT;
```

**PostgreSQL**: `SELECT FOR UPDATE` with explicit locking
```sql
BEGIN;
SELECT * FROM ticket_entry WHERE id = $1 FOR UPDATE;
UPDATE ticket_entry SET entered_at = now(), entered_by = $2 WHERE id = $1 AND entered_at IS NULL;
COMMIT;
```

## Production Deployment

### Environment Variables
```bash
# Production values
TICKET_SECRET=your-production-secret-here
ADMIN_JWT_SECRET=your-production-jwt-secret-at-least-32-chars
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Optional
NODE_ENV=production
```

### Database Setup
```bash
# PostgreSQL production setup
createdb nepathya_tickets
psql nepathya_tickets < ./db/sql/postgres_create_tables.sql

# Create admin user
npm run seed-admin -- admin@yourcompany.com secure_password "Event Admin"

# Generate production tokens
npm run generate-tokens -- --start=1 --end=5000 --host=https://tickets.yoursite.com
```

### Build & Deploy
```bash
npm run build
npm start
```

## Testing & Acceptance Criteria

### Manual Testing Checklist

1. **Database Setup**
   ```bash
   npm run seed-admin
   npm run generate-tokens -- --start=1 --end=20
   ```

2. **Public Access (No Auth)**
   - Visit `/entry/[token]` shows ticket status
   - Submit attendee name/phone via form
   - Verify database updated with metadata

3. **Admin Authentication**
   - Login at `/admin/login` with seeded credentials
   - Receive JWT token in response
   - Access protected `/admin/scanner` page

4. **Entry Validation**
   - Scan token via QR or manual entry
   - First scan: `entered: true` with timestamp
   - Second scan: `alreadyEntered: true` with original timestamp
   - Invalid token: `ticket_not_found` error

5. **Concurrency Test**
   ```bash
   # Simulate simultaneous scans (requires 2 terminals)
   curl -X POST localhost:3000/api/validate -H "Authorization: Bearer TOKEN" -d '{"token":"x9K2mE"}' &
   curl -X POST localhost:3000/api/validate -H "Authorization: Bearer TOKEN" -d '{"token":"x9K2mE"}' &
   ```
   Only one should succeed with `entered: true`

### Example Test Commands

```bash
# Test token validation
curl -X POST http://localhost:3000/api/validate \
  -H "Authorization: Bearer $(cat admin_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{"token": "x9K2mE"}'

# Test attendee update
curl -X POST http://localhost:3000/api/attendee \
  -H "Content-Type: application/json" \
  -d '{"token": "x9K2mE", "name": "Test User", "phone": "+1234567890"}'

# Test invalid token
curl http://localhost:3000/api/ticket/by-token?token=invalid123
# Expected: {"error": "Ticket not found"}
```

## Troubleshooting

### Common Issues

**"Cannot find module" errors:**
```bash
npm install
npm run type-check
```

**Database connection errors:**
- Check `.env.local` DATABASE_PATH or DATABASE_URL
- Ensure PostgreSQL is running (if using)
- Verify file permissions for SQLite

**QR Scanner not working:**
- Use HTTPS or localhost (camera requires secure context)
- Allow camera permissions in browser
- Test on mobile device for best experience

**Token validation fails:**
- Verify TICKET_SECRET matches generation secret
- Check token exists in database
- Ensure server-side validation only

### Debug Commands

```bash
# Check database contents (SQLite)
sqlite3 ./data/tickets.db "SELECT * FROM ticket_entry LIMIT 5;"

# Verify admin user
sqlite3 ./data/tickets.db "SELECT email, display_name FROM admin_user;"

# Test token generation
npm run generate-tokens -- --start=1 --end=1 --dry-run

# Check JWT secret
node -e "console.log(process.env.ADMIN_JWT_SECRET?.length || 'NOT SET')"
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request