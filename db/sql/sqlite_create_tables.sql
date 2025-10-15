-- SQLite schema for ticket verification system
-- events table for multiple simultaneous events
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- tickets + entry combined table
CREATE TABLE IF NOT EXISTS ticket_entry (
  id            INTEGER NOT NULL,            -- ticket id (1..N per event)
  event_id      INTEGER NOT NULL DEFAULT 1, -- foreign key to events table
  token         TEXT NOT NULL UNIQUE,        -- pre-generated token printed on ticket
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  entered_at    DATETIME NULL,               -- set once by admin scan
  entered_by    TEXT NULL,                   -- admin identifier (email/id) who scanned
  attendee_name TEXT NULL,
  attendee_phone TEXT NULL,
  metadata_updated_at DATETIME NULL,
  PRIMARY KEY (id, event_id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- admin users table (for scanner auth)
CREATE TABLE IF NOT EXISTS admin_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- store salted hash (bcrypt)
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default event if not exists
INSERT OR IGNORE INTO events (id, name, description, event_date, is_active) 
VALUES (1, 'Default Event', 'Default event for backwards compatibility', date('now'), 1);

-- indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_entry_token ON ticket_entry(token);
CREATE INDEX IF NOT EXISTS idx_ticket_entry_entered_at ON ticket_entry(entered_at);
CREATE INDEX IF NOT EXISTS idx_ticket_entry_event_id ON ticket_entry(event_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_email ON admin_user(email);