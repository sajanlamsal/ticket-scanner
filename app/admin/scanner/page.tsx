'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { validateAndExtractToken } from '@/lib/qr-validation';

interface ScanResult {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  details?: any;
}

interface ScanMemory {
  url: string;
  result: ScanResult;
  timestamp: number;
}

export default function ScannerPage() {
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMemory, setScanMemory] = useState<ScanMemory | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Initial cleanup effect - runs once on mount
  useEffect(() => {
    console.log('Component mounted - performing initial cleanup');
    
    // Clean up any leftover HTML5-QRCode elements from previous instances
    const cleanupExistingElements = () => {
      const container = document.getElementById('qr-scanner-container');
      if (container) {
        container.innerHTML = '';
      }
      
      // Remove any orphaned video/canvas elements
      const orphanedElements = document.querySelectorAll('video[id*="qr"], canvas[id*="qr"], video[style*="qr"], canvas[style*="qr"]');
      orphanedElements.forEach(el => {
        console.log('Removing orphaned element:', el);
        el.remove();
      });
    };
    
    cleanupExistingElements();
  }, []);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const processingUrlRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(false);
  const initializingRef = useRef<boolean>(false);
  const router = useRouter();

  // Check camera permissions
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      // Stop the stream immediately, we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.log('Camera permission denied or not available:', error);
      return false;
    }
  };

  // Throttled scan handler to prevent spam
  const handleScanSuccess = useCallback(async (scannedText: string) => {
    const now = Date.now();
    
    // Get current values from refs/state to avoid stale closures
    const currentMemory = scanMemory;
    const currentProcessing = isProcessing;
    
    // 1. Rate limiting - prevent spam (max 1 scan per 500ms for new URLs)
    if (scannedText !== currentMemory?.url && now - lastScanTimeRef.current < 500) {
      return;
    }
    
    // 2. Prevent duplicate processing
    if (currentProcessing && processingUrlRef.current === scannedText) {
      return;
    }

    // 3. Handle memorized scans (instant feedback)
    if (currentMemory?.url === scannedText) {
      setCurrentResult(currentMemory.result);
      return;
    }

    // 4. Process new scan
    lastScanTimeRef.current = now;
    processingUrlRef.current = scannedText;
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      // Validate token format first (instant)
      const validation = validateAndExtractToken(scannedText);
      
      if (!validation.isValid) {
        const errorResult: ScanResult = {
          type: 'error',
          title: '❌ Invalid Ticket',
          message: `Scanned: ${scannedText}`
        };
        
        setScanMemory({ url: scannedText, result: errorResult, timestamp: now });
        setCurrentResult(errorResult);
        setIsProcessing(false);
        processingUrlRef.current = '';
        return;
      }

      // Server validation
      const adminToken = localStorage.getItem('adminToken');
      const response = await fetch('/api/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ token: validation.token }),
      });

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

    } catch (error) {
      const errorResult: ScanResult = {
        type: 'error',
        title: '❌ Processing Failed',
        message: 'Network or server error'
      };
      
      setScanMemory({ url: scannedText, result: errorResult, timestamp: now });
      setCurrentResult(errorResult);
    } finally {
      setIsProcessing(false);
      processingUrlRef.current = '';
    }
  }, []); // No dependencies to prevent recreation

  // Scanner initialization with auto permission handling
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    const initializeScanner = async () => {
      // Prevent multiple initializations with multiple checks
      if (initializingRef.current || scannerRef.current || !isMountedRef.current) {
        console.log('Scanner initialization blocked - already initializing, exists, or unmounted');
        return;
      }

      initializingRef.current = true;
      console.log('Starting scanner initialization...');

      try {
        // Force clear any existing HTML5-QRCode instances
        const existingElements = document.querySelectorAll('#qr-scanner-container video, #qr-scanner-container canvas');
        existingElements.forEach(el => el.remove());

        setScannerError('');
        
        // Clear container completely
        const container = document.getElementById('qr-scanner-container');
        if (container) {
          container.innerHTML = '';
        }
        
        // Check camera permission first
        const hasPermission = await checkCameraPermission();
        setPermissionGranted(hasPermission);
        
        if (!hasPermission || !isMountedRef.current) {
          setScannerError('Camera permission required. Please allow camera access and refresh the page.');
          return;
        }

        // Wait for DOM to be ready and ensure component is still mounted
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMountedRef.current) {
          console.log('Component unmounted during initialization, aborting');
          return;
        }

        // Initialize scanner with proper configuration
        const config = {
          fps: 5,
          qrbox: { width: 550, height: 550 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          disableFlip: false,
        };

        console.log('Creating Html5QrcodeScanner instance...');
        scannerRef.current = new Html5QrcodeScanner(
          'qr-scanner-container',
          config,
          false
        );

        if (!isMountedRef.current || !scannerRef.current) {
          console.log('Component unmounted or scanner creation failed, aborting');
          return;
        }

        // Render scanner with proper error handling
        await scannerRef.current.render(
          handleScanSuccess,
          (error) => {
            // Only log actual errors, not normal scanning behavior
            if (error && !error.includes('NotFoundException')) {
              console.warn('QR scan error (non-critical):', error);
            }
          }
        );

        if (isMountedRef.current) {
          setScannerReady(true);
          setPermissionGranted(true);
          console.log('Scanner initialized successfully');
        }
        
      } catch (error) {
        console.error('Scanner initialization failed:', error);
        if (isMountedRef.current) {
          setScannerError(`Scanner failed to start: ${error}`);
          setPermissionGranted(false);
        }
      } finally {
        initializingRef.current = false;
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(initializeScanner, 100);

    return () => {
      console.log('Cleanup function called');
      isMountedRef.current = false;
      initializingRef.current = false;
      clearTimeout(timeoutId);
      
      if (scannerRef.current) {
        console.log('Cleaning up scanner...');
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      
      // Force cleanup of any HTML5-QRCode elements
      setTimeout(() => {
        const container = document.getElementById('qr-scanner-container');
        if (container) {
          container.innerHTML = '';
        }
        const existingElements = document.querySelectorAll('video[id*="qr"], canvas[id*="qr"]');
        existingElements.forEach(el => el.remove());
      }, 100);
    };
  }, [router]);

  // Auto-clear results after 6 seconds
  useEffect(() => {
    if (currentResult) {
      const timer = setTimeout(() => {
        setCurrentResult(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [currentResult]);

  const clearMemory = () => {
    setScanMemory(null);
    setCurrentResult(null);
    lastScanTimeRef.current = 0;
  };

  const retryCamera = async () => {
    setScannerError('');
    setScannerReady(false);
    setPermissionGranted(null);
    
    // Clear existing scanner completely
    if (scannerRef.current) {
      await scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    
    // Clear container
    const container = document.getElementById('qr-scanner-container');
    if (container) {
      container.innerHTML = '';
    }
    
    // Reinitialize after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">QR Scanner</h1>
            <div className="flex gap-2">
              <button
                onClick={clearMemory}
                className="bg-gray-500 text-white px-3 py-2 rounded text-sm hover:bg-gray-600"
              >
                Clear {scanMemory ? '(1)' : '(0)'}
              </button>
              <button
                onClick={() => router.push('/admin/tickets')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Tickets
              </button>
            </div>
          </div>

          {/* Scanner Status */}
          <div className="mb-4">
            {scannerError ? (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-600">
                  <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm">{scannerError}</span>
                </div>
                <button
                  onClick={retryCamera}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            ) : !scannerReady ? (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span>
                  {permissionGranted === null ? 'Requesting camera access...' : 
                   permissionGranted === false ? 'Camera access denied' :
                   'Starting camera...'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Camera ready • Point at QR code</span>
                {isProcessing && <span className="text-orange-600">• Processing...</span>}
              </div>
            )}
          </div>

          {/* Scanner Container */}
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <div id="qr-scanner-container" className="min-h-[400px]" />
          </div>

          {/* Result Display - Fixed position, no flickering */}
          <div className="mt-4 h-32">
            {currentResult && (
              <div className={`p-4 rounded-lg border ${
                currentResult.type === 'success' ? 'bg-green-50 border-green-200' :
                currentResult.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              } transition-all duration-300 ease-in-out`}>
                <h3 className="font-bold text-lg mb-1">{currentResult.title}</h3>
                <p className="text-sm opacity-75 mb-2">{currentResult.message}</p>
                
                {currentResult.details && (
                  <div className="text-xs space-y-1 opacity-60">
                    {currentResult.details.eventName && <div>Event: {currentResult.details.eventName}</div>}
                    {currentResult.details.ticketId && <div>Ticket: #{currentResult.details.ticketId}</div>}
                    {currentResult.details.attendee_name && <div>Name: {currentResult.details.attendee_name}</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual Entry Fallback */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <details className="cursor-pointer">
              <summary className="text-sm font-medium text-gray-600 hover:text-gray-800">
                Manual Token Entry (Backup)
              </summary>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Enter token manually (e.g., 95WhBX)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const token = e.currentTarget.value.trim();
                      if (token) {
                        handleScanSuccess(token);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Press Enter after typing token
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}