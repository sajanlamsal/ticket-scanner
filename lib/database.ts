import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

export interface Event {
  id: number;
  name: string;
  description?: string | null;
  event_date?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TicketEntry {
  id: number;
  event_id: number;
  token: string;
  created_at: string;
  entered_at?: string | null;
  entered_by?: string | null;
  attendee_name?: string | null;
  attendee_phone?: string | null;
  metadata_updated_at?: string | null;
}

export interface AdminUser {
  id: number;
  email: string;
  password_hash: string;
  display_name?: string | null;
  created_at: string;
}

class DatabaseManager {
  private sqlite?: Database.Database;
  private postgres?: Pool;
  private dbType: 'sqlite' | 'postgres';

  constructor() {
    this.dbType = (process.env.DATABASE_TYPE as 'sqlite' | 'postgres') || 'sqlite';
    this.initializeDatabase();
  }

  private initializeDatabase() {
    if (this.dbType === 'sqlite') {
      const dbPath = process.env.DATABASE_PATH || './data/tickets.db';
      const dbDir = path.dirname(dbPath);
      
      // Ensure data directory exists
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.sqlite = new Database(dbPath);
      this.sqlite.pragma('journal_mode = WAL');
      
      // Create tables if they don't exist
      const schema = fs.readFileSync(path.join(process.cwd(), 'db/sql/sqlite_create_tables.sql'), 'utf-8');
      this.sqlite.exec(schema);
    } else {
      this.postgres = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
  }

  // Ticket operations
  async getTicketByToken(token: string): Promise<TicketEntry | null> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare('SELECT * FROM ticket_entry WHERE token = ?');
      return stmt.get(token) as TicketEntry | undefined || null;
    } else if (this.postgres) {
      const result = await this.postgres.query('SELECT * FROM ticket_entry WHERE token = $1', [token]);
      return result.rows[0] || null;
    }
    throw new Error('Database not initialized');
  }

  async getTicketById(id: number): Promise<TicketEntry | null> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare('SELECT * FROM ticket_entry WHERE id = ?');
      return stmt.get(id) as TicketEntry | undefined || null;
    } else if (this.postgres) {
      const result = await this.postgres.query('SELECT * FROM ticket_entry WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    throw new Error('Database not initialized');
  }

  async insertOrUpdateTicket(id: number, token: string, eventId: number = 1): Promise<void> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(`
        INSERT OR REPLACE INTO ticket_entry (id, event_id, token, created_at)
        VALUES (?, ?, ?, COALESCE((SELECT created_at FROM ticket_entry WHERE id = ? AND event_id = ?), CURRENT_TIMESTAMP))
      `);
      stmt.run(id, eventId, token, id, eventId);
    } else if (this.postgres) {
      await this.postgres.query(`
        INSERT INTO ticket_entry (id, event_id, token, created_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (id, event_id) DO UPDATE SET token = EXCLUDED.token
      `, [id, eventId, token]);
    } else {
      throw new Error('Database not initialized');
    }
  }

  async markTicketEntered(ticketId: number, adminEmail: string): Promise<{ success: boolean; alreadyEntered: boolean; ticket: TicketEntry | null }> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      return this.sqlite.transaction(() => {
        // Use immediate transaction to prevent write races
        const getStmt = this.sqlite!.prepare('SELECT * FROM ticket_entry WHERE id = ?');
        const ticket = getStmt.get(ticketId) as TicketEntry | undefined;
        
        if (!ticket) {
          return { success: false, alreadyEntered: false, ticket: null };
        }

        if (ticket.entered_at) {
          return { success: true, alreadyEntered: true, ticket };
        }

        const updateStmt = this.sqlite!.prepare(`
          UPDATE ticket_entry 
          SET entered_at = CURRENT_TIMESTAMP, entered_by = ?
          WHERE id = ? AND entered_at IS NULL
        `);
        
        const result = updateStmt.run(adminEmail, ticketId);
        
        if (result.changes > 0) {
          const updatedTicket = getStmt.get(ticketId) as TicketEntry;
          return { success: true, alreadyEntered: false, ticket: updatedTicket };
        }

        // Race condition - someone else marked it
        const finalTicket = getStmt.get(ticketId) as TicketEntry;
        return { success: true, alreadyEntered: true, ticket: finalTicket };
      })();
    } else if (this.postgres) {
      const client = await this.postgres.connect();
      try {
        await client.query('BEGIN');
        
        const selectResult = await client.query(
          'SELECT * FROM ticket_entry WHERE id = $1 FOR UPDATE',
          [ticketId]
        );
        
        const ticket = selectResult.rows[0];
        if (!ticket) {
          await client.query('ROLLBACK');
          return { success: false, alreadyEntered: false, ticket: null };
        }

        if (ticket.entered_at) {
          await client.query('ROLLBACK');
          return { success: true, alreadyEntered: true, ticket };
        }

        const updateResult = await client.query(
          'UPDATE ticket_entry SET entered_at = now(), entered_by = $1 WHERE id = $2 AND entered_at IS NULL RETURNING *',
          [adminEmail, ticketId]
        );

        await client.query('COMMIT');
        
        if (updateResult.rows.length > 0) {
          return { success: true, alreadyEntered: false, ticket: updateResult.rows[0] };
        }

        // Race condition handled
        return { success: true, alreadyEntered: true, ticket };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    throw new Error('Database not initialized');
  }

  async updateAttendeeInfo(ticketId: number, name?: string, phone?: string): Promise<TicketEntry | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updates.push(`attendee_name = ${this.dbType === 'sqlite' ? '?' : `$${paramCount}`}`);
      values.push(name);
    }

    if (phone !== undefined) {
      paramCount++;
      updates.push(`attendee_phone = ${this.dbType === 'sqlite' ? '?' : `$${paramCount}`}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      return this.getTicketById(ticketId);
    }

    paramCount++;
    const timestampParam = this.dbType === 'sqlite' ? 'CURRENT_TIMESTAMP' : 'now()';
    updates.push(`metadata_updated_at = ${timestampParam}`);

    paramCount++;
    values.push(ticketId);

    const query = `
      UPDATE ticket_entry 
      SET ${updates.join(', ')}
      WHERE id = ${this.dbType === 'sqlite' ? '?' : `$${paramCount}`}
    `;

    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(query);
      stmt.run(...values);
      return this.getTicketById(ticketId);
    } else if (this.postgres) {
      await this.postgres.query(query, values);
      return this.getTicketById(ticketId);
    }
    
    throw new Error('Database not initialized');
  }

  // Event operations
  async getEventById(eventId: number): Promise<Event | null> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare('SELECT * FROM events WHERE id = ?');
      return stmt.get(eventId) as Event | undefined || null;
    } else if (this.postgres) {
      const result = await this.postgres.query('SELECT * FROM events WHERE id = $1', [eventId]);
      return result.rows[0] || null;
    }
    throw new Error('Database not initialized');
  }

  async getActiveEvents(): Promise<Event[]> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare('SELECT * FROM events WHERE is_active = 1 ORDER BY id');
      return stmt.all() as Event[];
    } else if (this.postgres) {
      const result = await this.postgres.query('SELECT * FROM events WHERE is_active = true ORDER BY id');
      return result.rows;
    }
    throw new Error('Database not initialized');
  }

  async createEvent(name: string, description?: string, eventDate?: string): Promise<Event> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(`
        INSERT INTO events (name, description, event_date)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, description, eventDate);
      const getStmt = this.sqlite.prepare('SELECT * FROM events WHERE id = ?');
      return getStmt.get(result.lastInsertRowid) as Event;
    } else if (this.postgres) {
      const result = await this.postgres.query(
        'INSERT INTO events (name, description, event_date) VALUES ($1, $2, $3) RETURNING *',
        [name, description, eventDate]
      );
      return result.rows[0];
    }
    throw new Error('Database not initialized');
  }

  // Admin operations
  async getAdminByEmail(email: string): Promise<AdminUser | null> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare('SELECT * FROM admin_user WHERE email = ?');
      return stmt.get(email) as AdminUser | undefined || null;
    } else if (this.postgres) {
      const result = await this.postgres.query('SELECT * FROM admin_user WHERE email = $1', [email]);
      return result.rows[0] || null;
    }
    throw new Error('Database not initialized');
  }

  async createAdmin(email: string, passwordHash: string, displayName?: string): Promise<AdminUser> {
    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(`
        INSERT INTO admin_user (email, password_hash, display_name)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(email, passwordHash, displayName);
      const getStmt = this.sqlite.prepare('SELECT * FROM admin_user WHERE id = ?');
      return getStmt.get(result.lastInsertRowid) as AdminUser;
    } else if (this.postgres) {
      const result = await this.postgres.query(
        'INSERT INTO admin_user (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *',
        [email, passwordHash, displayName]
      );
      return result.rows[0];
    }
    throw new Error('Database not initialized');
  }

  async getTickets(filter?: { entered?: boolean; search?: string }, limit = 50, offset = 0): Promise<TicketEntry[]> {
    let query = 'SELECT * FROM ticket_entry WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filter?.entered === true) {
      query += ` AND entered_at IS NOT NULL`;
    } else if (filter?.entered === false) {
      query += ` AND entered_at IS NULL`;
    }

    if (filter?.search) {
      paramCount++;
      if (this.dbType === 'sqlite') {
        query += ` AND (CAST(id AS TEXT) LIKE ? OR token LIKE ?)`;
        params.push(`%${filter.search}%`, `%${filter.search}%`);
        paramCount++;
      } else {
        query += ` AND (CAST(id AS TEXT) LIKE $${paramCount} OR token LIKE $${paramCount + 1})`;
        params.push(`%${filter.search}%`, `%${filter.search}%`);
        paramCount++;
      }
    }

    query += ` ORDER BY id DESC`;
    
    if (this.dbType === 'sqlite') {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    } else {
      paramCount++;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
    }

    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(query);
      return stmt.all(...params) as TicketEntry[];
    } else if (this.postgres) {
      const result = await this.postgres.query(query, params);
      return result.rows;
    }
    
    throw new Error('Database not initialized');
  }

  async getTicketsCount(filter?: { entered?: boolean; search?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM ticket_entry WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filter?.entered === true) {
      query += ` AND entered_at IS NOT NULL`;
    } else if (filter?.entered === false) {
      query += ` AND entered_at IS NULL`;
    }

    if (filter?.search) {
      paramCount++;
      if (this.dbType === 'sqlite') {
        query += ` AND (CAST(id AS TEXT) LIKE ? OR token LIKE ?)`;
        params.push(`%${filter.search}%`, `%${filter.search}%`);
        paramCount++;
      } else {
        query += ` AND (CAST(id AS TEXT) LIKE $${paramCount} OR token LIKE $${paramCount + 1})`;
        params.push(`%${filter.search}%`, `%${filter.search}%`);
        paramCount++;
      }
    }

    if (this.dbType === 'sqlite' && this.sqlite) {
      const stmt = this.sqlite.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } else if (this.postgres) {
      const result = await this.postgres.query(query, params);
      return parseInt(result.rows[0].count);
    }
    
    throw new Error('Database not initialized');
  }

  async close() {
    if (this.sqlite) {
      this.sqlite.close();
    }
    if (this.postgres) {
      await this.postgres.end();
    }
  }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;

export function getDB(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}