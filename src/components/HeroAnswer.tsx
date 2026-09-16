import React from 'react';
import { ExtendedFreeRun } from '@/lib/domain/vacancy';

interface HeroAnswerProps {
  hero: ExtendedFreeRun | null;
  noClassesToday?: boolean;
  isAfterHours?: boolean;
  isBeforeHours?: boolean;
  isSunday?: boolean;
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

function getFloorLabel(floor: number | null): string {
  if (floor === null) return 'Ground / Special';
  if (floor === 1) return '1st floor';
  if (floor === 2) return '2nd floor';
  if (floor === 3) return '3rd floor';
  return `${floor}th floor`;
}

export const HeroAnswer: React.FC<HeroAnswerProps> = ({
  hero,
  noClassesToday,
  isAfterHours,
  isBeforeHours,
  isSunday,
}) => {
  if (isSunday) {
    return (
      <section
        aria-live="polite"
        className="p-5 my-3 rounded-lg bg-surface border border-border"
      >
        <div className="text-muted text-xs uppercase tracking-wider font-mono mb-1">
          Sunday · Campus Closed
        </div>
        <div className="text-2xl font-bold tracking-tight text-text">
          No classes scheduled today
        </div>
        <p className="text-muted text-sm mt-1">
          Timetables run Monday to Saturday from 09:00 to 17:15 IST.
        </p>
      </section>
    );
  }

  if (noClassesToday) {
    return (
      <section
        aria-live="polite"
        className="p-5 my-3 rounded-lg bg-surface border border-border"
      >
        <div className="text-soon text-xs uppercase tracking-wider font-mono mb-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-soon inline-block" />
          Special Schedule
        </div>
        <div className="text-2xl font-bold tracking-tight text-text">
          No classes scheduled today
        </div>
        <p className="text-muted text-sm mt-1">
          Rooms may be locked. Verify with department office.
        </p>
      </section>
    );
  }

  if (isBeforeHours) {
    return (
      <section
        aria-live="polite"
        className="p-5 my-3 rounded-lg bg-surface border border-border"
      >
        <div className="text-muted text-xs uppercase tracking-wider font-mono mb-1">
          Before College Hours
        </div>
        <div className="text-2xl font-bold tracking-tight text-text">
          Classes begin at 09:00 IST
        </div>
        <p className="text-muted text-sm mt-1">
          {hero ? `Showing room vacancy for upcoming Period 1: ${hero.room.name} (${getFloorLabel(hero.room.floor)})` : 'Calculating morning schedule...'}
        </p>
      </section>
    );
  }

  if (isAfterHours) {
    return (
      <section
        aria-live="polite"
        className="p-5 my-3 rounded-lg bg-surface border border-border"
      >
        <div className="text-muted text-xs uppercase tracking-wider font-mono mb-1">
          After College Hours
        </div>
        <div className="text-2xl font-bold tracking-tight text-text">
          College hours ended at 17:15 IST
        </div>
        <p className="text-muted text-sm mt-1">
          Classrooms are typically locked overnight. Showing final period state.
        </p>
      </section>
    );
  }

  if (!hero) {
    return (
      <section
        aria-live="polite"
        className="p-5 my-3 rounded-lg bg-surface border border-border text-center"
      >
        <div className="text-soon text-sm font-mono">
          No vacant classrooms found for this slot
        </div>
        <p className="text-muted text-xs mt-1">
          All teaching rooms are scheduled or in use. Try selecting another period.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      className="p-6 my-3 rounded-lg bg-surface border border-border relative overflow-hidden transition-all duration-150"
    >
      {/* Visual Accent Pill */}
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium tracking-wide uppercase text-free">
          <span className="w-2 h-2 rounded-full bg-free animate-pulse" />
          Vacant Now · Best Match
        </span>
        <span className="text-xs font-mono text-muted tabular-nums">
          P{hero.startPeriod}–P{hero.endPeriod}
        </span>
      </div>

      {/* Main Room Code */}
      <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-text my-1">
        {hero.room.name}
      </div>

      {/* Duration Highlight in --free */}
      <div className="text-free text-xl sm:text-2xl font-bold tracking-tight mt-1 flex items-baseline gap-2">
        <span>free for {formatDuration(hero.durationMinutes)}</span>
      </div>

      {/* Until & Floor Metadata */}
      <div className="text-muted text-sm sm:text-base font-mono mt-2 flex items-center flex-wrap gap-2 tabular-nums">
        <span>until {hero.endTime}</span>
        <span className="text-border">·</span>
        <span>{getFloorLabel(hero.room.floor)}</span>
        <span className="text-border">·</span>
        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-xs border border-border">
          {hero.room.building}
        </span>
      </div>
    </section>
  );
};
