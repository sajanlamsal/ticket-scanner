export interface TicketEntry {
  // ...existing code...
  ticket_type?: string | null;
}

export interface OnlineTicket {
  id: number;
  online_ticket_number: string;
  entered_at?: Date | string | null;
  created_at?: Date | string;
}
