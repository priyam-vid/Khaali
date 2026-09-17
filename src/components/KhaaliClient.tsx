'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Period, Room, Occupancy, DayIndex } from '@/lib/domain/rooms';
import { createOccupancyStore } from '@/lib/domain/occupancy';
import { evaluateVacancy, ExtendedFreeRun } from '@/lib/domain/vacancy';
import { detectCurrentPeriod, getISTTimeInfo } from '@/lib/domain/time';
import { applySubstitutions, SubstitutionChange } from '@/lib/edupage/substitutions';
import { HeroAnswer } from './HeroAnswer';
import { RoomRow } from './RoomRow';
import { FilterChips, FilterBuilding } from './FilterChips';
import { TimeSelectorBar } from './TimeSelectorBar';
import { StatusBanner } from './StatusBanner';
import { MyGapCard } from './MyGapCard';
import { SearchModal } from './SearchModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

export interface KhaaliInitialData {
  periods: Period[];
  rooms: Room[];
  occupancies: Occupancy[];
  validityWindow?: {
    startDate: string;
    endDate: string;
  };
  fetchedAt: number;
  fromFallback: boolean;
}

interface KhaaliClientProps {
  initialData: KhaaliInitialData;
}

const DAY_MAP: Record<string, DayIndex> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
};

const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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
  const [data, setData] = useState<KhaaliInitialData>(initialData);
  const [isStaleData, setIsStaleData] = useState<boolean>(initialData.fromFallback);
  const [substitutions, setSubstitutions] = useState<SubstitutionChange[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Theme state: dark default, supports manual toggle & prefers-color-scheme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Register PWA Service Worker in production
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Theme Initialization & Sync
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('khaali_theme') as 'dark' | 'light' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('light', savedTheme === 'light');
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        setTheme('dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch {
      // Ignore
    }
  }, []);

  const setThemeMode = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    try {
      localStorage.setItem('khaali_theme', newTheme);
    } catch {
      // Ignore
    }
  };

  // Cache initial payload to localStorage for offline campus Wi-Fi resiliency
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('khaali_cached_timetable', JSON.stringify(initialData));
      }
    } catch {
      // Ignore quota errors
    }
  }, [initialData]);

  // If initial payload failed upstream, attempt restoring last-known-good from localStorage
  useEffect(() => {
    if (initialData.fromFallback) {
      try {
        const stored = localStorage.getItem('khaali_cached_timetable');
        if (stored) {
          const parsed = JSON.parse(stored) as KhaaliInitialData;
          if (parsed && parsed.periods && parsed.rooms) {
            setData(parsed);
            setIsStaleData(true);
          }
        }
      } catch {
        // Fallback safely
      }
    }
  }, [initialData.fromFallback]);

  // Fetch near-live substitutions (ISR 300s) on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSubstitutions() {
      try {
        const res = await fetch('/api/substitutions');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json && Array.isArray(json.substitutions)) {
          setSubstitutions(json.substitutions);
        }
      } catch {
        // Safe offline silent catch
      }
    }

    loadSubstitutions();
    return () => {
      cancelled = true;
    };
  }, []);

  const { periods, rooms, occupancies, validityWindow, fetchedAt } = data;

  // Merge today's substitutions if active
  const effectiveOccupancies = useMemo(() => {
    if (substitutions.length === 0) return occupancies;
    const ist = getISTTimeInfo();
    const day = (ist.dayIndex ?? 0) as DayIndex;
    return applySubstitutions(occupancies, substitutions, rooms, day);
  }, [occupancies, substitutions, rooms]);

  // Occupancy store with O(1) indexed lookups
  const occupancyStore = useMemo(() => createOccupancyStore(effectiveOccupancies), [effectiveOccupancies]);

  // Derive unique batches & teachers for search and gap tracking
  const allBatches = useMemo(() => {
    const set = new Set<string>();
    for (const occ of occupancies) {
      for (const b of occ.batchNames) {
        if (b) set.add(b);
      }
    }
    return Array.from(set).sort();
  }, [occupancies]);

  const allProfessors = useMemo(() => {
    const set = new Set<string>();
    for (const occ of occupancies) {
      for (const t of occ.teacherNames) {
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [occupancies]);

  // Current system / IST state
  const [now, setNow] = useState<Date>(() => new Date());
  const istInfo = useMemo(() => getISTTimeInfo(now), [now]);
  const detection = useMemo(() => detectCurrentPeriod(periods, now), [periods, now]);

  // Check if current date is outside validity window
  const isOutsideValidity = useMemo(() => {
    return checkOutsideValidityWindow(now, validityWindow);
  }, [now, validityWindow]);

  // Selected Day, Period, and Building states
  const [selectedDay, setSelectedDay] = useState<DayIndex>(() => detection.dayIndex ?? 0);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => detection.activePeriodIndex);
  const [selectedBuilding, setSelectedBuilding] = useState<FilterBuilding>('ALL');
  const [isManualTime, setIsManualTime] = useState(false);
  const [neverScheduledOpen, setNeverScheduledOpen] = useState(false);

  // Deep Link Query Parameter Parsing on Client Mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day')?.toLowerCase();
    const periodParam = params.get('period');
    const buildingParam = params.get('building')?.toUpperCase();

    let manual = false;

    if (dayParam && dayParam in DAY_MAP) {
      setSelectedDay(DAY_MAP[dayParam]);
      manual = true;
    }

    if (periodParam) {
      const pNum = parseInt(periodParam, 10);
      if (pNum >= 1 && pNum <= periods.length) {
        setSelectedPeriod(pNum);
        manual = true;
      }
    }

    if (buildingParam && ['ALL', 'EB', 'FB', 'SVH', 'LAW'].includes(buildingParam)) {
      setSelectedBuilding(buildingParam as FilterBuilding);
    }

    if (manual) {
      setIsManualTime(true);
    }
  }, [periods.length]);

  // Live IST Clock ticking (every 1 second)
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // 30-Second Re-Evaluation Interval: automatically roll over period when live
  useEffect(() => {
    const reEvalTimer = setInterval(() => {
      const currentNow = new Date();
      const newDetection = detectCurrentPeriod(periods, currentNow);

      if (!isManualTime) {
        if (newDetection.dayIndex !== null) {
          setSelectedDay(newDetection.dayIndex);
        }
        setSelectedPeriod(newDetection.activePeriodIndex);
      }
    }, 30000);

    return () => clearInterval(reEvalTimer);
  }, [periods, isManualTime]);

  // Auto-sync initial detection once client mounts if no deep link was provided
  useEffect(() => {
    if (!isManualTime) {
      if (detection.dayIndex !== null) {
        setSelectedDay(detection.dayIndex);
      }
      setSelectedPeriod(detection.activePeriodIndex);
    }
  }, [detection, isManualTime]);

  const isLive =
    !isManualTime &&
    selectedDay === (detection.dayIndex ?? 0) &&
    selectedPeriod === detection.activePeriodIndex;

  const handleResetToLive = () => {
    setIsManualTime(false);
    if (detection.dayIndex !== null) {
      setSelectedDay(detection.dayIndex);
    }
    setSelectedPeriod(detection.activePeriodIndex);
  };

  const handleSelectDay = (day: DayIndex) => {
    setIsManualTime(true);
    setSelectedDay(day);
  };

  const handleSelectPeriod = (periodIndex: number) => {
    setIsManualTime(true);
    setSelectedPeriod(periodIndex);
  };

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          Boolean(target.closest?.('[contenteditable="true"]')))
      ) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          return;
        }
        if (isSearchOpen) {
          setIsSearchOpen(false);
          return;
        }
      }

      // If any dialog is open, do not hijack arrows or search key
      if (isSearchOpen || isShortcutsOpen) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsManualTime(true);
        setSelectedDay(prev => ((prev + 5) % 6) as DayIndex);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsManualTime(true);
        setSelectedDay(prev => ((prev + 1) % 6) as DayIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIsManualTime(true);
        setSelectedPeriod(prev => Math.max(1, prev - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsManualTime(true);
        setSelectedPeriod(prev => Math.min(periods.length, prev + 1));
      } else if (e.key === '/') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [periods.length, isSearchOpen, isShortcutsOpen]);

  // Sync address bar URL seamlessly when filters or slots change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isManualTime && selectedBuilding === 'ALL') return;
    const dayCode = DAY_CODES[selectedDay] || 'mon';
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('day', dayCode);
    currentParams.set('period', String(selectedPeriod));
    currentParams.set('building', selectedBuilding);
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    window.history.replaceState(window.history.state, '', newUrl);
  }, [selectedDay, selectedPeriod, selectedBuilding, isManualTime]);

  // Share deep link helper
  const handleShareLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    const dayCode = DAY_CODES[selectedDay] || 'mon';
    const buildingCode = selectedBuilding;
    const url = `${window.location.origin}/?day=${dayCode}&period=${selectedPeriod}&building=${buildingCode}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  }, [selectedDay, selectedPeriod, selectedBuilding]);

  // Evaluate vacancy for selected day & period
  const evaluation = useMemo(() => {
    return evaluateVacancy(
      selectedDay,
      selectedPeriod,
      rooms,
      periods,
      occupancyStore
    );
  }, [selectedDay, selectedPeriod, rooms, periods, occupancyStore]);

  // Filter ranked runs by selected building
  const filteredRuns = useMemo(() => {
    if (selectedBuilding === 'ALL') {
      return evaluation.rankedRuns;
    }
    return evaluation.rankedRuns.filter(r => r.room.building === selectedBuilding);
  }, [evaluation.rankedRuns, selectedBuilding]);

  // Count vacant rooms per building for filter badges
  const buildingCounts = useMemo(() => {
    const counts: Partial<Record<FilterBuilding, number>> = {
      ALL: evaluation.rankedRuns.length,
      EB: 0,
      FB: 0,
      SVH: 0,
      LAW: 0,
    };
    for (const run of evaluation.rankedRuns) {
      const b = run.room.building;
      if (b in counts) {
        counts[b] = (counts[b] || 0) + 1;
      }
    }
    return counts;
  }, [evaluation.rankedRuns]);

  // Filter never-scheduled rooms by building
  const filteredNeverScheduled = useMemo(() => {
    if (selectedBuilding === 'ALL') {
      return evaluation.neverScheduledRooms;
    }
    return evaluation.neverScheduledRooms.filter(r => r.building === selectedBuilding);
  }, [evaluation.neverScheduledRooms, selectedBuilding]);

  // Prior and next class lookup helper for desktop hover inspection
  const getRoomPriorAndNext = useCallback(
    (roomId: string, endPeriod: number) => {
      const todayClasses = effectiveOccupancies
        .filter(occ => occ.day === selectedDay && occ.roomId === roomId)
        .sort((a, b) => a.period - b.period);

      const prevClass = todayClasses.filter(c => c.period < selectedPeriod).pop() || null;
      const nextClass = todayClasses.find(c => c.period > endPeriod) || null;

      return { prevClass, nextClass };
    },
    [effectiveOccupancies, selectedDay, selectedPeriod]
  );

  // Hero room: first of filtered results
  const heroRoom: ExtendedFreeRun | null = useMemo(() => {
    if (filteredRuns.length === 0) return null;
    return filteredRuns[0];
  }, [filteredRuns]);

  // Hero room prior/next schedule
  const heroSchedule = useMemo(() => {
    if (!heroRoom) return { prevClass: null, nextClass: null };
    return getRoomPriorAndNext(heroRoom.roomId, heroRoom.endPeriod);
  }, [heroRoom, getRoomPriorAndNext]);

  // Rooms list excluding the hero answer
  const remainingRooms = useMemo(() => {
    if (!heroRoom) return [];
    return filteredRuns.filter(r => r.roomId !== heroRoom.roomId);
  }, [filteredRuns, heroRoom]);

  const isSunday = istInfo.dayIndex === null && isLive;
  const isBeforeHours = detection.state === 'BEFORE_HOURS' && isLive;
  const isAfterHours = detection.state === 'AFTER_HOURS' && isLive;

  return (
    <div className="min-h-screen bg-page-bg text-cell-ink selection:bg-brand selection:text-white flex flex-col justify-between">
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
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-brand text-white border border-brand uppercase">
                    SoCSE
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

                  {/* Explicit DAY / NIGHT Theme Switch */}
                  <div className="flex items-center border border-hairline bg-page-bg font-mono text-xs">
                    <button
                      type="button"
                      aria-pressed={theme === 'dark'}
                      onClick={() => setThemeMode('dark')}
                      className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                        theme === 'dark'
                          ? 'bg-board-case text-signal border-b-2 border-signal'
                          : 'text-muted hover:text-cell-ink'
                      }`}
                    >
                      NIGHT
                    </button>
                    <span className="w-px h-3.5 bg-hairline shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      aria-pressed={theme === 'light'}
                      onClick={() => setThemeMode('light')}
                      className={`px-2.5 py-1 font-bold uppercase transition-colors ${
                        theme === 'light'
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
                  })} IST
                </span>
              </div>
            </div>

            {/* Quick Action Controls (Search & Share) */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search faculty or room schedules"
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-cell-bg border border-hairline hover:bg-board-case/70 text-cell-ink font-bold uppercase transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" strokeWidth="2" />
                  <path strokeWidth="2" d="M21 21l-4.35-4.35" />
                </svg>
                <span>SEARCH [/]</span>
              </button>

              <button
                type="button"
                onClick={handleShareLink}
                aria-label="Share current view deep link"
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-cell-bg border border-hairline hover:bg-board-case/70 text-cell-ink font-bold uppercase transition-colors relative focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                <span>{copiedLink ? 'COPIED!' : 'SHARE LINK'}</span>
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
          <main className="flex-1 min-w-0 w-full">
            {/* Split-Flap Board Housing Frame */}
            <div className="border border-hairline bg-board-case p-3 sm:p-4 mb-3">
              {/* Board Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-hairline font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-signal shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cell-ink">
                    SOLARI DEPARTURE BOARD // CLASSROOM VACANCY
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

      {/* Faculty & Room Search / Inquiry Dialog */}
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

      {/* Keyboard & Gesture Shortcuts Guide Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

