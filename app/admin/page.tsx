'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-2">Nepathya Ticket Management System</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Main Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* QR Scanner */}
          <Link href="/admin/scanner" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4.01M20 12h.01m-5.01-5.01h.01M12 8h.01M8 12h.01M12 16h.01m.01-8.01h.01M16 8h.01" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                  QR Scanner
                </h3>
              </div>
              <p className="text-gray-600">
                Scan QR codes at the event entrance to validate and check-in attendees.
              </p>
              <div className="mt-4 text-blue-600 font-medium">
                Open Scanner →
              </div>
            </div>
          </Link>

          {/* Ticket Management */}
          <Link href="/admin/tickets" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900 group-hover:text-green-600">
                  Ticket Management
                </h3>
              </div>
              <p className="text-gray-600">
                View, search, and manage all tickets. Track entry status and attendee information.
              </p>
              <div className="mt-4 text-green-600 font-medium">
                Manage Tickets →
              </div>
            </div>
          </Link>

          {/* Generate QR Codes */}
          <Link href="/admin/generate" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900 group-hover:text-purple-600">
                  Generate QR Codes
                </h3>
              </div>
              <p className="text-gray-600">
                Create new QR codes for events. Generate tickets iteratively and export as CSV or PDF.
              </p>
              <div className="mt-4 text-purple-600 font-medium">
                Generate Tickets →
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Information</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">🎫</div>
              <div className="text-sm text-gray-600 mt-1">Ticket System</div>
              <div className="text-xs text-gray-500 mt-1">Hashids Algorithm</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">📱</div>
              <div className="text-sm text-gray-600 mt-1">Mobile Scanner</div>
              <div className="text-xs text-gray-500 mt-1">Camera Based</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">🔒</div>
              <div className="text-sm text-gray-600 mt-1">Secure Tokens</div>
              <div className="text-xs text-gray-500 mt-1">Server-side Secret</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">📊</div>
              <div className="text-sm text-gray-600 mt-1">Real-time</div>
              <div className="text-xs text-gray-500 mt-1">Entry Validation</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Nepathya Ticket System - Event Management Platform</p>
        </div>
      </div>
    </div>
  );
}