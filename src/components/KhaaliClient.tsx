'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

  // Current system / IST state
  const [now, setNow] = useState<Date>(() => new Date());
  const istInfo = useMemo(() => getISTTimeInfo(now), [now]);
  const detection = useMemo(() => detectCurrentPeriod(periods, now), [periods, now]);

  // Check if current date is outside validity window
  const isOutsideValidity = useMemo(() => {
    return checkOutsideValidityWindow(now, validityWindow);
  }, [now, validityWindow]);

  // Selected Day & Period states
  const [selectedDay, setSelectedDay] = useState<DayIndex>(() => {
    return detection.dayIndex ?? 0;
  });

  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => {
    return detection.activePeriodIndex;
  });

  const [isManualTime, setIsManualTime] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<FilterBuilding>('ALL');
  const [neverScheduledOpen, setNeverScheduledOpen] = useState(false);

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

  // Auto-sync initial detection once client mounts
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

  // Hero room: first of filtered results, or global hero if 'ALL'
  const heroRoom: ExtendedFreeRun | null = useMemo(() => {
    if (filteredRuns.length === 0) return null;
    return filteredRuns[0];
  }, [filteredRuns]);

  // Rooms list excluding the hero answer
  const remainingRooms = useMemo(() => {
    if (!heroRoom) return [];
    return filteredRuns.filter(r => r.roomId !== heroRoom.roomId);
  }, [filteredRuns, heroRoom]);

  const isSunday = istInfo.dayIndex === null && isLive;
  const isBeforeHours = detection.state === 'BEFORE_HOURS' && isLive;
  const isAfterHours = detection.state === 'AFTER_HOURS' && isLive;

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-mobile mx-auto px-3.5 pt-3 pb-0 bg-ink">
      <div>
        {/* Departure Board Top Bar: Wordmark + Live IST Clock */}
        <header className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-black tracking-wider text-text">
              KHAALI
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand/30 border border-brand/60 text-text uppercase">
              SoCSE
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-muted tabular-nums">
            <span>{istInfo.weekdayShort}</span>
            <span className="text-border">·</span>
            <span className="font-semibold text-text">{istInfo.timeString}</span>
            <span className="text-[10px] text-muted">IST</span>
          </div>
        </header>

        {/* Status Warnings & Stale Data Banner */}
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

        {/* Collapsed/Expandable Day & Period Selector Bar */}
        <TimeSelectorBar
          periods={periods}
          selectedDay={selectedDay}
          selectedPeriod={selectedPeriod}
          onSelectDay={handleSelectDay}
          onSelectPeriod={handleSelectPeriod}
          isLive={isLive}
          onResetToLive={handleResetToLive}
        />

        {/* Single Best Answer (HERO) */}
        <HeroAnswer
          hero={heroRoom}
          noClassesToday={evaluation.noClassesToday}
          isAfterHours={isAfterHours}
          isBeforeHours={isBeforeHours}
          isSunday={isSunday}
        />

        {/* Scannable Room Rows List */}
        {!evaluation.noClassesToday && remainingRooms.length > 0 && (
          <section className="my-4" aria-label="Available classrooms">
            <div className="flex items-center justify-between text-xs font-mono text-muted mb-2 px-1">
              <span>
                {remainingRooms.length} more {remainingRooms.length === 1 ? 'room' : 'rooms'} free now
              </span>
              <span className="text-[11px] uppercase tracking-wider">
                Ranked by duration
              </span>
            </div>

            <ul className="space-y-1.5" role="list">
              {remainingRooms.map(run => (
                <RoomRow key={run.roomId} run={run} />
              ))}
            </ul>
          </section>
        )}

        {/* Never Scheduled Collapsible Section */}
        {filteredNeverScheduled.length > 0 && (
          <section className="my-4 border border-border rounded bg-surface/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setNeverScheduledOpen(prev => !prev)}
              aria-expanded={neverScheduledOpen}
              className="min-h-[44px] w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-muted hover:text-text transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <span>{neverScheduledOpen ? '▾' : '▸'}</span>
                <span>Never scheduled — may not be usable ({filteredNeverScheduled.length})</span>
              </div>
              <span className="text-[10px] uppercase">
                {neverScheduledOpen ? 'Hide' : 'Show'}
              </span>
            </button>

            {neverScheduledOpen && (
              <div className="p-3 pt-0 border-t border-border/50 bg-ink/30">
                <p className="text-[11px] text-muted mb-2 font-mono">
                  These rooms have zero scheduled cards across the entire week (often staff rooms, store rooms, or locked halls).
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {filteredNeverScheduled.map(room => (
                    <span
                      key={room.id}
                      className="px-2 py-1 rounded bg-surface border border-border text-xs font-mono text-muted"
                    >
                      {room.name} ({room.building})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Sticky Bottom Filter Chips & Unofficial Tool Footer */}
      <div>
        <FilterChips
          selected={selectedBuilding}
          onChange={setSelectedBuilding}
          counts={buildingCounts}
        />

        <footer className="py-3 text-center border-t border-border/50 mt-2">
          <p className="text-[11px] font-mono text-muted">
            Khaali — unofficial. Data from the SoCSE timetable. Verify before you rely on it.
          </p>
        </footer>
      </div>
    </div>
  );
}
