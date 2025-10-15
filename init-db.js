#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tickets.db');

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

console.log('Creating new database at:', dbPath);

// Create new database
const db = new Database(dbPath);

console.log('Setting up database schema...');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create events table
db.exec(`
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    event_date DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create ticket_entry table with event support
db.exec(`
  CREATE TABLE ticket_entry (
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
`);

// Create admin_user table
db.exec(`
  CREATE TABLE admin_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default event
db.prepare(`
  INSERT INTO events (id, name, description, event_date, is_active) 
  VALUES (1, 'Main Event', 'Default event for testing', '2025-01-20', 1)
`).run();

// Insert admin user (password: admin123)
const bcrypt = require('bcryptjs');
const passwordHash = bcrypt.hashSync('admin123', 12);
db.prepare(`
  INSERT INTO admin_user (email, password_hash, display_name) 
  VALUES ('admin@example.com', ?, 'Admin User')
`).run(passwordHash);

console.log('Database initialized successfully!');
console.log('Default admin user created: admin / admin123');
console.log('Default event created: Event ID 1 - Main Event');

db.close();