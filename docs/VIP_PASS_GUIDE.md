# VIP Pass Generator

Professional VIP pass generator for event tickets with QR codes. Creates beautiful, printable passes - one A4 page per ticket.

**Simplified Approach**: Generates tokens on-the-fly using `TICKET_SECRET` from environment - no database connection required!

## Features

✨ **Professional Design**
- Gold and dark blue color scheme
- VIP badge and branding elements
- Decorative corner accents
- Clean, modern layout

🎫 **Ticket Information**
- QR code for entry verification (90mm x 90mm)
- Ticket ID with leading zeros (#0001, #0002, etc.)
- Token for manual verification
- Event name and details
- Event ID encoded in token

🖨️ **Print Ready**
- A4 format (210mm x 297mm)
- One pass per page
- High-quality QR codes
- Professional card stock compatible

## Quick Start

### 1. Generate Passes for a Range

```bash
npm run generate-vip-passes -- --start=1 --end=10 --event-id=1 --event-name="Nepathya Concert 2025"
```

This creates `vip-passes.pdf` with 10 pages (Event 1, tickets 1-10).

### 2. Generate Specific Tickets

```bash
npm run generate-vip-passes -- --tickets=5,12,25,48 --event-id=1 --event-name="VIP Backstage"
```

Creates passes only for the specified ticket IDs in Event 1.

### 3. Custom Branding

```bash
npm run generate-vip-passes -- --start=1 --end=20 --event-id=1 \
  --event-name="Nepathya Live 2025" \
  --subtitle="ALL ACCESS • BACKSTAGE" \
  --footer="NEPATHYA ENTERTAINMENT PVT. LTD." \
  --output=custom-vip-passes.pdf
```

### 4. Multiple Events

Generate passes for different events with different tokens:

```bash
# Event 1 - Main Concert
npm run generate-vip-passes -- --start=1 --end=50 --event-id=1 \
  --event-name="Nepathya Main Concert"

# Event 2 - After Party  
npm run generate-vip-passes -- --start=1 --end=30 --event-id=2 \
  --event-name="Nepathya After Party"
```

Note: Same ticket ID with different event ID produces different token!

## Common Use Cases

### Use Case 1: VIP Guests for Main Event

You have 50 VIP tickets (1-50) for your main event (Event ID 1):

```bash
npm run generate-vip-passes -- --start=1 --end=50 --event-id=1 \
  --event-name="Nepathya World Tour 2025" \
  --subtitle="VIP LOUNGE ACCESS" \
  --host=https://tickets.nepathya.com \
  --output=vip-main-event.pdf
```

**Result**: 50-page PDF, each with unique QR code. Print on card stock and distribute.

### Use Case 2: Last-Minute VIP Additions

Need to add 5 more VIP passes (tickets 51-55) for Event 1:

```bash
npm run generate-vip-passes -- --start=51 --end=55 --event-id=1 \
  --event-name="Nepathya World Tour 2025" \
  --subtitle="VIP LOUNGE ACCESS" \
  --output=vip-additional.pdf
```

### Use Case 3: Multi-Event Management

Running 3 different events with separate VIP passes:

```bash
# Event 1: Main Concert (100 VIP passes)
npm run generate-vip-passes -- --start=1 --end=100 --event-id=1 \
  --event-name="Nepathya Main Concert" \
  --output=event1-vip.pdf

# Event 2: Acoustic Session (50 VIP passes)
npm run generate-vip-passes -- --start=1 --end=50 --event-id=2 \
  --event-name="Acoustic Night with Nepathya" \
  --output=event2-vip.pdf

# Event 3: Meet & Greet (20 VIP passes)
npm run generate-vip-passes -- --start=1 --end=20 --event-id=3 \
  --event-name="VIP Meet & Greet" \
  --subtitle="EXCLUSIVE BACKSTAGE ACCESS" \
  --output=event3-vip.pdf
```

Each event has its own token space - Ticket #1 for Event 1, 2, and 3 all have different tokens!

## Pass Anatomy

```
┌─────────────────────────────────────────┐
│  ══════════ GOLD BAR ══════════        │
│                                         │
│           ╭─────╮                       │
│           │ VIP │  (Gold Circle)        │
│           ╰─────╯                       │
│                                         │
│        NEPATHYA LIVE 2025               │
│       EXCLUSIVE ACCESS PASS             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │       ┌─────────────┐           │   │
│  │       │             │           │   │
│  │       │  QR  CODE   │           │   │
│  │       │             │           │   │
│  │       └─────────────┘           │   │
│  │                                 │   │
│  │        TICKET #0001             │   │
│  │       Token: 1b5h8X             │   │
│  │                                 │   │
│  │       JOHN DOE                  │   │ (if available)
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│       ENTRY INSTRUCTIONS                │
│   • Present pass at VIP entrance        │
│   • QR code will be scanned             │
│   • Valid for single entry only         │
│                                         │
│  ══════════ GOLD BAR ══════════        │
│    POWERED BY NEPATHYA TICKET SYSTEM    │
│    http://localhost:3000/entry/1b5h8X   │
└─────────────────────────────────────────┘
```

## Customization Options

### Event Name
```bash
--event-name="Nepathya Concert 2025"
```
Main title on the pass. Use your event name.

### Subtitle
```bash
--subtitle="ALL ACCESS • BACKSTAGE"
```
Secondary text below the event name. Use for access level or special notes.

### Footer
```bash
--footer="NEPATHYA ENTERTAINMENT PVT. LTD."
```
Bottom text. Use for organization name or branding.

### Host URL
```bash
--host=https://tickets.yoursite.com
```
Base URL for QR codes. Use your production domain.

## Workflow Examples

### Workflow A: Simple VIP Generation

1. **Generate VIP passes directly**
   ```bash
   npm run generate-vip-passes -- --start=1 --end=20 --event-id=1 \
     --event-name="Nepathya VIP Experience" \
     --output=vip-passes.pdf
   ```

2. **Print and distribute** to VIP guests

3. **Add tickets to database** (for tracking entries)
   ```bash
   npm run generate-tokens -- --start=1 --end=20 --event-id=1
   ```

### Workflow B: Multi-Event Campaign

### Workflow B: Multi-Event Campaign

Create different pass types for different events:

```bash
# Platinum Event (Event 1, tickets 1-20)
npm run generate-vip-passes -- --start=1 --end=20 --event-id=1 \
  --event-name="Nepathya 2025 Platinum" \
  --subtitle="ALL ACCESS • BACKSTAGE • MEET & GREET" \
  --output=platinum-vip.pdf

# Gold Event (Event 2, tickets 1-50)
npm run generate-vip-passes -- --start=1 --end=50 --event-id=2 \
  --event-name="Nepathya 2025 Gold" \
  --subtitle="VIP LOUNGE • PREMIUM SEATING" \
  --output=gold-vip.pdf

# Silver Event (Event 3, tickets 1-100)
npm run generate-vip-passes -- --start=1 --end=100 --event-id=3 \
  --event-name="Nepathya 2025 Silver" \
  --subtitle="VIP ENTRANCE • PRIORITY SEATING" \
  --output=silver-vip.pdf
```

## Printing Guide

### Recommended Settings

- **Paper**: A4 card stock (200-300 GSM)
- **Print Quality**: Best/High quality
- **Color**: Color (not grayscale)
- **Scale**: 100% (Actual size)
- **Orientation**: Portrait
- **Margins**: Default

### Professional Printing

For best results:
1. Export to a print shop with the PDF
2. Request card stock printing (250 GSM recommended)
3. Optional: Add lamination for durability
4. Optional: Hole punch for lanyards

### Home Printing

1. Use premium photo paper or card stock
2. Set printer to highest quality
3. Ensure QR codes are crisp and clear
4. Test scan one pass before printing all

## QR Code Scanning

Each pass includes:
- **Large QR code** (90mm x 90mm) - easy to scan from distance
- **Token text** below QR - for manual verification if needed
- **Full URL** in footer - for reference

The QR code links to: `{host}/entry/{token}`

Example: `https://tickets.yoursite.com/entry/1b5h8X`

## Troubleshooting

### Tokens don't match database

**Reason**: `TICKET_SECRET` in `.env.local` must match when generating passes and database tickets.

**Solution**: Use the same `.env.local` file, or ensure `TICKET_SECRET` is identical.

### Wrong event ID

**Reason**: Must specify correct `--event-id` to match your ticket system.

**Solution**: Check which event ID you used when creating tickets:
```bash
# Verify with database
sqlite3 ./data/tickets.db "SELECT DISTINCT event_id FROM ticket_entry;"
```

### QR codes too small/large

The QR codes are 90mm x 90mm by default, which is optimal for A4 printing. This size ensures:
- Easy scanning from 10-30cm distance
- Good error correction
- Professional appearance

### Custom design needed

The pass design is hardcoded in the script. To customize:
1. Edit `scripts/utilities/generate_vip_passes.ts`
2. Modify the `createVIPPass` function
3. Adjust colors, layout, fonts, and sizes

## Technical Details

- **PDF Library**: jsPDF
- **QR Generator**: qrcode (npm package)
- **Token Algorithm**: Hashids with TICKET_SECRET
- **Page Format**: A4 (210mm x 297mm)
- **QR Size**: 400x400 pixels (90mm x 90mm print)
- **Color Scheme**: Gold (#DAA520) and Dark Blue (#141428)

## Security Considerations

- Each QR code is unique per ticket
- Tokens are generated using secret-based hashing
- Single-entry validation at scanning
- Token cannot be reverse-engineered to predict other tickets

## Support & Customization

For custom designs, different sizes, or additional features, edit the `createVIPPass` function in `scripts/utilities/generate_vip_passes.ts`.

Common customizations:
- Change color scheme (gold to another color)
- Add logo/image
- Modify layout
- Add additional fields (date, time, venue)
- Change paper size (Letter instead of A4)
