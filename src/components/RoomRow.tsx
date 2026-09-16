import React from 'react';
import { ExtendedFreeRun } from '@/lib/domain/vacancy';

interface RoomRowProps {
  run: ExtendedFreeRun;
  isHero?: boolean;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours > 0 && remainingMins > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMins}m`;
}

function getFloorShort(floor: number | null): string {
  if (floor === null) return 'grnd';
  if (floor === 1) return '1st fl';
  if (floor === 2) return '2nd fl';
  if (floor === 3) return '3rd fl';
  return `${floor}th fl`;
}

export const RoomRow: React.FC<RoomRowProps> = ({ run, isHero = false }) => {
  return (
    <li
      className={`min-h-[52px] flex items-center justify-between px-3.5 py-2.5 rounded border border-border bg-surface hover:bg-surface-2 transition-colors duration-150 ${
        isHero ? 'ring-1 ring-free/30' : ''
      }`}
    >
      {/* Left: Mono Room Code */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted text-xs font-mono select-none">▸</span>
        <span className="font-mono font-bold text-base sm:text-lg text-text tracking-tight truncate">
          {run.room.name}
        </span>
      </div>

      {/* Center & Right: Duration + Until + Floor */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 tabular-nums">
        <div className="text-right">
          <div className="text-free font-mono font-semibold text-sm sm:text-base">
            {formatDuration(run.durationMinutes)}
          </div>
          <div className="text-muted text-[11px] font-mono leading-none">
            until {run.endTime}
          </div>
        </div>

        <div className="text-right min-w-[50px]">
          <span className="inline-block px-1.5 py-0.5 rounded bg-surface-2 text-muted text-xs font-mono border border-border">
            {getFloorShort(run.room.floor)}
          </span>
        </div>
      </div>
    </li>
  );
};
