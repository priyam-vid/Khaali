import React from 'react';
import { ExtendedFreeRun } from '@/lib/domain/vacancy';
import { RoomRow } from './RoomRow';
import { Occupancy, Period } from '@/lib/domain/rooms';

interface HeroAnswerProps {
  hero: ExtendedFreeRun | null;
  noClassesToday?: boolean;
  isAfterHours?: boolean;
  isBeforeHours?: boolean;
  isSunday?: boolean;
  prevClass?: Occupancy | null;
  nextClass?: Occupancy | null;
  periods?: Period[];
}

export const HeroAnswer: React.FC<HeroAnswerProps> = ({
  hero,
  noClassesToday,
  isAfterHours,
  isBeforeHours,
  isSunday,
  prevClass,
  nextClass,
  periods,
}) => {
  if (isSunday) {
    return (
      <section
        aria-live="polite"
        className="border border-hairline bg-board-case p-4 my-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase mb-1">
          <span className="w-2 h-2 bg-unlit shrink-0" aria-hidden="true" />
          <span>SUNDAY | CAMPUS CLOSED</span>
        </div>
        <div className="text-xl font-bold font-mono tracking-tight text-cell-ink">
          NO CLASSES SCHEDULED TODAY
        </div>
        <p className="text-muted text-xs font-sans mt-1">
          Timetables operate Monday to Saturday from 09:00 to 17:15 IST.
        </p>
      </section>
    );
  }

  if (noClassesToday) {
    return (
      <section
        aria-live="polite"
        className="border border-hairline bg-board-case p-4 my-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-signal uppercase mb-1">
          <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
          <span>SPECIAL SCHEDULE NOTICE</span>
        </div>
        <div className="text-xl font-bold font-mono tracking-tight text-cell-ink">
          NO ACTIVE SESSIONS SCHEDULED
        </div>
        <p className="text-muted text-xs font-sans mt-1">
          Rooms may be locked. Please verify with department office.
        </p>
      </section>
    );
  }

  if (isBeforeHours) {
    return (
      <section
        aria-live="polite"
        className="border border-hairline bg-board-case p-4 my-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase mb-1">
          <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
          <span>BEFORE COLLEGE HOURS | OPENS 09:00 IST</span>
        </div>
        <div className="text-xl font-bold font-mono tracking-tight text-cell-ink">
          CLASSES BEGIN AT 09:00 IST
        </div>
        <p className="text-muted text-xs font-sans mt-1">
          {hero
            ? `Top vacancy for upcoming Period 1: ${hero.room.name} (${hero.room.building})`
            : 'Calculating morning schedule...'}
        </p>
      </section>
    );
  }

  if (isAfterHours) {
    return (
      <section
        aria-live="polite"
        className="border border-hairline bg-board-case p-4 my-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase mb-1">
          <span className="w-2 h-2 bg-unlit shrink-0" aria-hidden="true" />
          <span>AFTER COLLEGE HOURS | ENDED 17:15 IST</span>
        </div>
        <div className="text-xl font-bold font-mono tracking-tight text-cell-ink">
          COLLEGE HOURS ENDED
        </div>
        <p className="text-muted text-xs font-sans mt-1">
          Classrooms are locked overnight. Displaying final period schedule state.
        </p>
      </section>
    );
  }

  if (!hero) {
    return (
      <section
        aria-live="polite"
        className="border border-hairline bg-board-case p-4 my-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-muted uppercase mb-1">
          <span className="w-2 h-2 bg-unlit shrink-0" aria-hidden="true" />
          <span>BOARD STATUS | ALL TEACHING ROOMS OCCUPIED</span>
        </div>
        <div className="text-lg font-bold font-mono tracking-tight text-cell-ink">
          NO VACANT CLASSROOMS FOUND
        </div>
        <p className="text-muted text-xs font-sans mt-1">
          All teaching rooms are in use for this period. Try selecting another period or day.
        </p>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="my-2">
      <div className="flex items-center justify-between pb-1.5 px-0.5 text-[11px] font-mono text-muted">
        <span className="flex items-center gap-1.5 text-signal font-bold uppercase tracking-wider">
          <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
          ROW 01 // TOP VACANCY
        </span>
        <span className="tabular-nums">
          P{hero.startPeriod}–P{hero.endPeriod} ({hero.startTime}–{hero.endTime})
        </span>
      </div>
      <ul className="list-none m-0 p-0" role="list">
        <RoomRow
          run={hero}
          rank={1}
          isHero={true}
          prevClass={prevClass}
          nextClass={nextClass}
          periods={periods}
        />
      </ul>
    </section>
  );
};

