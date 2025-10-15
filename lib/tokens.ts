import Hashids from 'hashids';

const hashids = new Hashids(process.env.TICKET_SECRET || 'fallback_secret', 6);

export function generateToken(ticketId: number, eventId: number = 1): string {
  return hashids.encode(eventId, ticketId);
}

export function decodeToken(token: string): { eventId: number; ticketId: number } | null {
  try {
    const decoded = hashids.decode(token);
    if (decoded.length === 2 && typeof decoded[0] === 'number' && typeof decoded[1] === 'number') {
      return { eventId: decoded[0], ticketId: decoded[1] };
    }
    // Backwards compatibility: if only one number, assume eventId = 1
    if (decoded.length === 1 && typeof decoded[0] === 'number') {
      return { eventId: 1, ticketId: decoded[0] };
    }
    return null;
  } catch {
    return null;
  }
}

export function validateToken(token: string): boolean {
  return decodeToken(token) !== null;
}