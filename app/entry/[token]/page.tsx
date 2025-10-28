'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Ticket } from 'lucide-react';

interface AttendeeInfo {
  name?: string;
  phone?: string;
}

interface TicketInfo {
  id: number;
  event_id: number;
  event_name: string;
  entered_at?: string;
  attendee_name?: string;
  attendee_phone?: string;
  metadata_updated_at?: string;
}

export default function EntryPage({ params }: { params: { token: string } }) {
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [attendeeInfo, setAttendeeInfo] = useState<AttendeeInfo>({});
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const fetchTicketInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/ticket/by-token?token=${params.token}`);
      
      if (response.ok) {
        const data = await response.json();
        setTicketInfo(data);
        setAttendeeInfo({
          name: data.attendee_name || '',
          phone: data.attendee_phone || '',
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ticket not found');
      }
    } catch (err) {
      setError('Failed to load ticket information');
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    fetchTicketInfo();
  }, [fetchTicketInfo]);

  const handleUpdateAttendee = async (e: FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setUpdateSuccess(false);

    try {
      const response = await fetch('/api/attendee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: params.token,
          name: attendeeInfo.name?.trim() || undefined,
          phone: attendeeInfo.phone?.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTicketInfo(data.ticket);
        setUpdateSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update information');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-center">Loading ticket information...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-md mx-auto">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-center text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Ticket className="w-6 h-6" />
              Event Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {ticketInfo && (
              <>
            {/* Event Information */}
            <div className="mb-6 p-4 rounded-lg border bg-blue-50">
              <h2 className="font-bold text-lg mb-2 text-blue-800">{ticketInfo.event_name}</h2>
              <p className="text-blue-600"><strong>Ticket ID:</strong> #{ticketInfo.id}</p>
              <p className="text-blue-600"><strong>Event ID:</strong> #{ticketInfo.event_id}</p>
            </div>

            {/* Ticket Status */}
            <div className="mb-6 p-4 rounded-lg border">
              <h2 className="font-bold text-lg mb-2">Entry Status</h2>
              
              {ticketInfo.entered_at ? (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800 font-medium">✅ Entry Confirmed</p>
                  <p className="text-sm text-green-600">
                    Entered: {new Date(ticketInfo.entered_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 font-medium">⏳ Not Yet Entered</p>
                  <p className="text-sm text-yellow-600">
                    Present this QR code at the entrance
                  </p>
                </div>
              )}
            </div>

            {/* Attendee Information Form */}
            <div className="mb-6">
              <h2 className="font-bold text-lg mb-4">Your Information</h2>
              <p className="text-sm text-gray-600 mb-4">
                Optionally provide your name and phone number for our records.
              </p>

              {updateSuccess && (
                <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800 text-sm">✅ Information updated successfully</p>
                </div>
              )}

              <form onSubmit={handleUpdateAttendee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={attendeeInfo.name || ''}
                    onChange={(e) => setAttendeeInfo({ ...attendeeInfo, name: e.target.value })}
                    placeholder="Your full name"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={attendeeInfo.phone || ''}
                    onChange={(e) => setAttendeeInfo({ ...attendeeInfo, phone: e.target.value })}
                    placeholder="Your phone number"
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update Information'}
                </button>
              </form>
            </div>

              {/* Current Information Display */}
              {(ticketInfo.attendee_name || ticketInfo.attendee_phone) && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h3 className="font-bold mb-2">Current Information</h3>
                    <div className="space-y-1 text-sm">
                      {ticketInfo.attendee_name && (
                        <p><strong>Name:</strong> {ticketInfo.attendee_name}</p>
                      )}
                      {ticketInfo.attendee_phone && (
                        <p><strong>Phone:</strong> {ticketInfo.attendee_phone}</p>
                      )}
                      {ticketInfo.metadata_updated_at && (
                        <p className="text-muted-foreground">
                          Last updated: {new Date(ticketInfo.metadata_updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Footer */}
              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                <p>Keep this page bookmarked for easy access to your ticket.</p>
              </div>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}