'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin-layout';

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
  // Authentication is now handled by AdminLayout
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

  const fetchTickets = useCallback(async () => {
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
  }, [filter, search, pagination.offset, rowsPerPage]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Layout handles auth and logout, so we can remove these handlers

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

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Ticket Management</h1>
            <p className="text-muted-foreground mt-1">View and manage all event tickets</p>
          </div>
          <Button asChild>
            <a href="/admin/scanner">
              QR Scanner
            </a>
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filter by Status</Label>
                <Select value={filter} onValueChange={handleFilterChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    <SelectItem value="entered">Entered</SelectItem>
                    <SelectItem value="not-entered">Not Entered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search (ID or Token)</Label>
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by ticket ID or token..."
                />
              </div>

              <div className="space-y-2">
                <Label>Rows per page</Label>
                <Select value={rowsPerPage.toString()} onValueChange={(value) => handleRowsPerPageChange(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <Button onClick={fetchTickets}>
                Refresh
              </Button>
              
              {/* Pagination Info */}
              <div className="text-sm text-muted-foreground">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.totalCount)} of {pagination.totalCount} tickets
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <p className="text-center">Loading tickets...</p>
            </CardContent>
          </Card>
        )}

        {/* Tickets Table */}
        {!loading && (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Entry Info</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">
                          #{ticket.id}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {ticket.token}
                        </TableCell>
                        <TableCell>
                          {ticket.entered_at ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                              Entered
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            {ticket.attendee_name && (
                              <div className="font-medium">{ticket.attendee_name}</div>
                            )}
                            {ticket.attendee_phone && (
                              <div className="text-muted-foreground text-sm">{ticket.attendee_phone}</div>
                            )}
                            {!ticket.attendee_name && !ticket.attendee_phone && (
                              <span className="text-muted-foreground">No info</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {ticket.entered_at ? (
                            <div>
                              <div>{new Date(ticket.entered_at).toLocaleString()}</div>
                              {ticket.entered_by && (
                                <div className="text-xs text-muted-foreground">by {ticket.entered_by}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not entered</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="border-t p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.currentPage} of {pagination.totalPages}
                    {filter !== 'all' && (
                      <span className="ml-2">
                        (filtered by: {filter.replace('-', ' ')})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {/* First Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrevious}
                  >
                    First
                  </Button>

                  {/* Previous Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevious}
                  >
                    Previous
                  </Button>

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
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasMore}
                  >
                    Next
                  </Button>

                  {/* Last Page */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={!pagination.hasMore}
                  >
                    Last
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}