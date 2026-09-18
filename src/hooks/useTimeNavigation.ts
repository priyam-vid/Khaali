'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Period, DayIndex } from '@/lib/domain/rooms';
import { detectCurrentPeriod, getISTTimeInfo } from '@/lib/domain/time';
import { FilterBuilding } from '@/components/FilterChips';

const DAY_MAP: Record<string, DayIndex> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
};

const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface UseTimeNavigationProps {
  periods: Period[];
  onOpenSearch: () => void;
  onToggleShortcuts: () => void;
  onCloseModals: () => void;
  isModalOpen: boolean;
}

export function useTimeNavigation({
  periods,
  onOpenSearch,
  onToggleShortcuts,
  onCloseModals,
  isModalOpen,
}: UseTimeNavigationProps) {
  // Current system / IST state with minute-gated ticking
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => {
      const currentDate = new Date();
      setNow(prev => {
        // Trigger state update only when the minute rolls over
        if (
          prev.getMinutes() !== currentDate.getMinutes() ||
          prev.getHours() !== currentDate.getHours() ||
          prev.getDate() !== currentDate.getDate()
        ) {
          return currentDate;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const istInfo = useMemo(() => getISTTimeInfo(now), [now]);
  const detection = useMemo(() => detectCurrentPeriod(periods, now), [periods, now]);

  // Selected Day, Period, and Building states
  const [selectedDay, setSelectedDay] = useState<DayIndex>(() => detection.dayIndex ?? 0);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(() => detection.activePeriodIndex);
  const [selectedBuilding, setSelectedBuilding] = useState<FilterBuilding>('ALL');
  const [isManualTime, setIsManualTime] = useState(false);

  // Screen reader live announcement
  const [announcement, setAnnouncement] = useState('');
  const isMountedRef = useRef(false);

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

  const handleResetToLive = useCallback(() => {
    setIsManualTime(false);
    if (detection.dayIndex !== null) {
      setSelectedDay(detection.dayIndex);
    }
    setSelectedPeriod(detection.activePeriodIndex);
  }, [detection]);

  const handleSelectDay = useCallback((day: DayIndex) => {
    setIsManualTime(true);
    setSelectedDay(day);
  }, []);

  const handleSelectPeriod = useCallback((periodIndex: number) => {
    setIsManualTime(true);
    setSelectedPeriod(periodIndex);
  }, []);

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
        onToggleShortcuts();
        return;
      }

      if (e.key === 'Escape') {
        onCloseModals();
        return;
      }

      // If any dialog is open, do not hijack arrows or search key
      if (isModalOpen) {
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
        onOpenSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [periods.length, isModalOpen, onOpenSearch, onToggleShortcuts, onCloseModals]);

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

  // Screen reader live announcement for day/period changes
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const dayName = DAY_NAMES[selectedDay] || 'Monday';
    setAnnouncement(`${dayName}, Period ${selectedPeriod} selected`);
  }, [selectedDay, selectedPeriod]);

  return {
    now,
    istInfo,
    detection,
    selectedDay,
    selectedPeriod,
    selectedBuilding,
    setSelectedBuilding,
    isManualTime,
    isLive,
    announcement,
    handleResetToLive,
    handleSelectDay,
    handleSelectPeriod,
  };
}
