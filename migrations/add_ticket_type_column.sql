-- Add ticket_type column to ticket_entry table (nullable)
ALTER TABLE ticket_entry ADD COLUMN ticket_type VARCHAR(50);
