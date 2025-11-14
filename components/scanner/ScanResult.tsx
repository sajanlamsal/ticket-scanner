import { Card, CardContent } from '@/components/ui/card';
import { ScanResult as ScanResultType } from '@/hooks/useScanProcessor';

interface ScanResultProps {
  result: ScanResultType | null;
}

export function ScanResult({ result }: ScanResultProps) {
  if (!result) return null;

  return (
    <Card className={`transition-all duration-300 ease-in-out ${
      result.type === 'success' ? 'border-green-200 bg-green-50/50' :
      result.type === 'warning' ? 'border-yellow-200 bg-yellow-50/50' :
      'border-destructive/20 bg-destructive/5'
    }`}>
      <CardContent className="p-3 sm:p-4">
        <h3 className="font-bold text-base sm:text-lg mb-1">{result.title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mb-2">{result.message}</p>
        
        {result.details && (
          <div className="text-xs space-y-1 text-muted-foreground">
            {result.details.eventName && <div>Event: {result.details.eventName}</div>}
            {result.details.ticketId && <div>Ticket: #{result.details.ticketId}</div>}
            {result.details.attendee_name && <div>Name: {result.details.attendee_name}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
