'use client';

import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ScanResult {
  success: boolean;
  entered?: boolean;
  alreadyEntered?: boolean;
  ticketId?: number;
  enteredAt?: string;
  enteredBy?: string;
  error?: string;
}

interface TicketInfo {
  id: number;
  attendee_name?: string;
  attendee_phone?: string;
  entered_at?: string;
  metadata_updated_at?: string;
}

export default function ScanPage() {
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);

  useEffect(() => {
    // Check if admin is authenticated
    const token = localStorage.getItem('adminToken');
    setIsAuthenticated(!!token);
  }, []);

  const extractTokenFromUrl = (url: string): string | null => {
    // Extract token from URL like http://localhost:3000/entry/abc123
    const match = url.match(/\/entry\/([^/?]+)/);
    return match ? match[1] : url; // If no match, assume it's just the token
  };

  const validateTicket = async (scannedToken: string) => {
    setLoading(true);
    setScanResult(null);
    setTicketInfo(null);

    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ token: scannedToken }),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        setScanResult(result);
        // Fetch additional ticket info
        await fetchTicketInfo(scannedToken);
      } else {
        setScanResult({ success: false, error: result.error || 'Validation failed' });
      }
    } catch (error) {
      console.error('Validation error:', error);
      setScanResult({ success: false, error: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketInfo = async (token: string) => {
    try {
      const response = await fetch(`/api/ticket/by-token?token=${token}`);
      if (response.ok) {
        const info = await response.json();
        setTicketInfo(info);
      }
    } catch (error) {
      console.error('Failed to fetch ticket info:', error);
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setScanResult(null);

    const html5QrcodeScanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    html5QrcodeScanner.render(
      (decodedText) => {
        const extractedToken = extractTokenFromUrl(decodedText);
        if (extractedToken) {
          setToken(extractedToken);
          validateTicket(extractedToken);
          html5QrcodeScanner.clear();
          setIsScanning(false);
        }
      },
      (errorMessage) => {
        // Ignore scanning errors
      }
    );
  };

  const stopScanning = () => {
    setIsScanning(false);
    const element = document.getElementById('qr-reader');
    if (element) {
      element.innerHTML = '';
    }
  };

  const handleManualEntry = () => {
    if (token.trim()) {
      validateTicket(token.trim());
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    window.location.href = '/admin/login';
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-4">Access Denied</h1>
          <p className="text-center text-gray-600 mb-4">
            You need to be logged in as an admin to access the scanner.
          </p>
          <div className="text-center">
            <a 
              href="/admin/login"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Login as Admin
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">QR Scanner</h1>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Logout
          </button>
        </div>

        {/* Scanner Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual Token Entry
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter token or scan QR"
                  className="flex-1 border border-gray-300 rounded px-3 py-2"
                />
                <button
                  onClick={handleManualEntry}
                  disabled={loading || !token.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  Validate
                </button>
              </div>
            </div>

            <div className="text-center">
              {!isScanning ? (
                <button
                  onClick={startScanning}
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
                >
                  Start QR Scanner
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600"
                >
                  Stop Scanner
                </button>
              )}
            </div>
          </div>
        </div>

        {/* QR Scanner */}
        {isScanning && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div id="qr-reader" className="w-full"></div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-center">Validating ticket...</p>
          </div>
        )}

        {/* Results */}
        {scanResult && (
          <div className={`rounded-lg p-4 mb-4 ${
            scanResult.success
              ? scanResult.entered
                ? 'bg-green-50 border border-green-200'
                : scanResult.alreadyEntered
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            {scanResult.success ? (
              <>
                {scanResult.entered && (
                  <div className="text-green-800">
                    <h3 className="font-bold text-lg">✅ Entry Recorded</h3>
                    <p>Ticket #{scanResult.ticketId}</p>
                    <p className="text-sm">Entered at: {new Date(scanResult.enteredAt!).toLocaleString()}</p>
                  </div>
                )}
                {scanResult.alreadyEntered && (
                  <div className="text-yellow-800">
                    <h3 className="font-bold text-lg">⚠️ Already Entered</h3>
                    <p>Ticket #{scanResult.ticketId}</p>
                    <p className="text-sm">Originally entered at: {new Date(scanResult.enteredAt!).toLocaleString()}</p>
                    <p className="text-sm">Entered by: {scanResult.enteredBy}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-red-800">
                <h3 className="font-bold text-lg">❌ Validation Failed</h3>
                <p>{scanResult.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Ticket Information */}
        {ticketInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2">Ticket Information</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Ticket ID:</strong> {ticketInfo.id}</p>
              {ticketInfo.attendee_name && (
                <p><strong>Name:</strong> {ticketInfo.attendee_name}</p>
              )}
              {ticketInfo.attendee_phone && (
                <p><strong>Phone:</strong> {ticketInfo.attendee_phone}</p>
              )}
              {ticketInfo.entered_at && (
                <p><strong>Entry Time:</strong> {new Date(ticketInfo.entered_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 text-center space-x-4">
          <a
            href="/admin/tickets"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            View All Tickets
          </a>
        </div>
      </div>
    </div>
  );
}