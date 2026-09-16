export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5; // Mon..Sat

export interface Period {
  index: number;        // 1..9
  label: string;        // "1"
  start: string;        // "09:00"
  end: string;          // "09:55"
  startMinutes: number; // 540
  endMinutes: number;   // 595
}

export type Building = 'EB' | 'FB' | 'SVH' | 'LAW' | 'OTHER';

export interface Room {
  id: string;
  name: string;         // e.g. "EB 305"
  short: string;
  building: Building;   // derived
  floor: number | null; // derived
  isLab: boolean;       // derived
  excluded: boolean;    // from overrides
  neverScheduled: boolean; // zero cards all week
}

export interface Occupancy {
  roomId: string;
  day: DayIndex;
  period: number;
  subjectCode: string;
  subjectName: string;
  teacherNames: string[];
  batchNames: string[];  // e.g. ["2BCA1"]
  source: 'timetable' | 'substitution';
}

export interface FreeRun {
  roomId: string;
  startPeriod: number;
  endPeriod: number;     // inclusive
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface OverridesConfig {
  excludeRoomIds?: string[];
  excludeRoomNames?: string[];
  forceLabByName?: string[];
  buildingOverrides?: Record<string, Building>;
  displayNameOverrides?: Record<string, string>;
}

/**
 * Derives the building code from a room name.
 * Order: Law Block|LAW -> LAW, SVH -> SVH, Foundation Block|FB -> FB, EB -> EB, else OTHER.
 */
export function deriveBuilding(name: string): Building {
  if (/(?:Law\s*Block|\bLAW\b)/i.test(name)) {
    return 'LAW';
  }
  if (/\bSVH\b/i.test(name)) {
    return 'SVH';
  }
  if (/(?:Foundation\s*Block|\bFB\b)/i.test(name)) {
    return 'FB';
  }
  if (/\bEB\b/i.test(name)) {
    return 'EB';
  }
  return 'OTHER';
}

/**
 * Derives the floor number from the first 3-digit number in the room name.
 * Floor = first digit of the 3-digit number.
 * Returns null if no 3-digit number exists (e.g. Apple Lab, Seminar Hall).
 */
export function deriveFloor(name: string): number | null {
  const match = name.match(/\b([1-9])\d{2}\b/);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Determines whether a room is a lab.
 * Pure pattern match: /\blab\b/i
 */
export function isLab(name: string): boolean {
  return /\blab\b/i.test(name);
}

/**
 * Resolves a room with all derived properties and overrides applied.
 */
export function resolveRoom(
  raw: { id: string; name: string; short?: string },
  cardCount: number,
  overrides?: OverridesConfig
): Room {
  const originalName = raw.name;
  const displayName = overrides?.displayNameOverrides?.[originalName] ?? originalName;
  const rawBuilding = deriveBuilding(originalName);
  const building = overrides?.buildingOverrides?.[originalName] ?? rawBuilding;
  const floor = deriveFloor(originalName);

  const isLabDerived = isLab(originalName);
  const isForcedLab = overrides?.forceLabByName?.includes(originalName) ?? false;
  const isLabFinal = isLabDerived || isForcedLab;

  const isExcludedId = overrides?.excludeRoomIds?.includes(raw.id) ?? false;
  const isExcludedName = overrides?.excludeRoomNames?.includes(originalName) ?? false;
  const excluded = isExcludedId || isExcludedName;

  return {
    id: raw.id,
    name: displayName,
    short: raw.short || displayName,
    building,
    floor,
    isLab: isLabFinal,
    excluded,
    neverScheduled: cardCount === 0
  };
}
