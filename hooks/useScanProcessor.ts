import { useRef, useState } from 'react';
import { validateAndExtractToken } from '@/lib/qr-validation';
import { useAudioFeedback } from './useAudioFeedback';

export interface ScanResult {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  details?: any;
}

export interface ScanMemory {
  url: string;
  result: ScanResult;
  timestamp: number;
}

export const useScanProcessor = () => {
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMemory, setScanMemory] = useState<ScanMemory | null>(null);
  
  const lastScanTimeRef = useRef<number>(0);
  const processingUrlRef = useRef<string>('');
  const { playSuccessChime } = useAudioFeedback();

  const processScan = async (scannedText: string) => {
    const now = Date.now();
    
    // 1. Rate limiting - prevent spam (max 1 scan per 500ms for new URLs)
    if (scannedText !== scanMemory?.url && now - lastScanTimeRef.current < 500) {
      return;
    }
    
    // 2. Prevent duplicate processing
    if (isProcessing && processingUrlRef.current === scannedText) {
      return;
    }

    // 3. Handle memorized scans (instant feedback)
    if (scanMemory?.url === scannedText) {
      setCurrentResult(scanMemory.result);
      return;
    }

    // 4. Process new scan
    lastScanTimeRef.current = now;
    processingUrlRef.current = scannedText;
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      // Extract token from URL or use as-is if already a token
      let token = scannedText.trim();
      
      // Check if it's a URL and extract the token part
      try {
        const url = new URL(scannedText);
        const pathParts = url.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 0) {
          token = lastPart;
        }
      } catch (urlError) {
        // Not a URL, treat as direct token
      }

      // Validate token format
      const validation = validateAndExtractToken(token);
      
      if (!validation.isValid) {
        const errorResult: ScanResult = {
          type: 'error',
          title: '❌ Invalid Ticket',
          message: `Invalid token: ${token}`
        };
        
        setScanMemory({ url: scannedText, result: errorResult, timestamp: now });
        setCurrentResult(errorResult);
        setIsProcessing(false);
        processingUrlRef.current = '';
        return;
      }

      // Server validation
      const adminToken = localStorage.getItem('adminToken');
      const requestPayload = { token: validation.token || token };
      
      const response = await fetch('/api/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(requestPayload),
      });
      
      if (!response.ok) {
        console.error('HTTP error:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      const scanResult: ScanResult = result.success ? {
        type: result.alreadyEntered ? 'warning' : 'success',
        title: result.alreadyEntered ? '⚠️ Already Entered' : '✅ Entry Recorded',
        message: result.alreadyEntered ? 'Previously scanned' : 'Entry successful',
        details: {
          eventName: result.eventName,
          ticketId: result.ticketId,
          attendee_name: result.attendee_name,
          entered_at: result.entered_at
        }
      } : {
        type: 'error',
        title: '❌ Invalid Ticket',
        message: result.error || 'Validation failed'
      };

      setScanMemory({ url: scannedText, result: scanResult, timestamp: now });
      setCurrentResult(scanResult);

      // Play success chime for valid tickets (both new entries and already entered)
      if (result.success) {
        playSuccessChime();
      }

    } catch (error) {
      console.error('Scan processing error:', error);
      
      const errorResult: ScanResult = {
        type: 'error',
        title: '❌ Processing Failed',
        message: `Network or server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      setScanMemory({ url: scannedText, result: errorResult, timestamp: now });
      setCurrentResult(errorResult);
    } finally {
      setIsProcessing(false);
      processingUrlRef.current = '';
    }
  };

  const clearMemory = () => {
    setScanMemory(null);
    setCurrentResult(null);
    lastScanTimeRef.current = 0;
  };

  return {
    currentResult,
    isProcessing,
    scanMemory,
    processScan,
    clearMemory,
    setCurrentResult
  };
};
