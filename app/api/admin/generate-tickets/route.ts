import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateToken } from '@/lib/tokens';
import { getDB } from '@/lib/database';

interface GenerateRequest {
  eventId: number;
  ticketFrom: number;
  ticketTo: number;
}

interface GeneratedTicket {
  ticketId: number;
  eventId: number;
  token: string;
  qrUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const auth = requireAuth(request);
    
    const body = await request.json();
    let { eventId, ticketFrom, ticketTo }: GenerateRequest = body;

    // Validation
    if (!eventId || eventId < 1) {
      return NextResponse.json(
        { error: 'Valid event ID is required (>= 1)' },
        { status: 400 }
      );
    }

    if (!ticketFrom || ticketFrom < 1) {
      return NextResponse.json(
        { error: 'Valid ticket from number is required (>= 1)' },
        { status: 400 }
      );
    }

    if (!ticketTo || ticketTo < ticketFrom) {
      return NextResponse.json(
        { error: 'Ticket to must be greater than or equal to ticket from' },
        { status: 400 }
      );
    }

    const ticketCount = ticketTo - ticketFrom + 1;
    if (ticketCount > 520) {
      return NextResponse.json(
        { error: 'Maximum 520 tickets can be generated at once to prevent memory issues' },
        { status: 400 }
      );
    }

    const db = getDB();
    
    // Check if event exists, if not create it with specified ID
    let event = await db.getEventById(eventId);
    if (!event) {
      // For SQLite we can try to insert with specific ID, for PostgreSQL we'll need to handle differently
      try {
        if (db['dbType'] === 'sqlite' && db['sqlite']) {
          const stmt = db['sqlite'].prepare(`
            INSERT OR IGNORE INTO events (id, name, description, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `);
          stmt.run(eventId, `Event ${eventId}`, `Auto-generated event for ID ${eventId}`);
          event = await db.getEventById(eventId);
        } else {
          // For PostgreSQL, create event normally and use the auto-generated ID
          event = await db.createEvent(`Event ${eventId}`, `Auto-generated event for ID ${eventId}`);
          eventId = event.id; // Update eventId to use the actual created ID
        }
      } catch (error) {
        console.error('Error creating event:', error);
        return NextResponse.json(
          { error: 'Failed to create event' },
          { status: 500 }
        );
      }
    }

    // Get the host URL from request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Generate tickets (no database entries - created on-demand when scanned/accessed)
    const tickets: GeneratedTicket[] = [];
    const csvLines = ['ticketId,eventId,token,qrUrl'];

    for (let ticketId = ticketFrom; ticketId <= ticketTo; ticketId++) {
      // Generate token using our hashids algorithm
      const token = generateToken(ticketId, eventId);
      const qrUrl = `${baseUrl}/entry/${token}`;
      
      // No database storage during generation - tickets are created on-demand
      // when they are first scanned or accessed via /entry/{token}

      tickets.push({
        ticketId,
        eventId,
        token,
        qrUrl,
      });

      csvLines.push(`${ticketId},${eventId},${token},${qrUrl}`);
    }

    const csvContent = csvLines.join('\n');

    return NextResponse.json({
      success: true,
      tickets,
      csvContent,
      totalGenerated: tickets.length,
      eventId,
      ticketRange: `${ticketFrom}-${ticketTo}`,
      message: `Successfully generated ${tickets.length} ticket tokens for event ${eventId} (database entries created on-demand)`,
    });

  } catch (error) {
    console.error('Error generating tickets:', error);
    
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate tickets' },
      { status: 500 }
    );
  }
}