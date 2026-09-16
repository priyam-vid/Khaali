import { DayIndex, Period, Room, Building, FreeRun } from './rooms';
import { OccupancyStore } from './occupancy';

export interface ExtendedFreeRun extends FreeRun {
  room: Room;
  totalRunMinutes: number;
}

export interface VacancyEvaluation {
  day: DayIndex;
  period: number;
  totalRooms: number;
  vacantRoomsCount: number;
  occupiedRoomsCount: number;
  labsCount: number;
  excludedCount: number;
  neverScheduledCount: number;
  heroAnswer: ExtendedFreeRun | null;
  rankedRuns: ExtendedFreeRun[];
  neverScheduledRooms: Room[];
  noClassesToday: boolean;
}

const BUILDING_ORDER: Record<Building, number> = {
  EB: 1,
  FB: 2,
  SVH: 3,
  LAW: 4,
  OTHER: 5
};

/**
 * Checks if a specific room is vacant at (day, period).
 * A room is vacant if:
 * - isLab === false
 * - excluded === false
 * - neverScheduled === false
 * - Not occupied in occupancyStore at (day, period)
 */
export function isRoomVacant(
  room: Room,
  day: DayIndex,
  periodIndex: number,
  occupancyStore: OccupancyStore
): boolean {
  if (room.isLab || room.excluded || room.neverScheduled) {
    return false;
  }
  const occupiedIds = occupancyStore.getOccupiedRoomIds(day, periodIndex);
  return !occupiedIds.has(room.id);
}

/**
 * Computes the forward and backward free-run for a vacant room starting at a given period.
 */
export function computeFreeRun(
  room: Room,
  day: DayIndex,
  currentPeriod: number,
  periods: Period[],
  occupancyStore: OccupancyStore
): ExtendedFreeRun {
  const minPeriod = periods[0].index;
  const maxPeriod = periods[periods.length - 1].index;

  // Walk backward while vacant
  let startPeriod = currentPeriod;
  while (startPeriod > minPeriod && isRoomVacant(room, day, startPeriod - 1, occupancyStore)) {
    startPeriod--;
  }

  // Walk forward while vacant
  let endPeriod = currentPeriod;
  while (endPeriod < maxPeriod && isRoomVacant(room, day, endPeriod + 1, occupancyStore)) {
    endPeriod++;
  }

  const startPeriodObj = periods.find(p => p.index === startPeriod) || periods[0];
  const endPeriodObj = periods.find(p => p.index === endPeriod) || periods[periods.length - 1];
  const currentPeriodObj = periods.find(p => p.index === currentPeriod) || startPeriodObj;

  // durationMinutes: remaining duration from the start of the CURRENT period to the end of the run
  const durationMinutes = endPeriodObj.endMinutes - currentPeriodObj.startMinutes;
  const totalRunMinutes = endPeriodObj.endMinutes - startPeriodObj.startMinutes;

  return {
    roomId: room.id,
    room,
    startPeriod,
    endPeriod,
    startTime: startPeriodObj.start,
    endTime: endPeriodObj.end,
    durationMinutes,
    totalRunMinutes
  };
}

/**
 * Sorts free runs according to the specification:
 * durationMinutes DESC -> building -> floor ASC -> name
 */
export function sortFreeRuns(runs: ExtendedFreeRun[]): ExtendedFreeRun[] {
  return [...runs].sort((a, b) => {
    // 1. durationMinutes DESC
    if (b.durationMinutes !== a.durationMinutes) {
      return b.durationMinutes - a.durationMinutes;
    }

    // 2. Building priority
    const bOrderA = BUILDING_ORDER[a.room.building] ?? 99;
    const bOrderB = BUILDING_ORDER[b.room.building] ?? 99;
    if (bOrderA !== bOrderB) {
      return bOrderA - bOrderB;
    }

    // 3. Floor ASC (nulls at the end)
    const floorA = a.room.floor ?? 999;
    const floorB = b.room.floor ?? 999;
    if (floorA !== floorB) {
      return floorA - floorB;
    }

    // 4. Room name alphanumeric
    return a.room.name.localeCompare(b.room.name, undefined, { numeric: true });
  });
}

/**
 * Evaluates full vacancy for a given day and period.
 */
export function evaluateVacancy(
  day: DayIndex,
  period: number,
  rooms: Room[],
  periods: Period[],
  occupancyStore: OccupancyStore
): VacancyEvaluation {
  // Check if there are any classes at all across the entire university on this day
  let dayTotalOccupancies = 0;
  for (let p = 1; p <= periods.length; p++) {
    dayTotalOccupancies += occupancyStore.getOccupiedRoomIds(day, p).size;
  }
  const noClassesToday = dayTotalOccupancies === 0;

  const occupiedIds = occupancyStore.getOccupiedRoomIds(day, period);

  let vacantCount = 0;
  let occupiedCount = 0;
  let labsCount = 0;
  let excludedCount = 0;
  let neverScheduledCount = 0;

  const vacantRoomsList: Room[] = [];
  const neverScheduledRooms: Room[] = [];

  for (const room of rooms) {
    if (room.excluded) {
      excludedCount++;
    } else if (room.isLab) {
      labsCount++;
    } else if (room.neverScheduled) {
      neverScheduledCount++;
      neverScheduledRooms.push(room);
    } else if (occupiedIds.has(room.id)) {
      occupiedCount++;
    } else {
      vacantCount++;
      vacantRoomsList.push(room);
    }
  }

  // Compute free-runs for all vacant rooms
  const freeRuns = vacantRoomsList.map(r =>
    computeFreeRun(r, day, period, periods, occupancyStore)
  );

  const rankedRuns = sortFreeRuns(freeRuns);
  const heroAnswer = rankedRuns.length > 0 ? rankedRuns[0] : null;

  return {
    day,
    period,
    totalRooms: rooms.length,
    vacantRoomsCount: vacantCount,
    occupiedRoomsCount: occupiedCount,
    labsCount,
    excludedCount,
    neverScheduledCount,
    heroAnswer,
    rankedRuns,
    neverScheduledRooms,
    noClassesToday
  };
}
