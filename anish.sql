-- SQLite INSERT statements for ticket_entry table
-- Generated: 2025-11-12T05:42:36.550Z
-- Ticket range: 798 to 798
-- Event ID: 1
-- Secret: Mnep***
-- Note: Uses INSERT OR REPLACE to handle existing tickets

BEGIN TRANSACTION;

INSERT OR REPLACE INTO ticket_entry (id, event_id, token, created_at, entered_at, entered_by, attendee_name, attendee_phone, metadata_updated_at) VALUES (798, 1, '95WhwP', COALESCE((SELECT created_at FROM ticket_entry WHERE id = 798 AND event_id = 1), datetime('now')), (SELECT entered_at FROM ticket_entry WHERE id = 798 AND event_id = 1), (SELECT entered_by FROM ticket_entry WHERE id = 798 AND event_id = 1), (SELECT attendee_name FROM ticket_entry WHERE id = 798 AND event_id = 1), (SELECT attendee_phone FROM ticket_entry WHERE id = 798 AND event_id = 1), (SELECT metadata_updated_at FROM ticket_entry WHERE id = 798 AND event_id = 1));

COMMIT;

-- Total tickets processed: 1
-- Existing tickets will have their tokens updated while preserving entry data