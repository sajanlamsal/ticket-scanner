#!/usr/bin/env tsx

/**
 * Generate VIP passes with QR codes as printable PDFs
 * 
 * Creates beautiful, professional VIP passes - one page per ticket.
 * Each pass includes QR code, ticket details, and branding.
 * 
 * Usage:
 *   tsx scripts/utilities/generate_vip_passes.ts --start=1 --end=10 --event-id=1
 *   tsx scripts/utilities/generate_vip_passes.ts --start=1 --end=10 --event-id=1 --event-name="Nepathya Concert 2025"
 *   tsx scripts/utilities/generate_vip_passes.ts --tickets=1,5,10,25 --event-id=1 --event-name="VIP Backstage"
 */

import { Command } from 'commander';
import Hashids from 'hashids';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

const TICKET_SECRET = process.env.TICKET_SECRET || 'MnepThaya2025';
const NEXT_PUBLIC_VALID_DOMAIN = process.env.NEXT_PUBLIC_VALID_DOMAIN || 'http://localhost:3000';
const hashids = new Hashids(TICKET_SECRET, 6);

interface TicketData {
  id: number;
  eventId: number;
  token: string;
  eventName?: string;
}

function generateToken(ticketId: number, eventId: number): string {
  return hashids.encode(eventId, ticketId);
}

async function generateQRCodeDataURL(url: string): Promise<string> {
  return await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

async function createVIPPass(
  doc: jsPDF,
  ticket: TicketData,
  qrDataURL: string,
  host: string,
  customization: PassCustomization,
  logoDataURL?: string
): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Background gradient effect (using rectangles)
  doc.setFillColor(20, 20, 40); // Dark blue-black
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  const passType = customization.passType || 'VIP';
  const isVIP = passType === 'VIP';
  
  // Gold/Blue accent bar at top
  doc.setFillColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237); // Gold for VIP, Blue for Standard
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Decorative corners (drawn early so logo sits on top)
  doc.setDrawColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237);
  doc.setLineWidth(2);
  // Top-left corner
  doc.line(10, 10, 30, 10);
  doc.line(10, 10, 10, 30);
  // Top-right corner
  doc.line(pageWidth - 10, 10, pageWidth - 30, 10);
  doc.line(pageWidth - 10, 10, pageWidth - 10, 30);
  
  // Add logo on top left if available (with compression)
  if (logoDataURL) {
    const logoMaxHeight = 20;
    const logoMaxWidth = 18;
    const logoX = 5;
    const logoY = 3.5;
    
    // Add with FAST compression mode
    doc.addImage(logoDataURL, 'PNG', logoX, logoY, logoMaxWidth, logoMaxHeight, undefined, 'FAST');
  }
  
  // Badge (Wider square with border)
  const badgeWidth = 60;
  const badgeHeight = 20;
  const badgeX = pageWidth / 2 - badgeWidth / 2;
  const badgeY = 40;
  
  // Badge background
  doc.setFillColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');
  
  // Badge border
  doc.setDrawColor(isVIP ? 255 : 150, isVIP ? 215 : 200, isVIP ? 100 : 255);
  doc.setLineWidth(1);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'S');
  
  // Badge text
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(passType, pageWidth / 2, badgeY + 13.5, { align: 'center' });
  
  // Event Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const eventTitle = customization.eventName || ticket.eventName || (isVIP ? 'VIP ACCESS' : 'STANDARD ACCESS');
  doc.text(eventTitle, pageWidth / 2, 85, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(customization.subtitle || (isVIP ? 'EXCLUSIVE ACCESS PASS' : 'STANDARD ACCESS PASS'), pageWidth / 2, 95, { align: 'center' });
  
  // Card background for main content
  const cardMargin = 20;
  const cardY = 110;
  const cardHeight = 130;
  doc.setFillColor(40, 40, 60);
  doc.roundedRect(cardMargin, cardY, pageWidth - (cardMargin * 2), cardHeight, 3, 3, 'F');
  
  // QR Code (original size with compression)
  const qrSize = 90;
  const qrX = pageWidth / 2 - qrSize / 2;
  const qrY = cardY + 10;
  doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST');
  
  // Ticket ID
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237); // Gold for VIP, Blue for Standard
  doc.text(`TICKET #${String(ticket.id).padStart(4, '0')}`, pageWidth / 2, qrY + qrSize + 15, { align: 'center' });
  
  // Instructions section
  const instrY = cardY + cardHeight + 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237);
  doc.text('ENTRY INSTRUCTIONS', pageWidth / 2, instrY, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  const instructions = [
    isVIP ? 'Present this pass at the VIP entrance' : 'Present this pass at the entrance',
    'Valid for single entry only',
  ];
  instructions.forEach((instr, idx) => {
    doc.text(instr, pageWidth / 2, instrY + 7 + (idx * 5), { align: 'center' });
  });
  
  // Footer
  doc.setFillColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(customization.footer || 'MANGALEVENTS.COM', pageWidth / 2, pageHeight - 9, { align: 'center' });
  
  // Bottom decorative corners only
  doc.setDrawColor(isVIP ? 218 : 100, isVIP ? 165 : 149, isVIP ? 32 : 237);
  doc.setLineWidth(2);
  // Bottom-left corner
  doc.line(10, pageHeight - 10, 30, pageHeight - 10);
  doc.line(10, pageHeight - 10, 10, pageHeight - 30);
  // Bottom-right corner
  doc.line(pageWidth - 10, pageHeight - 10, pageWidth - 30, pageHeight - 10);
  doc.line(pageWidth - 10, pageHeight - 10, pageWidth - 10, pageHeight - 30);
}

interface PassCustomization {
  eventName?: string;
  subtitle?: string;
  footer?: string;
  passType?: 'VIP' | 'STANDARD';
}

async function generateVIPPasses(
  ticketIds: number[],
  eventId: number,
  host: string,
  outputFile: string,
  customization: PassCustomization,
  individual: boolean = false
): Promise<void> {
  console.log(`Generating VIP passes for ${ticketIds.length} tickets...`);
  console.log(`Event ID: ${eventId}`);
  console.log(`Host: ${host}`);
  console.log(`Secret: ${TICKET_SECRET.slice(0, 4)}***`);
  console.log(`Mode: ${individual ? 'Individual files' : 'Single file'}`);
  console.log('');

  // Load and compress logo image
  let logoDataURL: string | undefined;
  try {
    const logoPath = path.join(__dirname, 'maila_Guys.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      const base64Logo = logoBuffer.toString('base64');
      logoDataURL = `data:image/png;base64,${base64Logo}`;
      console.log('✓ Logo loaded successfully');
    } else {
      console.log('⚠️  Logo file not found, continuing without logo');
    }
  } catch (error) {
    console.log('⚠️  Could not load logo, continuing without logo');
  }

  if (individual) {
    // Create passes directory structure
    const passesDir = path.join(__dirname, 'passes');
    const eventDir = path.join(passesDir, `event-${eventId}`);
    const timestampDir = path.join(eventDir, new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-'));
    
    // Ensure directories exist
    fs.mkdirSync(passesDir, { recursive: true });
    fs.mkdirSync(eventDir, { recursive: true });
    fs.mkdirSync(timestampDir, { recursive: true });
    
    console.log(`📁 Saving individual passes to: ${path.relative(process.cwd(), timestampDir)}`);
    console.log('');
    
    // Generate individual PDF files
    const generatedFiles: string[] = [];
    
    for (const ticketId of ticketIds) {
      // Create individual PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
        precision: 16,
        userUnit: 1.0,
      });

      doc.setProperties({
        title: `${customization.passType || 'VIP'} Pass - Ticket #${ticketId}`,
        creator: 'Nepathya Ticket System',
      });

      // Generate token
      const token = generateToken(ticketId, eventId);
      
      const ticketData: TicketData = {
        id: ticketId,
        eventId: eventId,
        token: token,
        eventName: customization.eventName
      };
      
      const qrUrl = `${host}/entry/${token}`;
      const qrDataURL = await generateQRCodeDataURL(qrUrl);
      
      await createVIPPass(doc, ticketData, qrDataURL, host, customization, logoDataURL);
      
      // Generate organized filename
      const passType = (customization.passType || 'VIP').toLowerCase();
      const individualFile = path.join(
        timestampDir, 
        `${passType}-pass-${String(ticketId).padStart(4, '0')}-${token}.pdf`
      );
      
      // Save individual PDF
      const pdfOutput = doc.output('arraybuffer');
      fs.writeFileSync(individualFile, Buffer.from(pdfOutput));
      generatedFiles.push(individualFile);
      
      console.log(`✓ ${path.basename(individualFile)} (Event ${eventId}, Ticket #${ticketId})`);
    }

    // Create index file with details
    const indexFile = path.join(timestampDir, 'README.md');
    const indexContent = `# ${customization.passType || 'VIP'} Passes - Event ${eventId}

Generated on: ${new Date().toLocaleString()}
Total passes: ${generatedFiles.length}
Event: ${customization.eventName || 'N/A'}

## Pass Details
${generatedFiles.map((file, index) => {
  const ticketId = ticketIds[index];
  const token = generateToken(ticketId, eventId);
  return `- **${path.basename(file)}**
  - Ticket ID: ${ticketId}
  - Token: ${token}
  - QR URL: ${host}/entry/${token}`;
}).join('\n\n')}

## Distribution Instructions
1. Each PDF file contains one ${(customization.passType || 'VIP').toLowerCase()} pass
2. Send individual files to respective ticket holders
3. Passes are ready for digital distribution or printing
4. Each pass contains a unique QR code for entry validation
`;

    fs.writeFileSync(indexFile, indexContent);

    console.log('');
    console.log(`✅ Generated ${generatedFiles.length} individual passes:`);
    
    let totalSize = 0;
    generatedFiles.forEach((file, index) => {
      const fileSizeKB = Math.round(fs.statSync(file).size / 1024);
      totalSize += fileSizeKB;
      console.log(`   ${path.basename(file)}: ${fileSizeKB} KB`);
    });
    
    console.log(`   README.md: ${Math.round(fs.statSync(indexFile).size / 1024)} KB`);
    console.log(`   Total size: ${totalSize} KB`);
    console.log('');
    console.log(`📁 All files saved in: ${path.relative(process.cwd(), timestampDir)}`);
    console.log('📄 Ready to distribute! Each ticket is in a separate PDF file.');
    console.log('📋 Check README.md for detailed pass information.');
    
  } else {
    // Generate single combined PDF (existing logic)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
      precision: 16,
      userUnit: 1.0,
    });

    doc.setProperties({
      title: 'VIP Passes',
      creator: 'Nepathya Ticket System',
    });

    try {
      for (let i = 0; i < ticketIds.length; i++) {
        const ticketId = ticketIds[i];
        
        const token = generateToken(ticketId, eventId);
        
        const ticketData: TicketData = {
          id: ticketId,
          eventId: eventId,
          token: token,
          eventName: customization.eventName
        };
        
        const qrUrl = `${host}/entry/${token}`;
        const qrDataURL = await generateQRCodeDataURL(qrUrl);
        
        if (i > 0) {
          doc.addPage();
        }
        
        await createVIPPass(doc, ticketData, qrDataURL, host, customization, logoDataURL);
        
        console.log(`✓ Generated pass for Event ${eventId}, Ticket #${ticketId} (${token})`);
      }

      const pdfOutput = doc.output('arraybuffer');
      fs.writeFileSync(outputFile, Buffer.from(pdfOutput));
      
      console.log('');
      console.log(`✅ VIP passes saved to: ${outputFile}`);
      const fileSizeKB = Math.round(fs.statSync(outputFile).size / 1024);
      console.log(`   File size: ${fileSizeKB} KB`);
      console.log(`   Total pages: ${ticketIds.length}`);
      console.log(`   Average per page: ${Math.round(fileSizeKB / ticketIds.length)} KB`);
      console.log('');
      console.log('📄 Ready to print! Each pass is one A4 page.');
      
    } catch (error) {
      console.error('❌ Error generating VIP passes:', error);
      throw error;
    }
  }
}

// CLI setup
const program = new Command();

program
  .name('generate-vip-passes')
  .description('Generate printable VIP passes with QR codes (PDF)')
  .option('--start <number>', 'Starting ticket ID')
  .option('--end <number>', 'Ending ticket ID')
  .option('--tickets <list>', 'Comma-separated ticket IDs (e.g., 1,5,10,25)')
  .option('--event-id <number>', 'Event ID for tickets', '1')
  .option('--host <url>', 'Host URL for QR codes (overrides NEXT_PUBLIC_VALID_DOMAIN)', NEXT_PUBLIC_VALID_DOMAIN)
  .option('--output <file>', 'Output PDF filename', 'vip-passes.pdf')
  .option('--event-name <name>', 'Custom event name for passes')
  .option('--subtitle <text>', 'Custom subtitle text')
  .option('--footer <text>', 'Custom footer text')
  .option('--type <type>', 'Pass type: VIP or STANDARD', 'VIP')
  .option('--individual', 'Generate separate PDF files in organized passes/ folder')
  .action(async (options) => {
    let ticketIds: number[] = [];
    
    // Parse ticket IDs
    if (options.tickets) {
      ticketIds = options.tickets.split(',').map((id: string) => parseInt(id.trim()));
    } else if (options.start && options.end) {
      const start = parseInt(options.start);
      const end = parseInt(options.end);
      
      if (isNaN(start) || isNaN(end) || start > end || start < 1) {
        console.error('❌ Error: Invalid start/end values. Start must be >= 1 and <= end.');
        process.exit(1);
      }
      
      for (let i = start; i <= end; i++) {
        ticketIds.push(i);
      }
    } else {
      console.error('❌ Error: Must specify either --start/--end or --tickets');
      process.exit(1);
    }
    
    const eventId = parseInt(options.eventId);
    if (isNaN(eventId) || eventId < 1) {
      console.error('❌ Error: Invalid event ID. Event ID must be >= 1.');
      process.exit(1);
    }
    
    const passType = options.type.toUpperCase();
    if (passType !== 'VIP' && passType !== 'STANDARD') {
      console.error('❌ Error: Pass type must be either VIP or STANDARD.');
      process.exit(1);
    }
    
    const customization: PassCustomization = {
      eventName: options.eventName,
      subtitle: options.subtitle,
      footer: options.footer,
      passType: passType as 'VIP' | 'STANDARD'
    };
    
    await generateVIPPasses(
      ticketIds,
      eventId,
      options.host,
      options.output,
      customization,
      options.individual
    );
  });

program.parse();
