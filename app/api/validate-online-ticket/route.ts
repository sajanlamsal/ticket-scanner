import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const auth = requireAuth(request);

    const body = await request.json();
    const { ticketNumber } = body;

    if (!ticketNumber || typeof ticketNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid ticket number' },
        { status: 400 }
      );
    }

    const db = getDB();

    // Attempt to mark online ticket as entered
    const result = await db.markOnlineTicketEntered(ticketNumber);
    
    if (!result.success || !result.ticket) {
      return NextResponse.json({
        success: false,
        error: 'Online ticket not found'
      });
    }

    if (result.alreadyEntered) {
      return NextResponse.json({
        success: true,
        alreadyEntered: true,
        ticketNumber: result.ticket.online_ticket_number,
        entered_at: result.ticket.entered_at,
        ticketType: 'online'
      });
    }

    return NextResponse.json({
      success: true,
      alreadyEntered: false,
      ticketNumber: result.ticket.online_ticket_number,
      entered_at: result.ticket.entered_at,
      ticketType: 'online'
    });

  } catch (error: any) {
    console.error('Online ticket validation error:', error);
    
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
