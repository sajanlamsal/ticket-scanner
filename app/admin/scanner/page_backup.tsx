'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { validateAndExtractToken } from '@/lib/qr-validation';

interface ScanResult {
  token: string;
  ticketId?: number;
  eventId?: number;
  eventName?: string;
  alreadyEntered?: boolean;
  entered_at?: string;
  entered_by?: string;
  attendee_name?: string;
  attendee_phone?: string;
  success: boolean;
  message: string;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export default function ScannerPage() {
  // Add CSS for toast animation
  const toastStyles = `
    @keyframes slide-down {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    .animate-slide-down {
      animation: slide-down 0.3s ease-out;
    }
  `;
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [lastSuccessUrl, setLastSuccessUrl] = useState<string>('');
  const [lastErrorUrl, setLastErrorUrl] = useState<string>('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check admin authentication
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    // Auto-start scanner when page loads
    startScanner();

    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [router]);

  // Initialize scanner when isScanning becomes true
  useEffect(() => {
    if (isScanning) {
      initializeScanner();
    }
  }, [isScanning]);



  const startScanner = () => {
    setIsScanning(true);
    setError('');
    setCurrentToast(null);
    setLastSuccessUrl('');
    setLastErrorUrl('');
    setScannerReady(false);
  };

  const initializeScanner = () => {
    // Wait for the DOM element to be available
    setTimeout(() => {
      try {
        const element = document.getElementById('qr-scanner-container');
        if (!element) {
          setError('Scanner container not found. Please refresh the page and try again.');
          setIsScanning(false);
          return;
        }

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        };

        console.log('Initializing QR scanner...');
        
        scannerRef.current = new Html5QrcodeScanner(
          'qr-scanner-container',
          config,
          false
        );

        scannerRef.current.render(
          async (decodedText: string) => {
            console.log('QR Code detected:', decodedText);
            await handleScanSuccess(decodedText);
          },
          () => {
            // Mark scanner as ready after first scan attempt (even if failed)
            if (!scannerReady) {
              setScannerReady(true);
            }
            // No error logging - scanning errors are normal when no QR code is visible
          }
        );

        // Mark scanner as ready after a short delay
        setTimeout(() => {
          setScannerReady(true);
        }, 2000);

      } catch (err: any) {
        console.error('Scanner initialization error:', err);
        setError(`Scanner initialization failed: ${err.message}`);
        setIsScanning(false);
      }
    }, 200); // Longer delay to ensure DOM is ready
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
    setScannerReady(false);
  };

  const handleScanSuccess = async (scannedText: string) => {
    if (processing) return; // Prevent multiple simultaneous scans

    // Always show loader for 2 seconds
    setProcessing(true);
    
    // Check if we've already processed this exact URL
    const isRepeatScan = (scannedText === lastSuccessUrl || scannedText === lastErrorUrl);
    
    if (isRepeatScan) {
      // For repeat scans: Just show loader for 2 seconds, don't send server request
      setTimeout(() => {
        setProcessing(false);
        // Only show toast if not currently visible (don't replace existing toast)
        if (!currentToast) {
          if (scannedText === lastSuccessUrl) {
            addToast('success', '✅ Entry Recorded', 'Already processed successfully');
          } else if (scannedText === lastErrorUrl) {
            addToast('error', '❌ Invalid Ticket', 'Previously scanned - Invalid ticket');
          }
        }
      }, 2000);
      return;
    }

    // For new scans: Show loader for 2 seconds, then process server request
    setTimeout(async () => {
      try {
        // Validate and extract token using centralized utility
        const validation = validateAndExtractToken(scannedText);
        
        if (!validation.isValid) {
          setLastErrorUrl(scannedText);
          setLastSuccessUrl('');
          addToast('error', '❌ Invalid Ticket', validation.errorMessage || 'Please scan proper ticket QR code.');
          return;
        }

        const token = validation.token!;

        console.log('Processing token:', token);

        // Validate the token with the server
        const adminToken = localStorage.getItem('adminToken');
        const response = await fetch('/api/validate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
          setLastSuccessUrl(scannedText);
          setLastErrorUrl('');
          
          const toastType = result.alreadyEntered ? 'warning' : 'success';
          const toastTitle = result.alreadyEntered ? '⚠️ Already Entered' : '✅ Entry Recorded';
          const toastMessage = result.alreadyEntered 
            ? 'This ticket was already scanned!'
            : 'Entry recorded successfully!';
          
          const details = {
            eventName: result.eventName,
            ticketId: result.ticketId,
            eventId: result.eventId,
            attendee_name: result.attendee_name,
            attendee_phone: result.attendee_phone,
            entered_at: result.entered_at,
            entered_by: result.entered_by
          };

          addToast(toastType, toastTitle, toastMessage, details);
        } else {
          setLastErrorUrl(scannedText);
          setLastSuccessUrl('');
          addToast('error', '❌ Invalid Ticket', result.error || 'Invalid ticket');
        }
      } catch (err: any) {
        console.error('Scan processing error:', err);
        setLastErrorUrl(scannedText);
        setLastSuccessUrl('');
        addToast('error', '❌ Processing Failed', `Processing failed: ${err.message || 'Unknown error'}`);
      } finally {
        setProcessing(false);
      }
    }, 2000);
  };
  };

  // Toast management functions
  const addToast = (type: 'success' | 'error' | 'warning', title: string, message: string, details?: any) => {
    const toast: ToastMessage = {
      id: Date.now(),
      type,
      title,
      message,
      details,
      timestamp: new Date()
    };
    
    // Replace any existing toast with the new one
    setCurrentToast(toast);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setCurrentToast(prev => prev?.id === toast.id ? null : prev);
    }, 5000);
  };

  const removeToast = () => {
    setCurrentToast(null);
  };

  const resetScanner = () => {
    setError('');
    setProcessing(false);
    setCurrentToast(null);
    setLastSuccessUrl('');
    setLastErrorUrl('');
    if (!isScanning) {
      startScanner();
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-4">
      {/* Inject CSS for toast animations */}
      <style jsx>{toastStyles}</style>
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">QR Ticket Scanner</h1>
            <button
              onClick={() => router.push('/admin/tickets')}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              View All Tickets
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">Camera Error:</p>
              <p className="text-red-700">{error}</p>
              <p className="text-sm text-red-600 mt-2">
                💡 Try using manual token entry below, or check browser console for more details.
              </p>
            </div>
          )}

          {!isScanning && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Starting camera scanner...</p>
            </div>
          )}

          {isScanning && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Scanning for QR codes...</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLastSuccessUrl('');
                      setLastErrorUrl('');
                      setCurrentToast(null);
                    }}
                    className="bg-gray-500 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
                    title="Clear scan memory to allow re-scanning same codes"
                  >
                    Clear Memory
                  </button>
                  <button
                    onClick={stopScanner}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Stop Scanner
                  </button>
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50 relative">
                {!scannerReady && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing camera...</p>
                  </div>
                )}
                
                <div 
                  id="qr-scanner-container" 
                  className="w-full"
                  style={{ minHeight: '400px' }}
                />
                
                {scannerReady && !processing && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-blue-800 text-sm">
                      📷 Camera is active. Point your camera at a QR code to scan it.
                    </p>
                  </div>
                )}

                {/* Processing Overlay - covers the entire scanner area */}
                {processing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-800 font-medium">Processing scan...</p>
                      <p className="text-gray-600 text-sm mt-1">Please wait</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toast Overlay Container - positioned above camera */}
          {isScanning && currentToast && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
              <div
                key={currentToast.id}
                className={`p-4 rounded-lg border shadow-lg ${
                  currentToast.type === 'success' 
                    ? 'bg-green-50 border-green-200' 
                    : currentToast.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                } animate-slide-down`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm">{currentToast.title}</h3>
                  <button
                    onClick={() => removeToast()}
                    className="text-gray-500 hover:text-gray-700 ml-2"
                  >
                    ✕
                  </button>
                </div>
                
                <p className={`text-sm ${
                  currentToast.type === 'success' 
                    ? 'text-green-800' 
                    : currentToast.type === 'warning'
                    ? 'text-yellow-800'
                    : 'text-red-800'
                }`}>
                  {currentToast.message}
                </p>

                {currentToast.details && currentToast.type !== 'error' && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600 space-y-1">
                      {currentToast.details.eventName && (
                        <p><strong>Event:</strong> {currentToast.details.eventName}</p>
                      )}
                      {currentToast.details.ticketId && (
                        <p><strong>Ticket:</strong> #{currentToast.details.ticketId}</p>
                      )}
                      {currentToast.details.attendee_name && (
                        <p><strong>Attendee:</strong> {currentToast.details.attendee_name}</p>
                      )}
                      {currentToast.details.entered_at && (
                        <p><strong>Entry Time:</strong> {formatDateTime(currentToast.details.entered_at)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual token input - always available as backup */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-medium mb-4">Manual Token Entry</h3>
            <p className="text-sm text-gray-600 mb-4">
              Backup method: manually enter token if camera scanning fails
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={`Enter token (e.g., 95WhBX) or URL`}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = (e.target as HTMLInputElement).value.trim();
                    if (input) {
                      handleScanSuccess(input);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="token"]') as HTMLInputElement;
                  const inputValue = input?.value.trim();
                  if (inputValue) {
                    handleScanSuccess(inputValue);
                    input.value = '';
                  }
                }}
                disabled={processing}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Validate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}