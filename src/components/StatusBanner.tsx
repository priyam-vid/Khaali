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
    <div className="my-2 space-y-1" role="alert">
      {isStale && (
        <div className="p-3 bg-board-case border border-signal/60 text-cell-ink text-xs font-mono flex items-start gap-2.5">
          <span className="px-1.5 py-0.5 bg-signal text-page-bg font-bold shrink-0 text-[10px]">
            ALERT
          </span>
          <div className="leading-relaxed">
            Displaying cached timetable data from {staleTime || 'earlier'}. Server communication interrupted.
          </div>
        </div>
      )}

      {isOutsideValidityWindow && (
        <div className="p-3 bg-board-case border border-signal/60 text-cell-ink text-xs font-mono flex items-start gap-2.5">
          <span className="px-1.5 py-0.5 bg-signal text-page-bg font-bold shrink-0 text-[10px]">
            NOTICE
          </span>
          <div className="leading-relaxed">
            Timetable validity period ({validityWindow?.startDate} – {validityWindow?.endDate}) has lapsed. Schedule may have changed.
          </div>
        </div>
      )}
    </div>
  );
};

