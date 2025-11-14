'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { validateAndExtractToken } from '@/lib/qr-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, FileText, RefreshCw, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

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

  // Audio feedback function
  const playSuccessChime = useCallback(() => {
    try {
      // Create a simple success chime using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant success tone (C major chord)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      oscillator.type = 'sine';
      
      // Fade in and out
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
      // Clean up
      setTimeout(() => {
        try {
          audioContext.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 500);
    } catch (error) {
      // Silently fail if audio context not supported
      console.debug('Audio chime not supported:', error);
    }
  }, []);

  // Use ref to store the scan handler - prevents infinite loops
  const handleScanSuccessRef = useRef<(scannedText: string) => Promise<void>>();
  
  handleScanSuccessRef.current = async (scannedText: string) => {
    const now = Date.now();
    console.log('🔍 Scan initiated:', { scannedText, timestamp: now });
    
    // 1. Rate limiting - prevent spam (max 1 scan per 500ms for new URLs)
    if (scannedText !== scanMemory?.url && now - lastScanTimeRef.current < 500) {
      console.log('⏳ Rate limited, skipping scan');
      return;
    }
    
    // 2. Prevent duplicate processing
    if (isProcessing && processingUrlRef.current === scannedText) {
      console.log('🔄 Already processing this URL, skipping');
      return;
    }

    // 3. Handle memorized scans (instant feedback)
    if (scanMemory?.url === scannedText) {
      console.log('💾 Found in memory, using cached result:', scanMemory.result);
      setCurrentResult(scanMemory.result);
      return;
    }

    // 4. Process new scan
    console.log('🆕 Processing new scan');
    lastScanTimeRef.current = now;
    processingUrlRef.current = scannedText;
    setIsProcessing(true);
    setCurrentResult(null);

    try {
      // Extract token from URL or use as-is if already a token
      console.log('🔍 Extracting token from scanned text...');
      let token = scannedText.trim();
      
      // Check if it's a URL and extract the token part
      try {
        const url = new URL(scannedText);
        const pathParts = url.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 0) {
          token = lastPart;
          console.log('📎 Extracted token from URL:', token);
        }
      } catch (urlError) {
        // Not a URL, treat as direct token
        console.log('📝 Using scanned text as direct token');
      }

      // Validate token format
      console.log('🔍 Validating token format for:', token);
      const validation = validateAndExtractToken(token);
      console.log('✅ Token validation result:', validation);
      
      if (!validation.isValid) {
        console.log('❌ Token format invalid');
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
      console.log('🌐 Starting server validation for token:', validation.token || token);
      const adminToken = localStorage.getItem('adminToken');
      console.log('🔑 Admin token found:', !!adminToken);
      
      const requestPayload = { token: validation.token || token };
      console.log('📤 Sending request:', requestPayload);
      
      const response = await fetch('/api/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📊 Server response:', result);

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

      console.log('✨ Final scan result:', scanResult);
      setScanMemory({ url: scannedText, result: scanResult, timestamp: now });
      setCurrentResult(scanResult);

      // Play success chime for valid tickets (both new entries and already entered)
      if (result.success) {
        console.log('🔔 Playing success chime');
        playSuccessChime();
      }

    } catch (error) {
      console.error('💥 Scan processing error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        scannedText,
        processingUrl: processingUrlRef.current
      });
      
      const errorResult: ScanResult = {
        type: 'error',
        title: '❌ Processing Failed',
        message: `Network or server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      setScanMemory({ url: scannedText, result: errorResult, timestamp: now });
      setCurrentResult(errorResult);
    } finally {
      console.log('🏁 Scan processing complete, cleaning up');
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

        // Calculate responsive qrbox size - make it cover entire area on mobile
        const containerElement = document.getElementById('qr-scanner-container');
        const containerWidth = containerElement?.clientWidth || 400;
        const isMobile = window.innerWidth < 640;
        
        // Remove qrbox to use full camera feed as scan area
        // const qrboxSize = isMobile 
        //   ? Math.floor(containerWidth * 0.95) 
        //   : Math.min(400, Math.max(200, Math.floor(containerWidth * 0.7)));

        // Initialize scanner with mobile-optimized config
        const config = {
          fps: 10,
          // Remove qrbox to use entire camera feed as scan area
          // qrbox: qrboxSize,
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          disableFlip: false,
          videoConstraints: {
            facingMode: 'environment',
            // Use lower resolution on mobile to fit better in reduced height
            width: { ideal: isMobile ? 640 : 1280 },
            height: { ideal: isMobile ? 480 : 720 }
          }
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
        
        // Add CSS to optimize mobile scanner layout
        const style = document.createElement('style');
        style.id = 'qr-scanner-mobile-styles';
        style.textContent = `
          @media (max-width: 640px) {
            /* Make video fill container on mobile */
            #qr-scanner-container video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
            
            /* Remove extra padding/margins on mobile */
            #qr-scanner-container > div {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Remove scan box overlay since we're using full feed */
            #qr-scanner-container canvas {
              display: none !important;
            }
            
            /* Hide library's default footer on mobile to save space */
            #qr-scanner-container__dashboard_section_csr {
              display: none !important;
            }
          }
          
          /* Desktop - also remove scan box overlay */
          @media (min-width: 641px) {
            #qr-scanner-container canvas {
              display: none !important;
            }
          }
          
          /* Ensure container respects height constraints */
          #qr-scanner-container {
            display: flex !important;
            flex-direction: column !important;
          }
        `;
        
        // Remove old style if exists and add new one
        const oldStyle = document.getElementById('qr-scanner-mobile-styles');
        if (oldStyle) oldStyle.remove();
        document.head.appendChild(style);
        
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
      
      // Remove mobile styles on cleanup
      const mobileStyles = document.getElementById('qr-scanner-mobile-styles');
      if (mobileStyles) mobileStyles.remove();
      
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

            {/* Scanner Container with Loading Overlay - Half height on mobile */}
            <div className="border rounded-lg overflow-hidden bg-muted/50 relative">
              <div id="qr-scanner-container" className="min-h-[200px] max-h-[250px] sm:min-h-[400px] sm:max-h-none" />
              
              {/* Loading Overlay - Shows when processing */}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                  <div className="bg-white rounded-full p-3 sm:p-4 shadow-lg">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                  </div>
                </div>
              )}
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