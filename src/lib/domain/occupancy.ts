import { DayIndex, Occupancy, Room } from './rooms';
import { RawCard, RawLesson, RawClass, RawSubject, RawTeacher } from '../edupage/schema';

export interface OccupancyStore {
  occupancies: Occupancy[];
  getOccupiedRoomIds: (day: DayIndex, period: number) => Set<string>;
  getRoomOccupancy: (day: DayIndex, period: number, roomId: string) => Occupancy | undefined;
  getBatchOccupancies: (day: DayIndex, batchName: string) => Occupancy[];
}

/**
 * Builds the complete list of Occupancy records from cards, lessons, and lookup maps.
 * Handles:
 * 1. Multi-period lesson expansion (durationperiods > 1 occupies period n, n+1, ...)
 * 2. Multi-room placement (card.classroomids or lesson.classroomids fallback)
 * 3. Group splits (multiple cards for same batch in same period)
 * 4. Day bitmask parsing (0 = Mon, ..., 5 = Sat)
 * 5. Unknown room IDs are safely skipped without crashing.
 */
export function buildOccupancies(
  cards: RawCard[],
  lessons: Map<string, RawLesson>,
  classes: Map<string, RawClass>,
  subjects: Map<string, RawSubject>,
  teachers: Map<string, RawTeacher>,
  knownRoomIds?: Set<string>
): Occupancy[] {
  const occupancies: Occupancy[] = [];

  for (const card of cards) {
    const startPeriod = parseInt(card.period, 10);
    if (isNaN(startPeriod) || startPeriod <= 0) {
      continue;
    }

    const lesson = lessons.get(card.lessonid);
    const duration = lesson?.durationperiods && lesson.durationperiods > 0 ? lesson.durationperiods : 1;

    // Resolve rooms: card.classroomids preferred over lesson fallback
    let roomIds = card.classroomids && card.classroomids.length > 0 ? card.classroomids : [];
    if (roomIds.length === 0 && lesson?.classroomids && lesson.classroomids.length > 0) {
      roomIds = lesson.classroomids;
    }

    // Resolve subject info
    const subject = lesson?.subjectid ? subjects.get(lesson.subjectid) : undefined;
    const subjectCode = subject?.short || '';
    const subjectName = subject?.name || '';

    // Resolve teacher info
    const teacherNames: string[] = [];
    if (lesson?.teacherids) {
      for (const tid of lesson.teacherids) {
        const teacher = teachers.get(tid);
        if (teacher?.name) {
          teacherNames.push(teacher.name);
        }
      }
    }

    // Resolve batch info
    const batchNames: string[] = [];
    if (lesson?.classids) {
      for (const cid of lesson.classids) {
        const cls = classes.get(cid);
        if (cls?.name) {
          batchNames.push(cls.name);
        }
      }
    }

    // Expand bitmask for Mon..Sat (day 0..5)
    const daysMask = card.days || '';
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      if (daysMask[dayIdx] === '1') {
        const day = dayIdx as DayIndex;

        // Expand durationperiods (e.g. 2-period lab occupies startPeriod and startPeriod + 1)
        for (let pOffset = 0; pOffset < duration; pOffset++) {
          const currentPeriod = startPeriod + pOffset;

          // Expand rooms (e.g. group split or multi-room placement)
          for (const roomId of roomIds) {
            // If knownRoomIds is provided, verify room exists; if unknown, skip safely
            if (knownRoomIds && !knownRoomIds.has(roomId)) {
              continue;
            }

            occupancies.push({
              roomId,
              day,
              period: currentPeriod,
              subjectCode,
              subjectName,
              teacherNames,
              batchNames,
              source: 'timetable'
            });
          }
        }
      }
    }
  }

  return occupancies;
}

/**
 * Creates an index over occupancies for high-speed O(1) lookups.
 */
export function createOccupancyStore(occupancies: Occupancy[]): OccupancyStore {
  // Map key: `${day}:${period}` -> Set<roomId>
  const periodOccupiedRooms = new Map<string, Set<string>>();
  // Map key: `${day}:${period}:${roomId}` -> Occupancy
  const roomSlotOccupancy = new Map<string, Occupancy>();
  // Map key: `${day}:${batchName.toLowerCase()}` -> Occupancy[]
  const batchDayOccupancies = new Map<string, Occupancy[]>();

  for (const occ of occupancies) {
    const slotKey = `${occ.day}:${occ.period}`;
    let roomSet = periodOccupiedRooms.get(slotKey);
    if (!roomSet) {
      roomSet = new Set<string>();
      periodOccupiedRooms.set(slotKey, roomSet);
    }
    roomSet.add(occ.roomId);

    const roomSlotKey = `${occ.day}:${occ.period}:${occ.roomId}`;
    if (!roomSlotOccupancy.has(roomSlotKey)) {
      roomSlotOccupancy.set(roomSlotKey, occ);
    }

    for (const batch of occ.batchNames) {
      const batchKey = `${occ.day}:${batch.toLowerCase().trim()}`;
      let bList = batchDayOccupancies.get(batchKey);
      if (!bList) {
        bList = [];
        batchDayOccupancies.set(batchKey, bList);
      }
      bList.push(occ);
    }
  }

  return {
    occupancies,
    getOccupiedRoomIds(day: DayIndex, period: number): Set<string> {
      return periodOccupiedRooms.get(`${day}:${period}`) || new Set<string>();
    },
    getRoomOccupancy(day: DayIndex, period: number, roomId: string): Occupancy | undefined {
      return roomSlotOccupancy.get(`${day}:${period}:${roomId}`);
    },
    getBatchOccupancies(day: DayIndex, batchName: string): Occupancy[] {
      return batchDayOccupancies.get(`${day}:${batchName.toLowerCase().trim()}`) || [];
    }
  };
}
