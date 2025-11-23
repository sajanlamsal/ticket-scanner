/**
 * Configuration for QR code validation
 */
export const QR_CONFIG = {
  // Valid domain for ticket QR codes (from environment)
  VALID_DOMAIN: process.env.NEXT_PUBLIC_VALID_DOMAIN || 'localhost:3000',
  
  // Valid path pattern for ticket URLs
  VALID_PATH: '/entry/',
  
  // Token format validation (6-10 alphanumeric characters)
  TOKEN_PATTERN: /^[a-zA-Z0-9]{6,10}$/,
  
  // Online ticket pattern (numeric only)
  ONLINE_TICKET_PATTERN: /^\d+$/,
  
  // Error messages
  MESSAGES: {
    INVALID_TICKET: '❌ Invalid Ticket'
  },

  // Helper function to create error message with scanned content
  getInvalidMessage: (scannedContent: string) => {
    return `❌ Invalid Ticket\n\nScanned: ${scannedContent}`;
  }
};

/**
 * Validate and extract token from scanned QR code
 */
export function validateAndExtractToken(scannedText: string): {
  isValid: boolean;
  token?: string;
  ticketType?: 'token' | 'online';
  errorMessage?: string;
} {
  const trimmedText = scannedText.trim();

  // Check if it's an online ticket (numeric only)
  if (trimmedText.match(QR_CONFIG.ONLINE_TICKET_PATTERN)) {
    return { 
      isValid: true, 
      token: trimmedText,
      ticketType: 'online'
    };
  }

  // Direct token format
  if (trimmedText.match(QR_CONFIG.TOKEN_PATTERN)) {
    return { 
      isValid: true, 
      token: trimmedText,
      ticketType: 'token'
    };
  }

  // URL format validation
  if (trimmedText.includes(QR_CONFIG.VALID_PATH)) {
    try {
      const url = new URL(trimmedText);
      const scannedDomain = url.host;
      
      // Check domain
      if (scannedDomain !== QR_CONFIG.VALID_DOMAIN) {
        return {
          isValid: false,
          errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
        };
      }

      // Check path and extract token
      const urlParts = trimmedText.split(QR_CONFIG.VALID_PATH);
      if (urlParts.length > 1) {
        const token = urlParts[1];
        
        // Validate token format
        if (token.match(QR_CONFIG.TOKEN_PATTERN)) {
          return { 
            isValid: true, 
            token,
            ticketType: 'token'
          };
        } else {
          return {
            isValid: false,
            errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
          };
        }
      } else {
        return {
          isValid: false,
          errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
        };
      }
    } catch (urlError) {
      return {
        isValid: false,
        errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
      };
    }
  }

  // Handle other URL formats
  if (trimmedText.startsWith('http')) {
    return {
      isValid: false,
      errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
    };
  }

  // Not a recognized format
  return {
    isValid: false,
    errorMessage: QR_CONFIG.getInvalidMessage(trimmedText)
  };
}