# Nepathya Ticket System - Copilot Instructions

This is a Next.js TypeScript project for QR-based event ticket verification.

## Project Structure
- **Frontend**: Next.js 14 with TypeScript and TailwindCSS
- **Backend**: Next.js API routes with raw SQL (no ORM)
- **Database**: SQLite (dev) or PostgreSQL (prod)
- **Authentication**: JWT-based admin system

## Key Components
- **Token Generation**: Uses hashids with server-side secret
- **QR Scanner**: Browser-based scanning for admin staff
- **Entry Validation**: Prevents duplicate entries with DB transactions
- **Admin Dashboard**: Ticket management and search functionality

## Development Guidelines
1. Keep TICKET_SECRET server-side only - never expose to frontend
2. Use prepared statements for all database queries
3. Implement proper error handling with appropriate HTTP status codes
4. Follow TypeScript strict mode practices
5. Use TailwindCSS for styling

## Environment Variables
- `TICKET_SECRET`: Token generation secret (server-only)
- `ADMIN_JWT_SECRET`: JWT signing secret
- `DATABASE_TYPE`: 'sqlite' or 'postgres'
- `DATABASE_PATH`: SQLite database path
- `DATABASE_URL`: PostgreSQL connection string

## Security Considerations
- All token operations happen server-side
- Admin endpoints require JWT authentication
- Database transactions prevent race conditions
- Input validation and sanitization on all endpoints
- Bcrypt for password hashing (12 rounds)