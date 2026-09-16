import React from 'react';

interface StatusBannerProps {
  isStale?: boolean;
  staleTime?: string;
  isOutsideValidityWindow?: boolean;
  validityWindow?: { startDate: string; endDate: string };
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  isStale,
  staleTime,
  isOutsideValidityWindow,
  validityWindow,
}) => {
  if (!isStale && !isOutsideValidityWindow) {
    return null;
  }

  return (
    <div className="my-2 space-y-1.5" role="alert">
      {isStale && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
          <span className="text-sm leading-none select-none">⚠</span>
          <div>
            Showing cached data from {staleTime || 'earlier'}. Couldn&apos;t reach the timetable server.
          </div>
        </div>
      )}

      {isOutsideValidityWindow && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
          <span className="text-sm leading-none select-none">⚠</span>
          <div>
            This timetable may be out of date. Active validity window was{' '}
            {validityWindow?.startDate} – {validityWindow?.endDate}.
          </div>
        </div>
      )}
    </div>
  );
};
