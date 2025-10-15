#!/bin/bash

# Nepathya Ticket System - Setup Script
# This script sets up the development environment

echo "🎫 Nepathya Ticket System Setup"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Install tsx for TypeScript execution
npm install tsx

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚙️  Creating .env.local with default values..."
    cp .env.local .env.example 2>/dev/null || cat > .env.local << EOF
TICKET_SECRET=MnepThaya2025
ADMIN_JWT_SECRET=your_jwt_secret_here_at_least_32_chars_long_for_security
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/tickets.db
EOF
    echo "✅ Created .env.local"
else
    echo "✅ .env.local already exists"
fi

# Create data directory
mkdir -p data
echo "✅ Created data directory"

# Seed admin user
echo "👤 Creating admin user..."
npm run seed-admin
if [ $? -ne 0 ]; then
    echo "⚠️  Admin seeding failed, but continuing..."
fi

# Generate sample tokens
echo "🎟️  Generating sample tokens (1-20)..."
npm run generate-tokens -- --start=1 --end=20 --host=http://localhost:3000
if [ $? -ne 0 ]; then
    echo "⚠️  Token generation failed, but continuing..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "🔗 Access URLs:"
echo "   Homepage:    http://localhost:3000"
echo "   Admin Login: http://localhost:3000/admin/login"
echo "   QR Scanner:  http://localhost:3000/admin/scanner"
echo ""
echo "👤 Default admin credentials:"
echo "   Email:    admin@example.com"
echo "   Password: admin123"
echo ""
echo "📄 Sample tickets generated in: tickets-1-20.csv"