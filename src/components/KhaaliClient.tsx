'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { KhaaliInitialData } from '@/lib/domain/types';
import { formatRelativeTime, isDaytime } from '@/lib/domain/time';
import { HeroAnswer } from './HeroAnswer';
import { RoomRow } from './RoomRow';
import { FilterChips } from './FilterChips';
import { TimeSelectorBar } from './TimeSelectorBar';
import { StatusBanner } from './StatusBanner';
import { MyGapCard } from './MyGapCard';
import { useTimetableData } from '@/hooks/useTimetableData';
import { useTimeNavigation } from '@/hooks/useTimeNavigation';
import { useVacancy } from '@/hooks/useVacancy';

// Re-export domain type for backward compatibility
export type { KhaaliInitialData } from '@/lib/domain/types';

// Lazy-load modal dialogs to reduce critical initial bundle size
const SearchModal = lazy(() =>
  import('./SearchModal').then(m => ({ default: m.SearchModal }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('./KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal }))
);

interface KhaaliClientProps {
  initialData: KhaaliInitialData;
}

function parseDateFromDDMMYYYY(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

function checkOutsideValidityWindow(
  now: Date,
  window?: { startDate: string; endDate: string }
): boolean {
  if (!window || !window.startDate || !window.endDate) return false;
  const start = parseDateFromDDMMYYYY(window.startDate);
  const end = parseDateFromDDMMYYYY(window.endDate);
  if (!start || !end) return false;

  end.setHours(23, 59, 59, 999);
  return now < start || now > end;
}

export function KhaaliClient({ initialData }: KhaaliClientProps) {
  // Modal visibility states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [neverScheduledOpen, setNeverScheduledOpen] = useState(false);

  // 1. Theme mode state ('auto' | 'dark' | 'light')
  const [themeMode, setThemeModeState] = useState<'auto' | 'dark' | 'light'>('auto');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('khaali_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemeModeState(savedTheme);
      }
      // Anything else (no stored value, or a stored 'auto') keeps the default 'auto' mode.
    } catch {
      // Ignore
    }
  }, []);

  const handleSetThemeMode = (mode: 'auto' | 'dark' | 'light') => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('khaali_theme', mode);
    } catch {
      // Ignore
    }
  };

  // 2. Timetable data hook (data, substitutions, occupancy store, batch/prof lists)
  const {
    periods,
    rooms,
    validityWindow,
    fetchedAt,
    isStaleData,
    effectiveOccupancies,
    occupancyStore,
    allBatches,
    allProfessors,
  } = useTimetableData(initialData);

  // 3. Time navigation hook (minute-gated clock, period/day selection, URL sync, shortcuts)
  const {
    now,
    istInfo,
    detection,
    selectedDay,
    selectedPeriod,
    selectedBuilding,
    setSelectedBuilding,
    isLive,
    announcement,
    handleResetToLive,
    handleSelectDay,
    handleSelectPeriod,
  } = useTimeNavigation({
    periods,
    onOpenSearch: useCallback(() => setIsSearchOpen(true), []),
    onToggleShortcuts: useCallback(() => setIsShortcutsOpen(prev => !prev), []),
    onCloseModals: useCallback(() => {
      setIsSearchOpen(false);
      setIsShortcutsOpen(false);
    }, []),
    isModalOpen: isSearchOpen || isShortcutsOpen,
  });

  const resolvedTheme = useMemo<'dark' | 'light'>(() => {
    if (themeMode === 'auto') {
      return isDaytime(istInfo.minutesSinceMidnight) ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, istInfo]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', resolvedTheme === 'light');
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  // 4. Vacancy evaluation hook (O(1) schedule lookups, filtering, hero room)
  const {
    evaluation,
    filteredRuns,
    buildingCounts,
    filteredNeverScheduled,
    heroRoom,
    heroSchedule,
    remainingRooms,
    getRoomPriorAndNext,
  } = useVacancy({
    selectedDay,
    selectedPeriod,
    selectedBuilding,
    rooms,
    periods,
    occupancyStore,
    effectiveOccupancies,
  });

  // Register PWA Service Worker in production
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Validity and hours checks
  const isOutsideValidity = useMemo(() => {
    return checkOutsideValidityWindow(now, validityWindow);
  }, [now, validityWindow]);

  const isSunday = istInfo.dayIndex === null && isLive;
  const isBeforeHours = detection.state === 'BEFORE_HOURS' && isLive;
  const isAfterHours = detection.state === 'AFTER_HOURS' && isLive;

  return (
    <div className="min-h-screen bg-page-bg text-cell-ink selection:bg-brand selection:text-white flex flex-col justify-between">
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#main-board"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-signal focus:text-page-bg focus:font-mono focus:font-bold border border-hairline"
      >
        SKIP TO VACANCY BOARD
      </a>

      {/* Top Outer Shell */}
      <div className="max-w-desktop w-full mx-auto p-3 sm:p-5 lg:p-6">
        {/* Responsive Layout: Desktop 2-Column Grid / Mobile Single Column */}
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">
          {/* ========================================================================= */}
          {/* LEFT RAIL (Desktop persistent sidebar / Mobile header strip) */}
          {/* ========================================================================= */}
          <aside className="w-full lg:w-80 lg:shrink-0 space-y-3.5">
            {/* Header / Brand & Clock Casing */}
            <div className="border border-hairline bg-cell-bg p-3.5 sm:p-4">
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black tracking-wider text-cell-ink">
                    KHAALI
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Desktop keyboard shortcuts affordance [?] */}
                  <button
                    type="button"
                    onClick={() => setIsShortcutsOpen(true)}
                    title="Keyboard & gesture commands [?]"
                    aria-label="Keyboard and gesture commands guide"
                    className="hidden [@media(hover:hover)_and_(pointer:fine)]:flex items-center justify-center w-7 h-7 bg-page-bg border border-hairline hover:border-signal text-cell-ink text-xs font-mono font-bold uppercase transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                  >
                    ?
                  </button>

                  {/* NIGHT | AUTO | DAY Theme Switch */}
                  <div className="flex items-center border border-hairline bg-page-bg font-mono text-xs">
                    <button
                      type="button"
                      aria-pressed={themeMode === 'dark'}
                      onClick={() => handleSetThemeMode('dark')}
                      className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                        themeMode === 'dark'
                          ? 'bg-board-case text-signal border-b-2 border-signal'
                          : 'text-muted hover:text-cell-ink'
                      }`}
                    >
                      NIGHT
                    </button>
                    <span className="w-px h-3.5 bg-hairline shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      title="Follows real campus time: DAY 06:00-18:00 IST, NIGHT otherwise"
                      aria-pressed={themeMode === 'auto'}
                      onClick={() => handleSetThemeMode('auto')}
                      className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                        themeMode === 'auto'
                          ? 'bg-board-case text-signal border-b-2 border-signal'
                          : 'text-muted hover:text-cell-ink'
                      }`}
                    >
                      AUTO
                    </button>
                    <span className="w-px h-3.5 bg-hairline shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      aria-pressed={themeMode === 'light'}
                      onClick={() => handleSetThemeMode('light')}
                      className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                        themeMode === 'light'
                          ? 'bg-board-case text-signal border-b-2 border-signal'
                          : 'text-muted hover:text-cell-ink'
                      }`}
                    >
                      DAY
                    </button>
                  </div>
                </div>
              </div>

              {/* Solari Mechanical Clock */}
              <div className="pt-3 flex items-center justify-between font-mono">
                <div>
                  <div className="text-[10px] text-muted uppercase">CAMPUS TIME (IST)</div>
                  <div className="text-2xl font-bold tracking-tight text-cell-ink tabular-nums">
                    {istInfo.timeString}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted uppercase">DAY</div>
                  <div className="text-sm font-bold text-cell-ink uppercase">
                    {istInfo.weekdayShort}
                  </div>
                </div>
              </div>

              {/* Station Clock Sync Status */}
              <div className="mt-2.5 pt-2 border-t border-hairline/60 flex items-center justify-between font-mono text-[10px] text-muted">
                <span className="uppercase tracking-wider">SYNC STATUS</span>
                <span className="tabular-nums uppercase font-semibold text-cell-ink" title={new Date(fetchedAt).toISOString()}>
                  LAST SYNCED: {new Date(fetchedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata',
                  })} IST · {formatRelativeTime(fetchedAt, now)}
                </span>
              </div>
            </div>

            {/* Quick Action Controls (Search) */}
            <div className="font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search faculty or room schedules"
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-cell-bg border border-hairline hover:bg-board-case/70 text-cell-ink font-bold uppercase transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" strokeWidth="2" />
                  <path strokeWidth="2" d="M21 21l-4.35-4.35" />
                </svg>
                <span>SEARCH [/]</span>
              </button>
            </div>

            {/* Desktop Vertical Filter List (Hidden on Mobile) */}
            <div className="hidden lg:block border border-hairline bg-cell-bg p-3">
              <FilterChips
                selected={selectedBuilding}
                onChange={setSelectedBuilding}
                counts={buildingCounts}
                orientation="vertical"
              />
            </div>

            {/* Personalized My Gap Timetable Flap */}
            <MyGapCard
              day={selectedDay}
              currentPeriodIndex={selectedPeriod}
              periods={periods}
              rooms={rooms}
              occupancyStore={occupancyStore}
              allBatches={allBatches}
            />

            {/* Keyboard Shortcuts Guide (Desktop only) */}
            <div className="hidden lg:block border border-hairline bg-cell-bg p-3 font-mono text-[11px] text-muted">
              <div className="uppercase tracking-wider font-bold text-cell-ink mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
                  <span>KEYBOARD COMMANDS</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShortcutsOpen(true)}
                  className="text-[10px] text-muted hover:text-signal underline uppercase focus:outline-none"
                >
                  FULL GUIDE [?]
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Cycle Day</span>
                  <span className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink">← / →</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cycle Period</span>
                  <span className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink">↑ / ↓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Search Faculty/Room</span>
                  <span className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink">/</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shortcuts & Gestures</span>
                  <span className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink">?</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Dismiss Dialog</span>
                  <span className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink">ESC</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* RIGHT MAIN PANE (The Solari Departure Board) */}
          {/* ========================================================================= */}
          <main className="flex-1 min-w-0 w-full" id="main-board">
            {/* Screen reader live announcement for day/period selection */}
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </div>

            {/* Split-Flap Board Housing Frame */}
            <div className="border border-hairline bg-board-case p-3 sm:p-4 mb-3">
              {/* Board Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-hairline font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-signal shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cell-ink">
                    CLASSROOM VACANCY
                  </span>
                </div>
                <div className="text-xs text-muted tabular-nums uppercase">
                  {filteredRuns.length} VACANT {filteredRuns.length === 1 ? 'ROOM' : 'ROOMS'} LISTED
                </div>
              </div>

              {/* Period & Day Selector Controls */}
              <TimeSelectorBar
                periods={periods}
                selectedDay={selectedDay}
                selectedPeriod={selectedPeriod}
                onSelectDay={handleSelectDay}
                onSelectPeriod={handleSelectPeriod}
                isLive={isLive}
                onResetToLive={handleResetToLive}
              />
            </div>

            {/* Status & Validity Warnings */}
            <StatusBanner
              isStale={isStaleData}
              staleTime={new Date(fetchedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Kolkata',
              })}
              isOutsideValidityWindow={isOutsideValidity}
              validityWindow={validityWindow}
            />

            {/* Row 1 / Best Pick Hero Integration */}
            <HeroAnswer
              hero={heroRoom}
              noClassesToday={evaluation.noClassesToday}
              isAfterHours={isAfterHours}
              isBeforeHours={isBeforeHours}
              isSunday={isSunday}
              prevClass={heroSchedule.prevClass}
              nextClass={heroSchedule.nextClass}
              periods={periods}
            />

            {/* Multi-Column Departure Board Grid */}
            {!evaluation.noClassesToday && remainingRooms.length > 0 && (
              <section className="my-3" aria-label="Remaining vacant classrooms">
                <div className="flex items-center justify-between text-xs font-mono text-muted mb-2 px-0.5">
                  <span className="uppercase tracking-wider">
                    {remainingRooms.length} ADDITIONAL VACANCIES // SORTED BY DURATION
                  </span>
                  <span className="text-[11px] uppercase tracking-wider hidden sm:inline">
                    DESKTOP: HOVER ROW TO INSPECT SCHEDULE
                  </span>
                </div>

                <ul
                  key={`${selectedDay}-${selectedPeriod}-${selectedBuilding}`}
                  className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2 flap-animate"
                  role="list"
                >
                  {remainingRooms.map((run, idx) => {
                    const schedule = getRoomPriorAndNext(run.roomId, run.endPeriod);
                    return (
                      <RoomRow
                        key={run.roomId}
                        run={run}
                        rank={idx + 2}
                        prevClass={schedule.prevClass}
                        nextClass={schedule.nextClass}
                        periods={periods}
                      />
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Never Scheduled Rooms Section (Mechanical Drawer) */}
            {filteredNeverScheduled.length > 0 && (
              <section className="my-4 border border-hairline bg-cell-bg">
                <button
                  type="button"
                  onClick={() => setNeverScheduledOpen(prev => !prev)}
                  aria-expanded={neverScheduledOpen}
                  className="min-h-[44px] w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-cell-ink hover:text-signal transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-unlit shrink-0" aria-hidden="true" />
                    <span className="uppercase">
                      NEVER SCHEDULED ROOMS // SPECIAL / LOCKED ({filteredNeverScheduled.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 border border-hairline bg-board-case">
                    {neverScheduledOpen ? '[-] HIDE' : '[+] SHOW'}
                  </span>
                </button>

                {neverScheduledOpen && (
                  <div className="p-3 pt-2 border-t border-hairline bg-board-case/40">
                    <p className="text-[11px] text-muted mb-2.5 font-mono">
                      These classrooms have zero scheduled sessions across the entire timetable week. They may be departmental labs, conference rooms, or locked.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredNeverScheduled.map(room => (
                        <span
                          key={room.id}
                          title={room.name}
                          className="px-2 py-1 bg-cell-bg border border-hairline text-xs font-mono text-muted uppercase"
                        >
                          {room.short} [{room.building}]
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Mobile/Tablet Bottom Sticky Filter Bar (Hidden on Desktop ≥1024px) */}
      <div className="lg:hidden mt-auto">
        <FilterChips
          selected={selectedBuilding}
          onChange={setSelectedBuilding}
          counts={buildingCounts}
          orientation="horizontal"
        />
      </div>

      {/* Mechanical Board Footer */}
      <footer className="border-t border-hairline py-3 px-4 text-center font-mono text-[11px] text-muted bg-page-bg">
        <div className="max-w-desktop mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>Khaali — School of Computer Science & Engineering, IILM University Greater Noida.</span>
          <span>Unofficial board. Always verify with department notice boards.</span>
        </div>
      </footer>

      {/* Faculty & Room Search / Inquiry Dialog (Lazy Loaded) */}
      <Suspense fallback={null}>
        {isSearchOpen && (
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            day={selectedDay}
            currentPeriod={selectedPeriod}
            periods={periods}
            rooms={rooms}
            occupancies={effectiveOccupancies}
            allProfessors={allProfessors}
          />
        )}
      </Suspense>

      {/* Keyboard & Gesture Shortcuts Guide Modal (Lazy Loaded) */}
      <Suspense fallback={null}>
        {isShortcutsOpen && (
          <KeyboardShortcutsModal
            isOpen={isShortcutsOpen}
            onClose={() => setIsShortcutsOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
