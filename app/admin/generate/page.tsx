'use client';

import { useState, useRef } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { QrCode, Download, FileDown, Eye, EyeOff, Settings } from 'lucide-react';
import AdminLayout from '@/components/admin-layout';

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
  const [ticketFrom, setTicketFrom] = useState<number>(1);
  const [ticketTo, setTicketTo] = useState<number>(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  
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
          ticketFrom,
          ticketTo,
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
    a.download = `tickets-event${eventId}-${ticketFrom}-${ticketTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generatePDF = async () => {
    if (!result) return;

    try {
      setIsGeneratingPDF(true);
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
        
        // Update progress every 25 tickets or on last ticket for better performance
        if (i % 25 === 0 || i === result.tickets.length - 1) {
          const progress = Math.round(((i + 1) / result.tickets.length) * 100);
          console.log(`PDF Generation Progress: ${progress}% (${i + 1}/${result.tickets.length} tickets)`);
          
          // Small delay every 50 tickets to prevent UI blocking
          if (i % 50 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        
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
      pdf.save(`qr-tickets-event${eventId}-${ticketFrom}-${ticketTo}.pdf`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      setError('Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <QrCode className="w-8 h-8" />
            Generate QR Tickets
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate QR codes for event tickets using the hashids algorithm. 
            Specify event ID and ticket range (maximum 520 tickets per generation to prevent memory issues).
          </p>
        </div>

        {/* Generation Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generation Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
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
                <Label htmlFor="ticketFrom">Ticket From</Label>
                <Input
                  id="ticketFrom"
                  type="number"
                  min="1"
                  value={ticketFrom}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setTicketFrom(value);
                    // Ensure ticketTo is at least ticketFrom
                    if (ticketTo < value) {
                      setTicketTo(value);
                    }
                  }}
                  placeholder="Start ticket number"
                />
                <p className="text-sm text-muted-foreground">
                  Starting ticket number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketTo">Ticket To</Label>
                <Input
                  id="ticketTo"
                  type="number"
                  min={ticketFrom}
                  value={ticketTo}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || ticketFrom;
                    setTicketTo(Math.max(value, ticketFrom));
                  }}
                  placeholder="End ticket number"
                />
                <p className="text-sm text-muted-foreground">
                  Ending ticket number
                </p>
              </div>
            </div>

            {/* Validation Messages */}
            {(ticketTo - ticketFrom + 1) > 520 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                    <span className="text-destructive-foreground text-xs">!</span>
                  </div>
                  <p className="text-destructive font-medium">
                    Maximum 520 tickets per generation allowed
                  </p>
                </div>
                <p className="text-sm text-destructive/80 mt-1">
                  Currently trying to generate {ticketTo - ticketFrom + 1} tickets. 
                  Please reduce the range to prevent memory issues and page unresponsiveness.
                </p>
              </div>
            )}

            {ticketTo < ticketFrom && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <p className="text-destructive">
                  "Ticket To" must be greater than or equal to "Ticket From"
                </p>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Tickets to generate:</span>
                <span className="font-bold text-primary">{Math.max(0, ticketTo - ticketFrom + 1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span>Range:</span>
                <span className="font-mono">{ticketFrom} - {ticketTo}</span>
              </div>
            </div>

            <Button
              onClick={generateTickets}
              disabled={
                isGenerating || 
                ticketTo < ticketFrom || 
                eventId < 1 || 
                (ticketTo - ticketFrom + 1) > 520
              }
              className="w-full"
            >
              {isGenerating ? (
                <span className="flex items-center">
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating...
                </span>
              ) : (
                `Generate ${ticketTo - ticketFrom + 1} Tickets`
              )}
            </Button>
          </CardContent>
        </Card>

        {/* QR Code Customization */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  PDF Layout & QR Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  🏷️ Default: A-one 40面 format - QR code + padded ticket number (00001, 00002...)
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="advanced-mode"
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                  />
                  <Label htmlFor="advanced-mode" className="text-sm">
                    Advanced Options
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
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
            </div>
          </CardHeader>
          <CardContent>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Settings Panel */}
            <div className="space-y-6">
              {!showAdvanced && (
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    🏷️ Quick Setup - A-one Compatible
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ready to generate professional label sheets compatible with A-one 40面 format (4×10 grid, 52.5×29.7mm labels).
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>QR Code Size:</span>
                      <span className="font-medium">{qrSize}mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Grid Layout:</span>
                      <span className="font-medium">{gridCols}×{gridRows} ({calculateTicketDimensions().ticketsPerPage} per page)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pages Needed:</span>
                      <span className="font-medium">{Math.ceil((ticketTo - ticketFrom + 1) / calculateTicketDimensions().ticketsPerPage)}</span>
                    </div>
                  </div>
                </div>
              )}

              {showAdvanced && (
                <>
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
                  <div>Pages needed: {Math.ceil((ticketTo - ticketFrom + 1) / calculateTicketDimensions().ticketsPerPage)}</div>
                </div>
                </div>
                </>
              )}
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
                  <div className="text-2xl font-bold text-purple-600">{ticketFrom}-{ticketTo}</div>
                  <div className="text-sm text-gray-600">Ticket Range</div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={downloadCSV}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
                <Button
                  onClick={generatePDF}
                  disabled={isGeneratingPDF}
                  variant="default"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 mr-2" />
                      Generate PDF Grid
                    </>
                  )}
                </Button>
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
    </AdminLayout>
  );
}