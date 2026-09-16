import {
  Period,
  Room,
  OverridesConfig,
  resolveRoom
} from '../domain/rooms';
import {
  RawPeriodSchema,
  RawClassroomSchema,
  RawCardSchema,
  RawLessonSchema,
  RawClassSchema,
  RawSubjectSchema,
  RawTeacherSchema,
  RawPeriod,
  RawClassroom,
  RawCard,
  RawLesson,
  RawClass,
  RawSubject,
  RawTeacher
} from './schema';

export interface NormalizedTimetable {
  periods: Period[];
  rooms: Room[];
  cards: RawCard[];
  lessons: Map<string, RawLesson>;
  classes: Map<string, RawClass>;
  subjects: Map<string, RawSubject>;
  teachers: Map<string, RawTeacher>;
  roomMap: Map<string, Room>;
  validityWindow?: {
    startDate: string;
    endDate: string;
  };
}

export function timeToMinutes(timeStr: string): number {
  const [hoursStr, minsStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const mins = parseInt(minsStr, 10) || 0;
  return hours * 60 + mins;
}

export function parseTimetable(
  rawPayload: unknown,
  overrides?: OverridesConfig,
  validityWindow?: { startDate: string; endDate: string }
): NormalizedTimetable {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Invalid timetable payload: expected an object');
  }

  const r = (rawPayload as Record<string, unknown>).r as Record<string, unknown> | undefined;
  const dbi = r?.dbiAccessorRes as Record<string, unknown> | undefined;
  const tables = (dbi?.tables as Array<{ id: string; data_rows?: unknown[] }>) || [];

  const tableMap = new Map<string, unknown[]>();
  for (const t of tables) {
    if (t?.id && Array.isArray(t.data_rows)) {
      tableMap.set(t.id, t.data_rows);
    }
  }

  // 1. Periods
  const rawPeriodsRows = tableMap.get('periods') || [];
  const rawPeriods: RawPeriod[] = [];
  for (const row of rawPeriodsRows) {
    const res = RawPeriodSchema.safeParse(row);
    if (res.success) {
      rawPeriods.push(res.data);
    }
  }

  // Sort periods by period number
  const periods: Period[] = rawPeriods
    .map(p => {
      const idx = parseInt(p.period, 10) || 0;
      return {
        index: idx,
        label: p.short || p.name || String(idx),
        start: p.starttime,
        end: p.endtime,
        startMinutes: timeToMinutes(p.starttime),
        endMinutes: timeToMinutes(p.endtime)
      };
    })
    .sort((a, b) => a.index - b.index);

  // 2. Cards
  const rawCardsRows = tableMap.get('cards') || [];
  const cards: RawCard[] = [];
  const roomCardCounts = new Map<string, number>();

  for (const row of rawCardsRows) {
    const res = RawCardSchema.safeParse(row);
    if (res.success) {
      const card = res.data;
      cards.push(card);
      for (const roomId of card.classroomids) {
        roomCardCounts.set(roomId, (roomCardCounts.get(roomId) || 0) + 1);
      }
    }
  }

  // 3. Classrooms -> Rooms
  const rawClassroomsRows = tableMap.get('classrooms') || [];
  const rooms: Room[] = [];
  const roomMap = new Map<string, Room>();

  for (const row of rawClassroomsRows) {
    const res = RawClassroomSchema.safeParse(row);
    if (res.success) {
      const rawRoom = res.data;
      const count = roomCardCounts.get(rawRoom.id) || 0;
      const room = resolveRoom(rawRoom, count, overrides);
      rooms.push(room);
      roomMap.set(room.id, room);
    }
  }

  // 4. Lessons
  const rawLessonsRows = tableMap.get('lessons') || [];
  const lessons = new Map<string, RawLesson>();
  for (const row of rawLessonsRows) {
    const res = RawLessonSchema.safeParse(row);
    if (res.success) {
      lessons.set(res.data.id, res.data);
    }
  }

  // 5. Classes (batches)
  const rawClassesRows = tableMap.get('classes') || [];
  const classes = new Map<string, RawClass>();
  for (const row of rawClassesRows) {
    const res = RawClassSchema.safeParse(row);
    if (res.success) {
      classes.set(res.data.id, res.data);
    }
  }

  // 6. Subjects
  const rawSubjectsRows = tableMap.get('subjects') || [];
  const subjects = new Map<string, RawSubject>();
  for (const row of rawSubjectsRows) {
    const res = RawSubjectSchema.safeParse(row);
    if (res.success) {
      subjects.set(res.data.id, res.data);
    }
  }

  // 7. Teachers
  const rawTeachersRows = tableMap.get('teachers') || [];
  const teachers = new Map<string, RawTeacher>();
  for (const row of rawTeachersRows) {
    const res = RawTeacherSchema.safeParse(row);
    if (res.success) {
      teachers.set(res.data.id, res.data);
    }
  }

  return {
    periods,
    rooms,
    cards,
    lessons,
    classes,
    subjects,
    teachers,
    roomMap,
    validityWindow
  };
}
