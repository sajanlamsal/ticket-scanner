'use client';

import { useState, useEffect } from 'react';

interface Ticket {
  id: number;
  token: string;
  created_at: string;
  entered_at?: string;
  entered_by?: string;
  attendee_name?: string;
  attendee_phone?: string;
  metadata_updated_at?: string;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

export default function AdminTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all'); // 'all', 'entered', 'not-entered'
  const [search, setSearch] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: 100,
    offset: 0,
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    hasMore: false,
    hasPrevious: false,
  });
  const [rowsPerPage, setRowsPerPage] = useState(100);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    setIsAuthenticated(true);
    fetchTickets();
  }, [filter, search, pagination.offset, rowsPerPage]);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams();
      
      if (filter === 'entered') params.append('entered', 'true');
      if (filter === 'not-entered') params.append('entered', 'false');
      if (search.trim()) params.append('q', search.trim());
      params.append('limit', rowsPerPage.toString());
      params.append('offset', pagination.offset.toString());

      const response = await fetch(`/api/admin/tickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets);
        setPagination(data.pagination);
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
          return;
        }
        setError(errorData.error || 'Failed to fetch tickets');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * rowsPerPage;
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page when filtering
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page when searching
  };

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Ticket Management</h1>
          <div className="space-x-4">
            <a
              href="/admin/scanner"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              QR Scanner
            </a>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Tickets</option>
                <option value="entered">Entered</option>
                <option value="not-entered">Not Entered</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search (ID or Token)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by ticket ID or token..."
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rows per page
              </label>
              <select
                value={rowsPerPage}
                onChange={(e) => handleRowsPerPageChange(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={fetchTickets}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Refresh
            </button>
            
            {/* Pagination Info */}
            <div className="text-sm text-gray-600">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.totalCount)} of {pagination.totalCount} tickets
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-center">Loading tickets...</p>
          </div>
        )}

        {/* Tickets Table */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Token
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Info
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No tickets found
                      </td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{ticket.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {ticket.token}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ticket.entered_at ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Entered
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {ticket.attendee_name && (
                              <div className="font-medium">{ticket.attendee_name}</div>
                            )}
                            {ticket.attendee_phone && (
                              <div className="text-gray-500">{ticket.attendee_phone}</div>
                            )}
                            {!ticket.attendee_name && !ticket.attendee_phone && (
                              <span className="text-gray-400">No info</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ticket.entered_at ? (
                            <div>
                              <div>{new Date(ticket.entered_at).toLocaleString()}</div>
                              {ticket.entered_by && (
                                <div className="text-xs">by {ticket.entered_by}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not entered</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-700">
                    Page {pagination.currentPage} of {pagination.totalPages}
                    {filter !== 'all' && (
                      <span className="ml-2 text-gray-500">
                        (filtered by: {filter.replace('-', ' ')})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {/* First Page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrevious}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    First
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevious}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Previous
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 border rounded text-sm ${
                            pageNum === pagination.currentPage
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasMore}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={!pagination.hasMore}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}