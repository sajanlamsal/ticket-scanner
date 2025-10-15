'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, QrCode, Download, FileDown, Eye, EyeOff } from 'lucide-react';

interface GeneratedTicket {
  ticketId: number;
  eventId: number;
  token: string;
  qrUrl: string;
}

interface GenerationResult {
  tickets: GeneratedTicket[];
  csvContent: string;
  totalGenerated: number;
}

export default function GenerateTicketsPage() {
  const [eventId, setEventId] = useState<number>(1);
  const [ticketUpTo, setTicketUpTo] = useState<number>(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string>('');
  
  // QR Code customization - default to A-one format
  const [qrSize, setQrSize] = useState<number>(20); // mm - optimized for A-one labels
  const [qrTopMargin, setQrTopMargin] = useState<number>(2); // mm - margin above QR code
  const [qrBottomMargin, setQrBottomMargin] = useState<number>(1); // mm - margin below QR code
  const [gridCols, setGridCols] = useState<number>(4); // A-one format
  const [gridRows, setGridRows] = useState<number>(10); // A-one format (40 labels)
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewQR, setPreviewQR] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate preview QR code
  const generatePreviewQR = async () => {
    try {
      const sampleToken = 'x9K2mE'; // Sample token for preview
      const qrDataUrl = await generateQRCode(`${window.location.origin}/entry/${sampleToken}`);
      setPreviewQR(qrDataUrl);
    } catch (error) {
      console.error('Preview QR generation error:', error);
    }
  };

  // Update preview when settings change
  const handleQRSettingsChange = () => {
    if (showPreview) {
      generatePreviewQR();
    }
  };

  // Calculate ticket dimensions based on grid and QR size
  const calculateTicketDimensions = () => {
    // Check if using A-one 40面 format
    const isAOneFormat = gridCols === 4 && gridRows === 10;
    
    if (isAOneFormat) {
      // A-one exact dimensions: 52.5mm × 29.7mm per label
      const cellWidth = 52.5;
      const cellHeight = 29.7;
      const ticketsPerPage = 40; // 4×10
      return { cellWidth, cellHeight, ticketsPerPage, isAOneFormat: true };
    } else {
      // Standard calculation with margins
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 10;
      
      const cellWidth = (pageWidth - margin * 2) / gridCols;
      const cellHeight = (pageHeight - margin * 2) / gridRows;
      const ticketsPerPage = gridCols * gridRows;
      
      return { cellWidth, cellHeight, ticketsPerPage, isAOneFormat: false };
    }
  };

  const generateQRCode = async (text: string): Promise<string> => {
    try {
      const qrDataUrl = await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      return qrDataUrl;
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw error;
    }
  };

  const generateTickets = async () => {
    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      // Call the API to generate tokens
      const response = await fetch('/api/admin/generate-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({
          eventId,
          ticketUpTo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate tickets');
      }

      const data = await response.json();
      setResult(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCSV = () => {
    if (!result) return;

    const blob = new Blob([result.csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-event${eventId}-1-${ticketUpTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePDF = async () => {
    if (!result) return;

    try {
      setIsGenerating(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const dimensions = calculateTicketDimensions();
      const { cellWidth, cellHeight, ticketsPerPage, isAOneFormat } = dimensions;
      
      let startX, startY, cols, rows;
      
      if (isAOneFormat) {
        // A-one 40面 format: 4×10 grid, 52.5×29.7mm labels, no margins needed
        cols = 4;
        rows = 10;
        startX = 0; // No margin for exact label alignment
        startY = 0;
      } else {
        // Standard format with margins
        cols = gridCols;
        rows = gridRows;
        startX = 10; // 10mm margin
        startY = 10;
      }
      let currentPage = 0;
      
      for (let i = 0; i < result.tickets.length; i++) {
        const ticket = result.tickets[i];
        const ticketIndex = i % ticketsPerPage;
        
        // Add new page if needed
        if (i > 0 && ticketIndex === 0) {
          pdf.addPage();
          currentPage++;
        }
        
        // Calculate position
        const col = ticketIndex % cols;
        const row = Math.floor(ticketIndex / cols);
        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;
        
        // Generate QR code for this ticket
        const qrDataUrl = await generateQRCode(ticket.qrUrl);
        
        // Draw border
        pdf.rect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
        
        // Add QR code image - use top margin
        const qrX = x + (cellWidth - qrSize) / 2;
        const qrY = y + qrTopMargin;
        
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
        
        // Add padded ticket number below QR code with bottom margin
        const paddedTicketNumber = ticket.ticketId.toString().padStart(5, '0');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(paddedTicketNumber, x + cellWidth / 2, qrY + qrSize + qrBottomMargin + 3, { align: 'center' });
      }
      
      // Save the PDF
      pdf.save(`qr-tickets-event${eventId}-1-${ticketUpTo}.pdf`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      setError('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-6 h-6" />
                  Generate QR Tickets
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate QR codes for event tickets using the hashids algorithm. 
                  Specify event ID and maximum ticket number to generate.
                </p>
              </div>
              <Button variant="ghost" asChild>
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Admin
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Generation Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generation Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="eventId">Event ID</Label>
                <Input
                  id="eventId"
                  type="number"
                  min="1"
                  value={eventId}
                  onChange={(e) => setEventId(parseInt(e.target.value) || 1)}
                  placeholder="Enter event ID"
                />
                <p className="text-sm text-muted-foreground">
                  Unique identifier for the event
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketUpTo">Tickets Up To</Label>
                <Input
                  id="ticketUpTo"
                  type="number"
                  min="1"
                  max="10000"
                  value={ticketUpTo}
                  onChange={(e) => setTicketUpTo(parseInt(e.target.value) || 1)}
                  placeholder="Maximum ticket number"
                />
                <p className="text-sm text-muted-foreground">
                  Generate tickets from 1 to this number
                </p>
              </div>
            </div>

            <Button
              onClick={generateTickets}
              disabled={isGenerating || ticketUpTo < 1 || eventId < 1}
              className="w-full"
            >
              {isGenerating ? (
                <span className="flex items-center">
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating...
                </span>
              ) : (
                `Generate ${ticketUpTo} Tickets`
              )}
            </Button>
          </CardContent>
        </Card>

        {/* QR Code Customization */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>QR Code & Layout Settings</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  🏷️ Default: A-one 40面 format - QR code + padded ticket number (00001, 00002...)
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(!showPreview);
                  if (!showPreview) {
                    generatePreviewQR();
                  }
                }}
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show Preview
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Settings Panel */}
            <div className="space-y-6">
              {/* QR Code Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code Size: {qrSize}mm × {qrSize}mm
                </label>
                <input
                  type="range"
                  min="15"
                  max="40"
                  step="1"
                  value={qrSize}
                  onChange={(e) => {
                    setQrSize(parseInt(e.target.value));
                    handleQRSettingsChange();
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>15mm</span>
                  <span>40mm</span>
                </div>
              </div>

              {/* QR Code Top Margin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Top Margin: {qrTopMargin}mm
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={qrTopMargin}
                  onChange={(e) => {
                    setQrTopMargin(parseFloat(e.target.value));
                    handleQRSettingsChange();
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1mm</span>
                  <span>8mm</span>
                </div>
              </div>

              {/* QR Code Bottom Margin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Bottom Margin: {qrBottomMargin}mm
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={qrBottomMargin}
                  onChange={(e) => {
                    setQrBottomMargin(parseFloat(e.target.value));
                    handleQRSettingsChange();
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.5mm</span>
                  <span>5mm</span>
                </div>
              </div>

              {/* Grid Columns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Columns per Page: {gridCols}
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={gridCols}
                  onChange={(e) => {
                    setGridCols(parseInt(e.target.value));
                    handleQRSettingsChange();
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>2 cols</span>
                  <span>6 cols</span>
                </div>
              </div>

              {/* Grid Rows */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rows per Page: {gridRows}
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={gridRows}
                  onChange={(e) => {
                    setGridRows(parseInt(e.target.value));
                    handleQRSettingsChange();
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>3 rows</span>
                  <span>10 rows</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setGridCols(4);
                      setGridRows(10);
                      setQrSize(20);
                      setQrTopMargin(2);
                      setQrBottomMargin(1);
                      handleQRSettingsChange();
                    }}
                    className="px-3 py-2 text-sm bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 font-medium"
                  >
                    🏷️ A-one 40面 (4×10)
                  </button>
                  <button
                    onClick={() => {
                      setGridCols(4);
                      setGridRows(6);
                      setQrSize(25);
                      setQrTopMargin(2);
                      setQrBottomMargin(1);
                      handleQRSettingsChange();
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Standard (4×6)
                  </button>
                  <button
                    onClick={() => {
                      setGridCols(3);
                      setGridRows(4);
                      setQrSize(35);
                      setQrTopMargin(2.5);
                      setQrBottomMargin(1.5);
                      handleQRSettingsChange();
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Large QR (3×4)
                  </button>
                  <button
                    onClick={() => {
                      setGridCols(2);
                      setGridRows(3);
                      setQrSize(40);
                      setQrTopMargin(3);
                      setQrBottomMargin(2);
                      handleQRSettingsChange();
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    XL QR (2×3)
                  </button>
                </div>
              </div>

              {/* Layout Info */}
              <div className={`p-4 rounded-md ${calculateTicketDimensions().isAOneFormat ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <h3 className="font-medium text-gray-800 mb-2">
                  Layout Information
                  {calculateTicketDimensions().isAOneFormat && <span className="ml-2 text-blue-600">🏷️ A-one Format</span>}
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Grid: {gridCols} × {gridRows} = {calculateTicketDimensions().ticketsPerPage} tickets/page</div>
                  <div>Cell Size: {calculateTicketDimensions().cellWidth.toFixed(1)}mm × {calculateTicketDimensions().cellHeight.toFixed(1)}mm</div>
                  {calculateTicketDimensions().isAOneFormat && (
                    <div className="text-blue-600 font-medium">✓ Compatible with A-one 40面 label sheets (80322)</div>
                  )}
                  <div>QR Code: {qrSize}mm × {qrSize}mm</div>
                  <div>Pages needed: {Math.ceil(ticketUpTo / calculateTicketDimensions().ticketsPerPage)}</div>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4">
              {showPreview && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <h3 className="font-medium text-gray-800 mb-4 text-center">QR Code Preview</h3>
                  <div className="flex justify-center mb-4">
                    {previewQR && (
                      <div 
                        className="border rounded-lg bg-white shadow-sm"
                        style={{
                          width: `${qrSize * 3 + 20}px`,
                          height: `${qrSize * 3 + 60}px`,
                          padding: '10px'
                        }}
                      >
                        <div style={{ marginTop: `${qrTopMargin * 3}px` }}>
                          <img 
                            src={previewQR} 
                            alt="QR Code Preview" 
                            style={{ 
                              width: `${qrSize * 3}px`, 
                              height: `${qrSize * 3}px`,
                              display: 'block',
                              margin: '0 auto'
                            }}
                          />
                        </div>
                        <div className="text-center" style={{ marginTop: `${qrBottomMargin * 3}px` }}>
                          <div className="text-sm font-bold" style={{ fontSize: '14px' }}>00123</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-center text-sm text-gray-600">
                    Actual size: {qrSize}mm × {qrSize}mm
                  </div>
                </div>
              )}

              {/* Grid Preview */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4 text-center">
                  Page Layout Preview
                  {calculateTicketDimensions().isAOneFormat && (
                    <div className="text-xs text-blue-600 font-normal mt-1">A-one 40面 Compatible</div>
                  )}
                </h3>
                <div 
                  className={`bg-white border mx-auto ${calculateTicketDimensions().isAOneFormat ? 'border-blue-300' : 'border-gray-300'}`}
                  style={{
                    width: '210px',
                    height: '297px',
                    transform: 'scale(0.7)',
                    transformOrigin: 'top center'
                  }}
                >
                  <div 
                    className={`h-full grid ${calculateTicketDimensions().isAOneFormat ? 'gap-0' : 'gap-1 p-2'}`}
                    style={{
                      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                      gridTemplateRows: `repeat(${gridRows}, 1fr)`
                    }}
                  >
                    {Array.from({ length: calculateTicketDimensions().ticketsPerPage }, (_, i) => (
                      <div 
                        key={i} 
                        className={`border flex items-center justify-center text-xs ${
                          calculateTicketDimensions().isAOneFormat 
                            ? 'border-blue-400 bg-blue-50' 
                            : 'border-gray-400 bg-gray-50'
                        }`}
                      >
                        QR
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                  A4 Page ({gridCols}×{gridRows} = {calculateTicketDimensions().ticketsPerPage} labels)
                  {calculateTicketDimensions().isAOneFormat && (
                    <div className="text-blue-600">52.5×29.7mm per label</div>
                  )}
                </div>
              </div>
            </div>
          </div>

            {error && (
              <Card className="mt-4 border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Generation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-muted/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{result.totalGenerated}</div>
                    <div className="text-sm text-muted-foreground">Tickets Generated</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <div className="text-2xl font-bold text-green-600">{eventId}</div>
                  <div className="text-sm text-gray-600">Event ID</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <div className="text-2xl font-bold text-purple-600">1-{ticketUpTo}</div>
                  <div className="text-sm text-gray-600">Ticket Range</div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={downloadCSV}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                >
                  📄 Download CSV
                </button>
                <button
                  onClick={generatePDF}
                  className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700"
                >
                  📄 Generate PDF Grid
                </button>
              </div>
            </div>

              {/* Sample Preview */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Sample Generated Tickets (First 10)</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">Ticket ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Event ID</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Token</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">QR URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tickets.slice(0, 10).map((ticket) => (
                      <tr key={`${ticket.eventId}-${ticket.ticketId}`}>
                        <td className="border border-gray-300 px-4 py-2">{ticket.ticketId}</td>
                        <td className="border border-gray-300 px-4 py-2">{ticket.eventId}</td>
                        <td className="border border-gray-300 px-4 py-2 font-mono">{ticket.token}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <a href={ticket.qrUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            {ticket.qrUrl}
                          </a>
                        </td>
                      </tr>
                    ))}
                    {result.tickets.length > 10 && (
                      <tr>
                        <td colSpan={4} className="border border-gray-300 px-4 py-2 text-center text-gray-500">
                          ... and {result.tickets.length - 10} more tickets
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hidden canvas for QR generation */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}