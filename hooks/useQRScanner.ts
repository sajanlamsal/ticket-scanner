import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export const useQRScanner = (onScan: (text: string) => Promise<void>) => {
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isMountedRef = useRef<boolean>(false);
  const initializingRef = useRef<boolean>(false);
  const handleScanSuccessRef = useRef<(scannedText: string) => Promise<void>>();

  handleScanSuccessRef.current = onScan;

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

  // Scanner initialization
  useEffect(() => {
    isMountedRef.current = true;

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

        const isMobile = window.innerWidth < 640;

        // Initialize scanner with mobile-optimized config
        const config = {
          fps: 10,
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          disableFlip: false,
          videoConstraints: {
            facingMode: 'environment',
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

        // Render scanner
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
        
        // Add mobile styles
        const style = document.createElement('style');
        style.id = 'qr-scanner-mobile-styles';
        style.textContent = `
          @media (max-width: 640px) {
            #qr-scanner-container video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
            #qr-scanner-container > div {
              margin: 0 !important;
              padding: 0 !important;
            }
            #qr-scanner-container canvas {
              display: none !important;
            }
            #qr-scanner-container__dashboard_section_csr {
              display: none !important;
            }
          }
          @media (min-width: 641px) {
            #qr-scanner-container canvas {
              display: none !important;
            }
          }
          #qr-scanner-container {
            display: flex !important;
            flex-direction: column !important;
          }
        `;
        
        const oldStyle = document.getElementById('qr-scanner-mobile-styles');
        if (oldStyle) oldStyle.remove();
        document.head.appendChild(style);
        
        // Auto-click buttons
        let attempts = 0;
        const maxAttempts = 20;
        let videoElement = null;
        
        while (!videoElement && attempts < maxAttempts && isMountedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 250));
          
          videoElement = document.querySelector('#qr-scanner-container video');
          const permissionBtn = document.querySelector('#html5-qrcode-button-camera-permission');
          const startBtn = document.querySelector('#html5-qrcode-button-camera-start');
          
          attempts++;
          
          if (permissionBtn && !videoElement) {
            (permissionBtn as HTMLElement).click();
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }
          
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
  }, []);

  // Initial cleanup effect
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

  return {
    scannerReady,
    scannerError,
    permissionGranted,
    retryCamera
  };
};
