import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const payload = requireAuth(request);
    
    return NextResponse.json({
      success: true,
      payload,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Auth test error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Authentication failed',
        success: false 
      },
      { status: 401 }
    );
  }
}