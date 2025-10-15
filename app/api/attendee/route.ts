import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { decodeToken } from '@/lib/tokens';
import { sanitizeString, normalizePhone, parseJsonBody } from '@/lib/validation';

interface AttendeeRequest {
  token?: string;
  ticketId?: number;
  name?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ticketId, name, phone }: AttendeeRequest = parseJsonBody(body);

    if (!token && !ticketId) {
      return NextResponse.json(
        { error: 'Token or ticketId required' },
        { status: 400 }
      );
    }

    const db = getDB();
    let finalTicketId: number;
    
    if (token) {
      // Decode token to get ticket ID and event ID
      const decoded = decodeToken(token);
      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 400 }
        );
      }
      
      const { eventId, ticketId } = decoded;
      
      // Check if ticket exists, create if not
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
          { error: 'Ticket creation failed' },
          { status: 500 }
        );
      }
      
      finalTicketId = ticket.id;
    } else {
      finalTicketId = ticketId!;
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedPhone = phone ? normalizePhone(phone) : undefined;

  // Update attendee information
  const updatedTicket = await db.updateAttendeeInfo(
    finalTicketId,
    sanitizedName ?? undefined,
    sanitizedPhone
  );    if (!updatedTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get event information for the response
    const event = await db.getEventById(updatedTicket.event_id);

    // Return public ticket information (no sensitive data)
    return NextResponse.json({
      ticket: {
        id: updatedTicket.id,
        event_id: updatedTicket.event_id,
        event_name: event?.name || 'Unknown Event',
        attendee_name: updatedTicket.attendee_name,
        attendee_phone: updatedTicket.attendee_phone,
        entered_at: updatedTicket.entered_at,
        metadata_updated_at: updatedTicket.metadata_updated_at,
      },
    });

  } catch (error) {
    console.error('Attendee update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const ticketIdParam = url.searchParams.get('ticketId');

    if (!token && !ticketIdParam) {
      return NextResponse.json(
        { error: 'Token or ticketId required' },
        { status: 400 }
      );
    }

    const db = getDB();
    let ticket;

    if (token) {
      ticket = await db.getTicketByToken(token);
    } else if (ticketIdParam) {
      const ticketId = parseInt(ticketIdParam);
      if (isNaN(ticketId)) {
        return NextResponse.json(
          { error: 'Invalid ticketId' },
          { status: 400 }
        );
      }
      ticket = await db.getTicketById(ticketId);
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Get event information for the response
    const event = await db.getEventById(ticket.event_id);

    // Return public ticket information
    return NextResponse.json({
      ticket: {
        id: ticket.id,
        event_id: ticket.event_id,
        event_name: event?.name || 'Unknown Event',
        attendee_name: ticket.attendee_name,
        attendee_phone: ticket.attendee_phone,
        entered_at: ticket.entered_at,
        metadata_updated_at: ticket.metadata_updated_at,
      },
    });

  } catch (error) {
    console.error('Attendee get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}