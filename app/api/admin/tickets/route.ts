import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate admin
    const auth = requireAuth(request);
    
    const url = new URL(request.url);
    const enteredFilter = url.searchParams.get('entered');
    const search = url.searchParams.get('q');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam) : 100;
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    let filter: { entered?: boolean; search?: string } = {};

    if (enteredFilter === 'true') {
      filter.entered = true;
    } else if (enteredFilter === 'false') {
      filter.entered = false;
    }

    if (search) {
      filter.search = search;
    }

    const db = getDB();
    const [tickets, totalCount] = await Promise.all([
      db.getTickets(filter, limit, offset),
      db.getTicketsCount(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      tickets,
      filter,
      pagination: {
        limit,
        offset,
        totalCount,
        totalPages,
        currentPage,
        hasMore: tickets.length === limit && offset + limit < totalCount,
        hasPrevious: offset > 0,
      },
    });

  } catch (error: any) {
    console.error('Admin tickets error:', error);
    
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}