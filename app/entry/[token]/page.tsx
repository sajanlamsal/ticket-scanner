'use client';

import { useState, useEffect, FormEvent } from 'react';

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

  useEffect(() => {
    fetchTicketInfo();
  }, []);

  const fetchTicketInfo = async () => {
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
  };

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
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <p className="text-center">Loading ticket information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-4 text-red-600">Error</h1>
          <p className="text-center text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Event Ticket</h1>
        
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
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-bold mb-2">Current Information</h3>
                <div className="space-y-1 text-sm">
                  {ticketInfo.attendee_name && (
                    <p><strong>Name:</strong> {ticketInfo.attendee_name}</p>
                  )}
                  {ticketInfo.attendee_phone && (
                    <p><strong>Phone:</strong> {ticketInfo.attendee_phone}</p>
                  )}
                  {ticketInfo.metadata_updated_at && (
                    <p className="text-gray-500">
                      Last updated: {new Date(ticketInfo.metadata_updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Keep this page bookmarked for easy access to your ticket.</p>
        </div>
      </div>
    </div>
  );
}