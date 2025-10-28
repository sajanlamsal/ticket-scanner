import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { decodeToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // First, decode the token to get the ticket ID and event ID
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    const { eventId, ticketId } = decoded;
    const db = getDB();
    
    // Check if ticket already exists in database
    let ticket = await db.getTicketByToken(token);
    
    if (!ticket) {
      // Verify that the event exists
      const event = await db.getEventById(eventId);
      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      // Create the ticket entry if it doesn't exist
      try {
        await db.insertOrUpdateTicket(ticketId, token, eventId);
        ticket = await db.getTicketByToken(token);
      } catch (error) {
        console.error('Error creating ticket entry:', error);
        return NextResponse.json(
          { error: 'Failed to create ticket entry' },
          { status: 500 }
        );
      }
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get event information
    const event = await db.getEventById(ticket.event_id);

    // Return public ticket information (no token or sensitive data)
    return NextResponse.json({
      id: ticket.id,
      event_id: ticket.event_id,
      event_name: event?.name || 'Unknown Event',
      entered_at: ticket.entered_at,
      attendee_name: ticket.attendee_name,
      attendee_phone: ticket.attendee_phone,
      metadata_updated_at: ticket.metadata_updated_at,
    });

  } catch (error) {
    console.error('Ticket lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}