import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

export interface JWTPayload {
  adminId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET not configured');
  }
  
  return jwt.sign(payload, secret, {
    expiresIn: '6h',
    algorithm: 'HS256'
  });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new Error('ADMIN_JWT_SECRET not configured');
    }
    
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function requireAuth(request: NextRequest): JWTPayload {
  const token = extractTokenFromRequest(request);
  if (!token) {
    throw new Error('No token provided');
  }
  
  const payload = verifyJWT(token);
  if (!payload) {
    throw new Error('Invalid token');
  }
  
  return payload;
}