'use client';

import { useMemo, useCallback } from 'react';
import { Room, Period, Occupancy, DayIndex } from '@/lib/domain/rooms';
import { OccupancyStore } from '@/lib/domain/occupancy';
import { evaluateVacancy, ExtendedFreeRun } from '@/lib/domain/vacancy';
import { FilterBuilding } from '@/components/FilterChips';

interface UseVacancyProps {
  selectedDay: DayIndex;
  selectedPeriod: number;
  selectedBuilding: FilterBuilding;
  rooms: Room[];
  periods: Period[];
  occupancyStore: OccupancyStore;
  effectiveOccupancies: Occupancy[];
}

export function useVacancy({
  selectedDay,
  selectedPeriod,
  selectedBuilding,
  rooms,
  periods,
  occupancyStore,
  effectiveOccupancies,
}: UseVacancyProps) {
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

  // Pre-indexed room occupancy map for O(1) prior/next class lookups
  const dayRoomOccupanciesMap = useMemo(() => {
    const map = new Map<string, Occupancy[]>();
    for (const occ of effectiveOccupancies) {
      if (occ.day === selectedDay) {
        let list = map.get(occ.roomId);
        if (!list) {
          list = [];
          map.set(occ.roomId, list);
        }
        list.push(occ);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.period - b.period);
    }
    return map;
  }, [effectiveOccupancies, selectedDay]);

  // Prior and next class lookup helper for desktop hover inspection
  const getRoomPriorAndNext = useCallback(
    (roomId: string, endPeriod: number) => {
      const todayClasses = dayRoomOccupanciesMap.get(roomId) || [];
      const prevClass = todayClasses.filter(c => c.period < selectedPeriod).pop() || null;
      const nextClass = todayClasses.find(c => c.period > endPeriod) || null;

      return { prevClass, nextClass };
    },
    [dayRoomOccupanciesMap, selectedPeriod]
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

  return {
    evaluation,
    filteredRuns,
    buildingCounts,
    filteredNeverScheduled,
    heroRoom,
    heroSchedule,
    remainingRooms,
    getRoomPriorAndNext,
  };
}
