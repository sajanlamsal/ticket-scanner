'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, FileText, Loader2 } from 'lucide-react';

import { useScanProcessor } from '@/hooks/useScanProcessor';
import { useQRScanner } from '@/hooks/useQRScanner';
import { ScannerStatus } from '@/components/scanner/ScannerStatus';
import { ScanResult } from '@/components/scanner/ScanResult';
import { ManualEntry } from '@/components/scanner/ManualEntry';

export default function ScannerPage() {
  const router = useRouter();
  
  const {
    currentResult,
    isProcessing,
    scanMemory,
    processScan,
    clearMemory,
    setCurrentResult
  } = useScanProcessor();

  const {
    scannerReady,
    scannerError,
    permissionGranted,
    retryCamera
  } = useQRScanner(processScan);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }
  }, [router]);

  // Auto-clear results after 6 seconds
  useEffect(() => {
    if (currentResult) {
      const timer = setTimeout(() => {
        setCurrentResult(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [currentResult, setCurrentResult]);

  const handleManualScan = useCallback((token: string) => {
    processScan(token);
  }, [processScan]);

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
              <ScannerStatus
                scannerReady={scannerReady}
                scannerError={scannerError}
                permissionGranted={permissionGranted}
                isProcessing={isProcessing}
                onRetry={retryCamera}
              />
            </div>

            {/* Scanner Container with Loading Overlay */}
            <div className="border rounded-lg overflow-hidden bg-muted/50 relative">
              <div id="qr-scanner-container" className="min-h-[200px] max-h-[250px] sm:min-h-[400px] sm:max-h-none" />
              
              {/* Loading Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                  <div className="bg-white rounded-full p-3 sm:p-4 shadow-lg">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Result Display */}
            <div className="mt-4 min-h-[80px] sm:min-h-[128px]">
              <ScanResult result={currentResult} />
            </div>

            {/* Manual Entry Fallback */}
            <ManualEntry onManualScan={handleManualScan} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}