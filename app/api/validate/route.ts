import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { requireAuth } from '@/lib/auth';
import { decodeToken } from '@/lib/tokens';
import { parseJsonBody } from '@/lib/validation';

interface ValidateRequest {
  token?: string;
  ticketId?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const auth = requireAuth(request);
    
    const body = await request.json();
    const { token, ticketId }: ValidateRequest = parseJsonBody(body);

    if (!token && !ticketId) {
      return NextResponse.json(
        { ok: false, error: 'Token or ticketId required' },
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
          { ok: false, error: 'invalid_token' },
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
            { ok: false, error: 'event_not_found' },
            { status: 404 }
          );
        }

        try {
          await db.insertOrUpdateTicket(ticketId, token, eventId);
          ticket = await db.getTicketByToken(token);
        } catch (error) {
          console.error('Error creating ticket entry:', error);
          return NextResponse.json(
            { ok: false, error: 'failed_to_create_ticket' },
            { status: 500 }
          );
        }
      }
      
      if (!ticket) {
        return NextResponse.json(
          { ok: false, error: 'ticket_creation_failed' },
          { status: 500 }
        );
      }
      
      if (ticket.id !== ticketId || ticket.event_id !== eventId) {
        return NextResponse.json(
          { ok: false, error: 'token_mismatch' },
          { status: 400 }
        );
      }
      
      finalTicketId = ticket.id;
    } else {
      finalTicketId = ticketId!;
    }

    // Attempt to mark ticket as entered
    const result = await db.markTicketEntered(finalTicketId, auth.email);
    
    if (!result.success || !result.ticket) {
      return NextResponse.json(
        { ok: false, error: 'ticket_not_found' },
        { status: 404 }
      );
    }

    if (result.alreadyEntered) {
      return NextResponse.json({
        ok: true,
        entered: false,
        alreadyEntered: true,
        ticketId: result.ticket.id,
        enteredAt: result.ticket.entered_at,
        enteredBy: result.ticket.entered_by,
      });
    }

    return NextResponse.json({
      ok: true,
      entered: true,
      ticketId: result.ticket.id,
      enteredAt: result.ticket.entered_at,
    });

  } catch (error: any) {
    console.error('Validate error:', error);
    
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}