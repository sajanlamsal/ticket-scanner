import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { decodeToken } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required', success: false },
        { status: 400 }
      );
    }

    // Validate admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', success: false },
        { status: 401 }
      );
    }

    // First, decode the token to get the ticket ID and event ID
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token format', success: false },
        { status: 400 }
      );
    }

    const { eventId, ticketId } = decoded;
    const db = getDB();
    
    // Get admin info from JWT token (simplified - in production, verify JWT properly)
    const adminEmail = 'admin@example.com'; // TODO: Extract from JWT
    
    // Check if ticket already exists in database
    let ticket = await db.getTicketByToken(token);
    
    if (!ticket) {
      // Verify that the event exists
      const event = await db.getEventById(eventId);
      if (!event) {
        return NextResponse.json(
          { error: 'Event not found', success: false },
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
          { error: 'Failed to create ticket entry', success: false },
          { status: 500 }
        );
      }
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket creation failed', success: false },
        { status: 500 }
      );
    }

    // Check if already entered
    const alreadyEntered = !!ticket.entered_at;
    
    if (!alreadyEntered) {
      // Mark as entered
      const result = await db.markTicketEntered(ticketId, adminEmail);
      if (result.success) {
        ticket = result.ticket!;
      }
    }

    // Get event information
    const event = await db.getEventById(ticket.event_id);

    // Return success response with ticket details
    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      eventId: ticket.event_id,
      eventName: event?.name || 'Unknown Event',
      alreadyEntered,
      entered_at: ticket.entered_at,
      entered_by: ticket.entered_by,
      attendee_name: ticket.attendee_name,
      attendee_phone: ticket.attendee_phone,
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}