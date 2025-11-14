import { Input } from '@/components/ui/input';

interface ManualEntryProps {
  onManualScan: (token: string) => void;
}

export function ManualEntry({ onManualScan }: ManualEntryProps) {
  return (
    <div className="mt-6 pt-6 border-t">
      <details className="cursor-pointer">
        <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Manual Token Entry (Backup)
        </summary>
        <div className="mt-3 space-y-2">
          <Input
            type="text"
            placeholder="Enter token manually (e.g., 95WhBX)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const token = e.currentTarget.value.trim();
                if (token) {
                  onManualScan(token);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Press Enter after typing token
          </p>
        </div>
      </details>
    </div>
  );
}
