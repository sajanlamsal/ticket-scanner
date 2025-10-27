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

// Types
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

interface TicketDimensions {
  cellWidth: number;
  cellHeight: number;
  ticketsPerPage: number;
  isStandardFormat: boolean;
  formatName: string;
  startX: number;
  startY: number;
  printableWidth: number;
  printableHeight: number;
  cannonMargin: number;
  totalWidth: number;
  totalHeight: number;
}

export default function GenerateTicketsPage() {
  // State variables
  const [eventId, setEventId] = useState<number>(1);
  const [ticketFrom, setTicketFrom] = useState<number>(1);
  const [ticketTo, setTicketTo] = useState<number>(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  
  // QR Code settings - Canon printer optimized defaults
  const [qrSize, setQrSize] = useState<number>(20); // mm
  const [qrTopMargin, setQrTopMargin] = useState<number>(2); // mm
  const [qrBottomMargin, setQrBottomMargin] = useState<number>(1); // mm
  const [gridCols, setGridCols] = useState<number>(4); // Canon optimized 4×10 grid
  const [gridRows, setGridRows] = useState<number>(10);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewQR, setPreviewQR] = useState<string>('');
  const [showDebugBorders, setShowDebugBorders] = useState<boolean>(true);
  
  // Row-specific padding adjustments (in mm, can be negative)
  const [rowPaddings, setRowPaddings] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // 10 rows
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canon printer specifications
  const CANON_MARGIN = 4.23; // mm - Canon imageRUNNER ADVANCE C3826 default margin
  const A4_WIDTH = 210.0; // mm
  const A4_HEIGHT = 297.0; // mm
  const LABEL_WIDTH = 52.5; // mm - A-one/UNIPACK standard
  const LABEL_HEIGHT = 29.7; // mm

  // Calculate ticket dimensions with Canon printer optimization
  const calculateTicketDimensions = (): TicketDimensions => {
    const PRINTABLE_WIDTH = A4_WIDTH - (CANON_MARGIN * 2);
    const PRINTABLE_HEIGHT = A4_HEIGHT - (CANON_MARGIN * 2);
    const isStandardFormat = gridCols === 4 && gridRows === 10;
    
    if (isStandardFormat) {
      // Standard 4×10 format - use exact label dimensions
      const totalGridWidth = 4 * LABEL_WIDTH;
      const totalGridHeight = 10 * LABEL_HEIGHT;
      const startX = CANON_MARGIN + ((PRINTABLE_WIDTH - totalGridWidth) / 2);
      const startY = CANON_MARGIN + ((PRINTABLE_HEIGHT - totalGridHeight) / 2);
      
      return {
        cellWidth: LABEL_WIDTH,
        cellHeight: LABEL_HEIGHT,
        ticketsPerPage: 40,
        isStandardFormat: true,
        formatName: 'Standard 40面 (A-one/UNIPACK)',
        startX,
        startY,
        printableWidth: PRINTABLE_WIDTH,
        printableHeight: PRINTABLE_HEIGHT,
        cannonMargin: CANON_MARGIN,
        totalWidth: A4_WIDTH,
        totalHeight: A4_HEIGHT
      };
    } else {
      // Custom format within printable area
      const cellWidth = PRINTABLE_WIDTH / gridCols;
      const cellHeight = PRINTABLE_HEIGHT / gridRows;
      
      return {
        cellWidth,
        cellHeight,
        ticketsPerPage: gridCols * gridRows,
        isStandardFormat: false,
        formatName: 'Custom',
        startX: CANON_MARGIN,
        startY: CANON_MARGIN,
        printableWidth: PRINTABLE_WIDTH,
        printableHeight: PRINTABLE_HEIGHT,
        cannonMargin: CANON_MARGIN,
        totalWidth: A4_WIDTH,
        totalHeight: A4_HEIGHT
      };
    }
  };

  // Generate QR code
  const generateQRCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        width: 256
      });
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw error;
    }
  };

  // Generate preview QR code
  const generatePreviewQR = async () => {
    try {
      const sampleToken = 'x9K2mE';
      const qrDataUrl = await generateQRCode(`${window.location.origin}/entry/${sampleToken}`);
      setPreviewQR(qrDataUrl);
    } catch (error) {
      console.error('Preview QR generation error:', error);
    }
  };

  // Handle QR settings change
  const handleQRSettingsChange = () => {
    if (showPreview) {
      generatePreviewQR();
    }
  };

  // Test authentication
  const testAuthentication = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setError('No authentication token found. Please login again.');
      return false;
    }

    try {
      const response = await fetch('/api/admin/test-auth', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      
      if (!response.ok) {
        setError(`Authentication test failed: ${result.error}`);
        return false;
      }

      console.log('Authentication test successful:', result);
      return true;
    } catch (error) {
      console.error('Authentication test error:', error);
      setError('Failed to test authentication');
      return false;
    }
  };

  // Generate tickets
  const generateTickets = async () => {
    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      if (!token.includes('.')) {
        setError('Invalid token format. Please log in again.');
        localStorage.removeItem('adminToken');
        return;
      }

      const response = await fetch('/api/admin/generate-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ eventId, ticketFrom, ticketTo })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/admin/login';
          }, 2000);
          return;
        }
        
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
    } catch (err) {
      console.error('Generate tickets error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  // Download CSV
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

  // Generate PDF with Canon optimization
  const generatePDF = async () => {
    if (!result) return;

    try {
      setIsGeneratingPDF(true);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const dimensions = calculateTicketDimensions();
      const { cellWidth, cellHeight, startX, startY, cannonMargin } = dimensions;
      const ticketsPerPage = gridCols * gridRows;
      
      console.log('=== Canon Printer PDF Generation ===');
      console.log(`Canon Margin: ${cannonMargin}mm`);
      console.log(`Cell: ${cellWidth.toFixed(2)}×${cellHeight.toFixed(2)}mm`);
      console.log(`Grid: ${gridCols}×${gridRows}`);
      console.log(`Start: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);
      console.log(`DEBUG: Debug borders ${showDebugBorders ? 'ENABLED' : 'DISABLED'} - ${showDebugBorders ? 'Red borders show label boundaries, green crosses show centers' : 'Clean output without borders'}`);
      console.log(`Row Paddings:`, rowPaddings.map((p, i) => `Row${i+1}: ${p}mm`).join(', '));
      
      for (let i = 0; i < result.tickets.length; i++) {
        const ticket = result.tickets[i];
        const ticketIndex = i % ticketsPerPage;
        
        // Add new page if needed
        if (i > 0 && ticketIndex === 0) {
          pdf.addPage();
        }
        
        // Calculate position with row-specific padding
        const col = ticketIndex % gridCols;
        const row = Math.floor(ticketIndex / gridCols);
        const x = startX + (col * cellWidth);
        const rowPadding = rowPaddings[row] || 0; // Get padding for this row (default 0)
        const y = startY + (row * cellHeight) + rowPadding;
        
        // Generate and add QR code
        const qrDataUrl = await generateQRCode(ticket.qrUrl);
        const padding = 1;
        const textHeight = 4;
        const maxQrSize = Math.min(
          cellWidth - (padding * 2),
          cellHeight - (padding * 2) - textHeight
        );
        const actualQrSize = Math.min(qrSize, maxQrSize);
        
        // Center QR code in cell
        const qrX = x + padding + ((cellWidth - (padding * 2) - actualQrSize) / 2);
        const qrY = y + padding + 1;
        
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, actualQrSize, actualQrSize);
        
        // Add ticket number close to QR code
        const paddedTicketNumber = ticket.ticketId.toString().padStart(5, '0');
        const textX = x + (cellWidth / 2);
        const textY = qrY + actualQrSize + 3; // Position 3mm below QR code
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(paddedTicketNumber, textX, textY, { align: 'center' });
        
        // DEBUG: Add borders around each label cell (if enabled)
        if (showDebugBorders) {
          pdf.setDrawColor(255, 0, 0); // Red color for debug borders
          pdf.setLineWidth(0.2); // Thin line
          pdf.rect(x, y, cellWidth, cellHeight); // Draw cell boundary
          
          // DEBUG: Add cross-hair at cell center for alignment verification
          const centerX = x + (cellWidth / 2);
          const centerY = y + (cellHeight / 2);
          pdf.setDrawColor(0, 255, 0); // Green color for center marks
          pdf.setLineWidth(0.1);
          // Horizontal line
          pdf.line(centerX - 2, centerY, centerX + 2, centerY);
          // Vertical line  
          pdf.line(centerX, centerY - 2, centerX, centerY + 2);
        }
        
        // Progress update
        if (i % 25 === 0) {
          const progress = Math.round(((i + 1) / result.tickets.length) * 100);
          console.log(`PDF Progress: ${progress}% (Row ${row + 1} padding: ${rowPadding.toFixed(1)}mm)`);
        }
      }
      
      const debugSuffix = showDebugBorders ? '-debug' : '';
      pdf.save(`canon-qr-tickets-event${eventId}-${ticketFrom}-${ticketTo}${debugSuffix}.pdf`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      setError('Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const dimensions = calculateTicketDimensions();

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
            Generate QR codes optimized for Canon imageRUNNER ADVANCE C3826 printer. 
            Uses 4.23mm default printer margins with 4×10 grid (52.5×29.7mm labels).
          </p>
        </div>

        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {/* Event ID */}
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

              {/* Ticket From */}
              <div className="space-y-2">
                <Label htmlFor="ticketFrom">Ticket From</Label>
                <Input
                  id="ticketFrom"
                  type="number"
                  value={ticketFrom}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      setTicketFrom(value);
                      if (ticketTo < value) setTicketTo(value);
                    }
                  }}
                  placeholder="Start ticket number"
                />
              </div>

              {/* Ticket To */}
              <div className="space-y-2">
                <Label htmlFor="ticketTo">Ticket To</Label>
                <Input
                  id="ticketTo"
                  type="number"
                  value={ticketTo}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value) && value >= ticketFrom) {
                      setTicketTo(value);
                    }
                  }}
                  placeholder="End ticket number"
                />
              </div>
            </div>

            {/* Validation Messages */}
            {(ticketTo - ticketFrom + 1) > 520 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <p className="text-destructive font-medium">
                  Maximum 520 tickets per generation allowed
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Tickets to generate:</span>
                <span className="font-bold text-primary">
                  {Math.max(0, ticketTo - ticketFrom + 1)}
                </span>
              </div>
            </div>

            {/* Generation Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={testAuthentication}
                variant="outline"
                disabled={isGenerating}
              >
                Test Auth
              </Button>
              <Button
                onClick={generateTickets}
                disabled={
                  isGenerating || 
                  ticketTo < ticketFrom || 
                  eventId < 1 || 
                  (ticketTo - ticketFrom + 1) > 520
                }
                className="flex-1"
              >
                {isGenerating ? 'Generating...' : `Generate ${ticketTo - ticketFrom + 1} Tickets`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Canon Printer Layout Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Canon Printer Optimized Layout
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  🖨️ Optimized for Canon imageRUNNER ADVANCE C3826 (4.23mm margins)
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
                    if (!showPreview) generatePreviewQR();
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
                {/* Canon Info */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm font-medium text-blue-800 mb-1">
                    🖨️ Canon imageRUNNER ADVANCE C3826 Optimization
                  </div>
                  <div className="text-xs text-blue-600 space-y-1">
                    <div>• Default printer margins: {CANON_MARGIN}mm on all edges</div>
                    <div>• Content automatically positioned within printable area</div>
                    <div>• Optimized for minimal print waste with perfect alignment</div>
                  </div>
                </div>

                {/* Layout Summary */}
                <div className={`p-4 rounded-md ${
                  dimensions.isStandardFormat ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}>
                  <h3 className="font-medium text-gray-800 mb-2">
                    Canon Printer Layout
                    {dimensions.isStandardFormat && (
                      <span className="ml-2 text-blue-600">🖨️ Optimized</span>
                    )}
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Format: <span className="font-medium">{dimensions.formatName}</span></div>
                    <div>Grid: {gridCols}×{gridRows} = {dimensions.ticketsPerPage} labels/page</div>
                    <div>Label Size: {dimensions.cellWidth.toFixed(1)}×{dimensions.cellHeight.toFixed(1)}mm</div>
                    <div>Canon Margin: <span className="font-medium">{dimensions.cannonMargin}mm</span></div>
                    {showAdvanced && (
                      <>
                        <div>Start Position: <span className="font-medium">
                          ({dimensions.startX.toFixed(1)}, {dimensions.startY.toFixed(1)})
                        </span></div>
                        {rowPaddings.some(p => p !== 0) && (
                          <div>Row Adjustments: <span className="font-medium text-orange-600">
                            {rowPaddings.filter(p => p !== 0).length} row(s) adjusted
                          </span></div>
                        )}
                      </>
                    )}
                    {dimensions.isStandardFormat && (
                      <div className="text-blue-600 font-medium">
                        ✓ Compatible with A-one & UNIPACK 40面 labels (52.5×29.7mm)
                        <span className="block text-xs">
                          🖨️ Canon imageRUNNER ADVANCE C3826 optimized
                        </span>
                      </div>
                    )}
                    <div>QR Code: {qrSize}mm × {qrSize}mm</div>
                    <div>Pages needed: {Math.ceil((ticketTo - ticketFrom + 1) / dimensions.ticketsPerPage)}</div>
                  </div>
                </div>

                {/* Advanced Settings */}
                {showAdvanced && (
                  <div className="space-y-4">
                    {/* QR Size */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
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
                        className="w-full"
                      />
                    </div>

                    {/* Grid Settings */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Grid Layout: {gridCols}×{gridRows}
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs mb-1">Columns: {gridCols}</label>
                          <input
                            type="range"
                            min="2"
                            max="6"
                            value={gridCols}
                            onChange={(e) => {
                              setGridCols(parseInt(e.target.value));
                              handleQRSettingsChange();
                            }}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1">Rows: {gridRows}</label>
                          <input
                            type="range"
                            min="3"
                            max="10"
                            value={gridRows}
                            onChange={(e) => {
                              setGridRows(parseInt(e.target.value));
                              handleQRSettingsChange();
                            }}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Presets */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Canon Optimized Presets
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGridCols(4);
                            setGridRows(10);
                            setQrSize(20);
                            handleQRSettingsChange();
                          }}
                          className="text-xs"
                        >
                          🏷️ A-one 40面 (4×10)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGridCols(3);
                            setGridRows(4);
                            setQrSize(35);
                            handleQRSettingsChange();
                          }}
                          className="text-xs"
                        >
                          Large QR (3×4)
                        </Button>
                      </div>
                    </div>

                    {/* Debug Options */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Debug Options
                      </label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="debug-borders"
                          checked={showDebugBorders}
                          onCheckedChange={setShowDebugBorders}
                        />
                        <Label htmlFor="debug-borders" className="text-sm">
                          Show Debug Borders
                        </Label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Shows red borders around each label and green cross-hairs at centers for alignment verification
                      </p>
                    </div>

                    {/* Row Padding Controls */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Row Padding Adjustments (mm)
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Fine-tune vertical position for each row. Positive values shift down, negative values shift up.
                      </p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Array.from({ length: gridRows }, (_, rowIndex) => (
                          <div key={rowIndex} className="flex items-center gap-2">
                            <label className="text-xs w-12 shrink-0">Row {rowIndex + 1}:</label>
                            <input
                              type="range"
                              min="-5"
                              max="5"
                              step="0.1"
                              value={rowPaddings[rowIndex] || 0}
                              onChange={(e) => {
                                const newPaddings = [...rowPaddings];
                                newPaddings[rowIndex] = parseFloat(e.target.value);
                                setRowPaddings(newPaddings);
                              }}
                              className="flex-1"
                            />
                            <input
                              type="number"
                              min="-5"
                              max="5"
                              step="0.1"
                              value={rowPaddings[rowIndex] || 0}
                              onChange={(e) => {
                                const newPaddings = [...rowPaddings];
                                newPaddings[rowIndex] = parseFloat(e.target.value) || 0;
                                setRowPaddings(newPaddings);
                              }}
                              className="w-16 px-1 py-1 text-xs border rounded"
                            />
                            <span className="text-xs w-6 text-gray-500">mm</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRowPaddings(new Array(10).fill(0))}
                          className="text-xs"
                        >
                          Reset All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Apply printer compensation pattern (common for Canon printers)
                            const compensationPattern = [0, -0.2, -0.4, -0.6, -0.8, -1.0, -1.2, -1.4, -1.6, -1.8];
                            setRowPaddings(compensationPattern);
                          }}
                          className="text-xs"
                        >
                          Canon Compensation
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Panel */}
              <div className="space-y-4">
                {/* QR Preview */}
                {showPreview && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <h3 className="font-medium text-center mb-4">QR Code Preview</h3>
                    <div className="flex justify-center mb-4">
                      {previewQR && (
                        <div 
                          className="border rounded-lg bg-white shadow-sm p-2"
                          style={{
                            width: `${qrSize * 3 + 20}px`,
                            height: `${qrSize * 3 + 60}px`
                          }}
                        >
                          <div style={{ marginTop: `${qrTopMargin * 3}px` }}>
                            <img 
                              src={previewQR} 
                              alt="QR Preview" 
                              style={{ 
                                width: `${qrSize * 3}px`, 
                                height: `${qrSize * 3}px`,
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                          </div>
                          <div className="text-center" style={{ marginTop: `${qrBottomMargin * 3}px` }}>
                            <div className="text-sm font-bold">00123</div>
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
                  <h3 className="font-medium text-center mb-4">
                    Canon Printer Layout Preview
                    {dimensions.isStandardFormat && (
                      <div className="text-xs text-blue-600 font-normal mt-1">
                        A-one & UNIPACK 40面 Compatible
                      </div>
                    )}
                  </h3>
                  <div 
                    className={`bg-white border mx-auto relative ${
                      dimensions.isStandardFormat ? 'border-blue-300' : 'border-gray-300'
                    }`}
                    style={{
                      width: '210px',
                      height: '297px',
                      transform: 'scale(0.7)',
                      transformOrigin: 'top center'
                    }}
                  >
                    {/* Canon margins */}
                    <div 
                      className="absolute border-2 border-dashed border-red-300 bg-red-50/30"
                      style={{
                        top: `${dimensions.cannonMargin}px`,
                        left: `${dimensions.cannonMargin}px`,
                        right: `${dimensions.cannonMargin}px`,
                        bottom: `${dimensions.cannonMargin}px`
                      }}
                    />
                    
                    {/* Grid */}
                    <div 
                      className="absolute grid gap-0"
                      style={{
                        top: `${dimensions.startY}px`,
                        left: `${dimensions.startX}px`,
                        width: `${gridCols * dimensions.cellWidth}px`,
                        height: `${gridRows * dimensions.cellHeight}px`,
                        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                        gridTemplateRows: `repeat(${gridRows}, 1fr)`
                      }}
                    >
                      {Array.from({ length: dimensions.ticketsPerPage }, (_, i) => (
                        <div 
                          key={i} 
                          className={`border flex items-center justify-center text-xs ${
                            dimensions.isStandardFormat 
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
                    Canon A4 Layout ({gridCols}×{gridRows} = {dimensions.ticketsPerPage} labels)
                    <div className="text-red-600">Red dashed = Canon {dimensions.cannonMargin}mm margins</div>
                    {dimensions.isStandardFormat && (
                      <div className="text-blue-600">Blue area = 52.5×29.7mm labels</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Card className="mt-4 border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center mt-0.5">
                      <span className="text-destructive-foreground text-xs">!</span>
                    </div>
                    <div>
                      <p className="text-destructive font-medium">{error}</p>
                      {error.includes('Session expired') && (
                        <button 
                          onClick={() => window.location.href = '/admin/login'}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Go to Login
                        </button>
                      )}
                    </div>
                  </div>
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
                        Generate Canon PDF
                      </>
                    )}
                  </Button>
                </div>

                {/* Canon Printing Instructions */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">
                    🖨️ Canon imageRUNNER ADVANCE C3826 Printing Instructions
                  </h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div><strong>1. Paper Settings:</strong> A4 size, portrait orientation</div>
                    <div><strong>2. Print Scale:</strong> 100% actual size (no scaling/fitting)</div>
                    <div><strong>3. Margins:</strong> Use printer default margins (4.23mm) - already optimized</div>
                    <div><strong>4. Quality:</strong> High quality mode for crisp QR codes</div>
                    <div><strong>5. Paper Type:</strong> A-one or UNIPACK 40面 label sheets (52.5×29.7mm)</div>
                    <div><strong>6. Perfect Alignment:</strong> Labels will align automatically with Canon's default margins</div>
                  </div>
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
                            <a href={ticket.qrUrl} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-600 hover:text-blue-800">
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