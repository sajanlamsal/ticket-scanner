#!/usr/bin/env node

// Test script for validating the new multi-event token system
const Hashids = require('hashids/cjs');

const TICKET_SECRET = process.env.TICKET_SECRET || 'MnepThaya2025';

function generateToken(ticketId, eventId = 1) {
  const hashids = new Hashids(TICKET_SECRET, 6);
  return hashids.encode(eventId, ticketId);
}

function decodeToken(token) {
  try {
    const hashids = new Hashids(TICKET_SECRET, 6);
    const decoded = hashids.decode(token);
    
    if (!decoded || decoded.length === 0) {
      return null;
    }
    
    if (decoded.length === 1) {
      // Old format: just ticketId, assume eventId = 1
      return {
        eventId: 1,
        ticketId: decoded[0]
      };
    } else if (decoded.length === 2) {
      // New format: [eventId, ticketId]
      return {
        eventId: decoded[0],
        ticketId: decoded[1]
      };
    }
    
    return null;
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
}

console.log('=== Multi-Event Token System Test ===\n');

// Test new token generation
console.log('1. Testing Token Generation:');
for (let eventId = 1; eventId <= 2; eventId++) {
  for (let ticketId = 1; ticketId <= 3; ticketId++) {
    const token = generateToken(ticketId, eventId);
    console.log(`  Event ${eventId}, Ticket ${ticketId}: ${token}`);
  }
}

console.log('\n2. Testing Token Validation:');

// Test tokens from our CSV
const testTokens = [
  '95WhBX',  // Event 1, Ticket 3
  '1b5h8X',  // Event 1, Ticket 1
  'XAlhnq'   // Event 1, Ticket 5
];

testTokens.forEach(token => {
  const decoded = decodeToken(token);
  if (decoded) {
    console.log(`  Token ${token} -> Event ${decoded.eventId}, Ticket ${decoded.ticketId} ✓`);
  } else {
    console.log(`  Token ${token} -> INVALID ✗`);
  }
});

console.log('\n3. Testing Backwards Compatibility:');

// Test old format tokens (if any exist)
const oldFormatToken = generateToken(5); // Should default to eventId = 1
const oldDecoded = decodeToken(oldFormatToken);
console.log(`  Old format token: ${oldFormatToken} -> Event ${oldDecoded?.eventId}, Ticket ${oldDecoded?.ticketId}`);

console.log('\n4. Testing Different Events:');

// Generate tokens for different events
const event2Tokens = [];
for (let i = 1; i <= 3; i++) {
  const token = generateToken(i, 2);
  event2Tokens.push(token);
  const decoded = decodeToken(token);
  console.log(`  Event 2, Ticket ${i}: ${token} -> Event ${decoded?.eventId}, Ticket ${decoded?.ticketId}`);
}

console.log('\nAll tests completed!');