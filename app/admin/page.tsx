'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, FileText, Plus, Shield, Smartphone, Database, BarChart } from 'lucide-react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/admin/login');
      return;
    }
    setIsAuthenticated(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push('/admin/login');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-2">Nepathya Ticket Management System</p>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* QR Scanner */}
          <Link href="/admin/scanner">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <QrCode className="w-8 h-8 text-blue-600" />
                  </div>
                  <CardTitle className="ml-4 text-xl">QR Scanner</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Scan QR codes at the event entrance to validate and check-in attendees.
                </p>
                <div className="text-blue-600 font-medium">
                  Open Scanner →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Ticket Management */}
          <Link href="/admin/tickets">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <FileText className="w-8 h-8 text-green-600" />
                  </div>
                  <CardTitle className="ml-4 text-xl">Ticket Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  View, search, and manage all tickets. Track entry status and attendee information.
                </p>
                <div className="text-green-600 font-medium">
                  Manage Tickets →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Generate QR Codes */}
          <Link href="/admin/generate">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Plus className="w-8 h-8 text-purple-600" />
                  </div>
                  <CardTitle className="ml-4 text-xl">Generate QR Codes</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Create new QR codes for events. Generate tickets iteratively and export as CSV or PDF.
                </p>
                <div className="text-purple-600 font-medium">
                  Generate Tickets →
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Quick Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-sm font-medium">Ticket System</div>
                <div className="text-xs text-muted-foreground mt-1">Hashids Algorithm</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <Smartphone className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-sm font-medium">Mobile Scanner</div>
                <div className="text-xs text-muted-foreground mt-1">Camera Based</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <Database className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-sm font-medium">Secure Tokens</div>
                <div className="text-xs text-muted-foreground mt-1">Server-side Secret</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <BarChart className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-sm font-medium">Real-time</div>
                <div className="text-xs text-muted-foreground mt-1">Entry Validation</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-muted-foreground text-sm">
          <p>Nepathya Ticket System - Event Management Platform</p>
        </div>
      </div>
    </div>
  );
}