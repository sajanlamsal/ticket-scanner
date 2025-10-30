'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { validateAndExtractToken } from '@/lib/qr-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, FileText, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

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

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const processingUrlRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(false);
  const initializingRef = useRef<boolean>(false);
  const router = useRouter();

  // Initial cleanup effect - runs once on mount
  useEffect(() => {
    const cleanupExistingElements = () => {
      const container = document.getElementById('qr-scanner-container');
      if (container) {
        container.innerHTML = '';
      }
      
      const orphanedElements = document.querySelectorAll('video[id*="qr"], canvas[id*="qr"], video[style*="qr"], canvas[style*="qr"]');
      orphanedElements.forEach(el => {
        try {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (e) {
          // Ignore
        }
      });
    };
    
    cleanupExistingElements();
  }, []);

  // Check camera permissions
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      return false;
    }
  };

  // Use ref to store the scan handler - prevents infinite loops
  const handleScanSuccessRef = useRef<(scannedText: string) => Promise<void>>();
  
  handleScanSuccessRef.current = async (scannedText: string) => {
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
  };

  // Stable callback wrapper for manual entry
  const handleScanSuccess = useCallback(async (scannedText: string) => {
    if (handleScanSuccessRef.current) {
      await handleScanSuccessRef.current(scannedText);
    }
  }, []);

  // Scanner initialization
  useEffect(() => {
    isMountedRef.current = true;

    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    const initializeScanner = async () => {
      if (initializingRef.current || scannerRef.current || !isMountedRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        // Force clear any existing HTML5-QRCode instances
        const existingElements = document.querySelectorAll('#qr-scanner-container video, #qr-scanner-container canvas');
        existingElements.forEach(el => {
          try {
            if (el.parentNode) el.parentNode.removeChild(el);
          } catch (e) { /* ignore */ }
        });

        setScannerError('');
        
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

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!isMountedRef.current) {
          return;
        }

        // Calculate responsive qrbox size based on container width
        const containerElement = document.getElementById('qr-scanner-container');
        const containerWidth = containerElement?.clientWidth || 400;
        // Use 70% of container width, capped between 200px and 400px
        const qrboxSize = Math.min(400, Math.max(200, Math.floor(containerWidth * 0.7)));

        // Initialize scanner
        const config = {
          fps: 10,
          qrbox: qrboxSize, // Use calculated size for both width and height
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          disableFlip: false,
        };

        scannerRef.current = new Html5QrcodeScanner(
          'qr-scanner-container',
          config,
          false
        );

        if (!isMountedRef.current || !scannerRef.current) {
          return;
        }

        // Render scanner - use ref directly to avoid closure issues
        scannerRef.current.render(
          (decodedText) => {
            if (handleScanSuccessRef.current) {
              handleScanSuccessRef.current(decodedText);
            }
          },
          (error) => {
            // Only log actual errors, not normal scanning behavior
            if (error && 
                !error.includes('NotFoundException') && 
                !error.includes('No barcode or QR code detected')) {
              console.warn('QR scan error:', error);
            }
          }
        );

        // Auto-click permission button if needed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let attempts = 0;
        const maxAttempts = 20;
        let videoElement = null;
        
        while (!videoElement && attempts < maxAttempts && isMountedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 250));
          
          videoElement = document.querySelector('#qr-scanner-container video');
          const permissionBtn = document.querySelector('#html5-qrcode-button-camera-permission');
          const startBtn = document.querySelector('#html5-qrcode-button-camera-start');
          
          attempts++;
          
          // Auto-click permission button
          if (permissionBtn && !videoElement) {
            (permissionBtn as HTMLElement).click();
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }
          
          // Auto-click start button
          if (startBtn && !videoElement) {
            (startBtn as HTMLElement).click();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }

        if (isMountedRef.current) {
          setScannerReady(true);
          setPermissionGranted(true);
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

    const timeoutId = setTimeout(initializeScanner, 100);

    return () => {
      isMountedRef.current = false;
      initializingRef.current = false;
      clearTimeout(timeoutId);
      
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      
      setTimeout(() => {
        const container = document.getElementById('qr-scanner-container');
        if (container) {
          container.innerHTML = '';
        }
        const existingElements = document.querySelectorAll('video[id*="qr"], canvas[id*="qr"]');
        existingElements.forEach(el => {
          try {
            if (el.parentNode) el.parentNode.removeChild(el);
          } catch (e) { /* ignore */ }
        });
      }, 100);
    };
  }, [router]); // ONLY router - no handleScanSuccess to prevent infinite loop

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
    
    if (scannerRef.current) {
      await scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    
    const container = document.getElementById('qr-scanner-container');
    if (container) {
      container.innerHTML = '';
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-6 h-6" />
                QR Scanner
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearMemory}
                >
                  Clear {scanMemory ? '(1)' : '(0)'}
                </Button>
                <Button
                  onClick={() => router.push('/admin/tickets')}
                  size="sm"
                  className="hidden sm:flex"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Tickets
                </Button>
                <Button
                  onClick={() => router.push('/admin/tickets')}
                  size="sm"
                  className="sm:hidden"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">

            {/* Scanner Status */}
            <div className="mb-4">
              {scannerError ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg p-3 gap-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{scannerError}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={retryCamera}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : !scannerReady ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="animate-pulse">
                    <Clock className="w-3 h-3 mr-1" />
                    <span className="text-xs sm:text-sm">
                      {permissionGranted === null ? 'Requesting camera access...' : 
                       permissionGranted === false ? 'Camera access denied' :
                       'Starting camera...'}
                    </span>
                  </Badge>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="text-xs sm:text-sm">Camera ready • Point at QR code</span>
                  </Badge>
                  {isProcessing && (
                    <Badge variant="secondary" className="animate-pulse">
                      <span className="text-xs sm:text-sm">Processing...</span>
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Scanner Container */}
            <div className="border rounded-lg overflow-hidden bg-muted/50">
              <div id="qr-scanner-container" className="min-h-[300px] sm:min-h-[400px]" />
            </div>

            {/* Result Display - Fixed position, no flickering */}
            <div className="mt-4 min-h-[80px] sm:min-h-[128px]">
              {currentResult && (
                <Card className={`transition-all duration-300 ease-in-out ${
                  currentResult.type === 'success' ? 'border-green-200 bg-green-50/50' :
                  currentResult.type === 'warning' ? 'border-yellow-200 bg-yellow-50/50' :
                  'border-destructive/20 bg-destructive/5'
                }`}>
                  <CardContent className="p-3 sm:p-4">
                    <h3 className="font-bold text-base sm:text-lg mb-1">{currentResult.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-2">{currentResult.message}</p>
                    
                    {currentResult.details && (
                      <div className="text-xs space-y-1 text-muted-foreground">
                        {currentResult.details.eventName && <div>Event: {currentResult.details.eventName}</div>}
                        {currentResult.details.ticketId && <div>Ticket: #{currentResult.details.ticketId}</div>}
                        {currentResult.details.attendee_name && <div>Name: {currentResult.details.attendee_name}</div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Manual Entry Fallback */}
            <div className="mt-6 pt-6 border-t">
              <details className="cursor-pointer">
                <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Manual Token Entry (Backup)
                </summary>
                <div className="mt-3 space-y-2">
                  <Input
                    type="text"
                    placeholder="Enter token manually (e.g., 95WhBX)"
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
                  <p className="text-xs text-muted-foreground">
                    Press Enter after typing token
                  </p>
                </div>
              </details>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}