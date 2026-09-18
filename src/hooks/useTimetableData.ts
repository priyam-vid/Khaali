'use client';

import { useState, useEffect, useMemo } from 'react';
import { KhaaliInitialData } from '@/lib/domain/types';
import { Occupancy, DayIndex } from '@/lib/domain/rooms';
import { createOccupancyStore } from '@/lib/domain/occupancy';
import { getISTTimeInfo } from '@/lib/domain/time';
import { applySubstitutions, SubstitutionChange } from '@/lib/edupage/substitutions';

export function useTimetableData(initialData: KhaaliInitialData) {
  const [data, setData] = useState<KhaaliInitialData>(initialData);
  const [isStaleData, setIsStaleData] = useState<boolean>(initialData.fromFallback);
  const [substitutions, setSubstitutions] = useState<SubstitutionChange[]>([]);

  // Cache initial payload to localStorage asynchronously to avoid blocking initial paint
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('khaali_cached_timetable', JSON.stringify(initialData));
        }
      } catch {
        // Ignore quota errors
      }
    }, 100);

    return () => clearTimeout(timer);
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

  // Fetch near-live substitutions on mount
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
  const occupancyStore = useMemo(
    () => createOccupancyStore(effectiveOccupancies),
    [effectiveOccupancies]
  );

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

  return {
    data,
    periods,
    rooms,
    occupancies,
    validityWindow,
    fetchedAt,
    isStaleData,
    substitutions,
    effectiveOccupancies,
    occupancyStore,
    allBatches,
    allProfessors,
  };
}
