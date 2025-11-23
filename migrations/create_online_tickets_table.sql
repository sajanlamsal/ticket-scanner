-- Create online_tickets table
CREATE TABLE online_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  online_ticket_number VARCHAR(100) NOT NULL UNIQUE,
  entered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- For PostgreSQL, use SERIAL instead of AUTOINCREMENT:
-- CREATE TABLE online_tickets (
--   id SERIAL PRIMARY KEY,
--   online_ticket_number VARCHAR(100) NOT NULL UNIQUE,
--   entered_at TIMESTAMP,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
