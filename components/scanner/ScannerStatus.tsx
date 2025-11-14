import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface ScannerStatusProps {
  scannerReady: boolean;
  scannerError: string;
  permissionGranted: boolean | null;
  isProcessing: boolean;
  onRetry: () => void;
}

export function ScannerStatus({ 
  scannerReady, 
  scannerError, 
  permissionGranted, 
  isProcessing, 
  onRetry 
}: ScannerStatusProps) {
  if (scannerError) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg p-3 gap-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{scannerError}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onRetry}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!scannerReady) {
    return (
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
    );
  }

  return (
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
  );
}
