-- Postgres schema for ticket verification system
-- events table for multiple simultaneous events
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- tickets + entry combined table
CREATE TABLE IF NOT EXISTS ticket_entry (
  id INTEGER NOT NULL,
  event_id INTEGER NOT NULL DEFAULT 1,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  entered_at TIMESTAMP WITH TIME ZONE,
  entered_by TEXT,
  attendee_name TEXT,
  attendee_phone TEXT,
  metadata_updated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id, event_id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS admin_user (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default event if not exists
INSERT INTO events (id, name, description, event_date, is_active) 
VALUES (1, 'Default Event', 'Default event for backwards compatibility', CURRENT_DATE, true)
ON CONFLICT (id) DO NOTHING;

-- indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_entry_token ON ticket_entry(token);
CREATE INDEX IF NOT EXISTS idx_ticket_entry_entered_at ON ticket_entry(entered_at);
CREATE INDEX IF NOT EXISTS idx_ticket_entry_event_id ON ticket_entry(event_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_email ON admin_user(email);