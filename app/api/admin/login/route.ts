import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/database';
import { verifyPassword, signJWT } from '@/lib/auth';
import { validateEmail, parseJsonBody } from '@/lib/validation';

interface LoginRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password }: LoginRequest = parseJsonBody(body);

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get admin user
    const db = getDB();
    const admin = await db.getAdminByEmail(email);

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT
    const accessToken = signJWT({
      adminId: admin.id,
      email: admin.email,
    });

    // Return success response
    return NextResponse.json({
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.display_name,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}