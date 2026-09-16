import React from 'react';
import { ExtendedFreeRun } from '@/lib/domain/vacancy';
import { Occupancy, Period } from '@/lib/domain/rooms';

interface RoomRowProps {
  run: ExtendedFreeRun;
  rank?: number;
  isHero?: boolean;
  prevClass?: Occupancy | null;
  nextClass?: Occupancy | null;
  periods?: Period[];
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
  if (floor === null) return 'GRND';
  if (floor === 1) return '1ST FL';
  if (floor === 2) return '2ND FL';
  if (floor === 3) return '3RD FL';
  return `${floor}TH FL`;
}

export const RoomRow: React.FC<RoomRowProps> = ({
  run,
  rank,
  isHero = false,
  prevClass,
  nextClass,
  periods,
}) => {
  const prevPeriodObj = prevClass && periods ? periods.find(p => p.index === prevClass.period) : null;
  const nextPeriodObj = nextClass && periods ? periods.find(p => p.index === nextClass.period) : null;

  return (
    <li
      tabIndex={0}
      className={`group relative bg-cell-bg border border-hairline transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
        isHero
          ? 'border-signal/50 bg-cell-bg'
          : 'hover:bg-board-case/70'
      }`}
    >
      {/* Solari Horizontal Split-Flap Score Line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2 bg-hairline/30"
        aria-hidden="true"
      />

      <div className="min-h-[54px] flex items-center justify-between px-3 py-2 sm:px-4">
        {/* Left Column: Signal Pip + Rank + Room Code + Building */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10">
          {/* Mechanical Signal Pip (Lit Amber for Vacant) */}
          <span
            className="w-2.5 h-2.5 shrink-0 bg-signal"
            title="Lit: Vacant"
            aria-hidden="true"
          />

          {/* Optional Position Number */}
          {rank !== undefined && (
            <span className="font-mono text-xs text-muted tabular-nums select-none">
              {String(rank).padStart(2, '0')}
            </span>
          )}

          {/* Room Name */}
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono font-bold text-base sm:text-lg text-cell-ink tracking-tight truncate">
              {run.room.name}
            </span>
            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border border-hairline bg-board-case text-muted shrink-0">
              {run.room.building}
            </span>
          </div>
        </div>

        {/* Right Column: Duration + Until + Floor */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0 tabular-nums z-10">
          <div className="text-right">
            <div className="text-signal font-mono font-bold text-sm sm:text-base leading-tight">
              {formatDuration(run.durationMinutes)}
            </div>
            <div className="text-muted text-[11px] font-mono leading-none mt-0.5">
              UNTIL {run.endTime}
            </div>
          </div>

          <div className="text-right min-w-[54px]">
            <span className="inline-block px-1.5 py-0.5 bg-board-case text-muted text-xs font-mono border border-hairline">
              {getFloorShort(run.room.floor)}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Hover / Focus Schedule Inspection Panel */}
      <div className="hidden lg:group-hover:flex lg:group-focus-within:flex items-center justify-between px-3.5 py-1.5 border-t border-hairline bg-board-case text-[11px] font-mono text-muted z-20">
        <div className="truncate max-w-[48%]">
          <span className="text-muted/70 uppercase">PREV: </span>
          {prevClass ? (
            <span className="text-cell-ink">
              P{prevClass.period} {prevPeriodObj ? `(${prevPeriodObj.start})` : ''} {prevClass.subjectCode || prevClass.subjectName} ({prevClass.batchNames.join(', ')})
            </span>
          ) : (
            <span className="text-muted/60 italic">None scheduled earlier</span>
          )}
        </div>

        <span className="w-px h-3 bg-hairline mx-2 shrink-0" aria-hidden="true" />

        <div className="truncate max-w-[48%] text-right">
          <span className="text-muted/70 uppercase">NEXT: </span>
          {nextClass ? (
            <span className="text-cell-ink">
              P{nextClass.period} {nextPeriodObj ? `(${nextPeriodObj.start})` : ''} {nextClass.subjectCode || nextClass.subjectName} ({nextClass.batchNames.join(', ')})
            </span>
          ) : (
            <span className="text-signal/90">Free remainder of day</span>
          )}
        </div>
      </div>
    </li>
  );
};

