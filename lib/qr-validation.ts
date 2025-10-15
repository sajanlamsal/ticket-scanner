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
  errorMessage?: string;
} {
  // Direct token format
  if (scannedText.match(QR_CONFIG.TOKEN_PATTERN)) {
    return { isValid: true, token: scannedText };
  }

  // URL format validation
  if (scannedText.includes(QR_CONFIG.VALID_PATH)) {
    try {
      const url = new URL(scannedText);
      const scannedDomain = url.host;
      
      // Check domain
      if (scannedDomain !== QR_CONFIG.VALID_DOMAIN) {
        return {
          isValid: false,
          errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
        };
      }

      // Check path and extract token
      const urlParts = scannedText.split(QR_CONFIG.VALID_PATH);
      if (urlParts.length > 1) {
        const token = urlParts[1];
        
        // Validate token format
        if (token.match(QR_CONFIG.TOKEN_PATTERN)) {
          return { isValid: true, token };
        } else {
          return {
            isValid: false,
            errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
          };
        }
      } else {
        return {
          isValid: false,
          errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
        };
      }
    } catch (urlError) {
      return {
        isValid: false,
        errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
      };
    }
  }

  // Handle other URL formats
  if (scannedText.startsWith('http')) {
    return {
      isValid: false,
      errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
    };
  }

  // Not a recognized format
  return {
    isValid: false,
    errorMessage: QR_CONFIG.getInvalidMessage(scannedText)
  };
}