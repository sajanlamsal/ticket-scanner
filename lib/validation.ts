export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with country code, keep it
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  
  return digits;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Basic validation - at least 10 digits
  return /^\+?\d{10,}$/.test(normalized);
}

export function sanitizeString(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  return input.trim().slice(0, 255) || null;
}

export function parseJsonBody<T>(body: any): T {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error('Invalid JSON');
    }
  }
  return body;
}