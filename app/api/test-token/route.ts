import { NextRequest, NextResponse } from 'next/server';
import { decodeToken } from '@/lib/tokens';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    console.log('Testing token:', token);
    
    const decoded = decodeToken(token);
    console.log('Decoded result:', decoded);

    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    return NextResponse.json({
      token,
      decoded,
      eventId: decoded.eventId,
      ticketId: decoded.ticketId,
      status: 'valid'
    });

  } catch (error) {
    console.error('Token test error:', error);
    return NextResponse.json({ 
      error: 'Token test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}