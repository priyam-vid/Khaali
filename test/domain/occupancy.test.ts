import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTimetable } from '../../src/lib/edupage/parse';
import { buildOccupancies, createOccupancyStore } from '../../src/lib/domain/occupancy';

describe('Occupancy Engine', () => {
  const fixturePath = path.resolve(__dirname, '../../fixtures/regulartt.raw.json');
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const parsed = parseTimetable(rawFixture);
  const knownRoomIds = new Set(parsed.rooms.map(r => r.id));

  const occupancies = buildOccupancies(
    parsed.cards,
    parsed.lessons,
    parsed.classes,
    parsed.subjects,
    parsed.teachers,
    knownRoomIds
  );
  const store = createOccupancyStore(occupancies);

  it('expands multi-period lessons into contiguous period occupancies', () => {
    // Find a lesson with durationperiods === 2
    let multiPeriodLessonId: string | null = null;
    for (const [id, lesson] of parsed.lessons.entries()) {
      if (lesson.durationperiods && lesson.durationperiods > 1) {
        multiPeriodLessonId = id;
        break;
      }
    }
    expect(multiPeriodLessonId).not.toBeNull();

    const card = parsed.cards.find(c => c.lessonid === multiPeriodLessonId && c.classroomids?.length > 0);
    expect(card).toBeDefined();

    const startP = parseInt(card!.period, 10);
    const roomId = card!.classroomids[0];
    
    // Find which day is active
    let activeDay = 0;
    for (let d = 0; d < 6; d++) {
      if (card!.days[d] === '1') {
        activeDay = d;
        break;
      }
    }

    // Both startP and startP + 1 must be occupied by this room
    const p1Occupied = store.getOccupiedRoomIds(activeDay as any, startP);
    const p2Occupied = store.getOccupiedRoomIds(activeDay as any, startP + 1);

    expect(p1Occupied.has(roomId)).toBe(true);
    expect(p2Occupied.has(roomId)).toBe(true);
  });

  it('handles group split 2BCA1 on Tuesday Period 8 (Apple Lab + Dell Lab)', () => {
    // 2BCA1 class lookup
    let bca1ClassId = '';
    for (const [id, cls] of parsed.classes.entries()) {
      if (cls.name === '2BCA1') {
        bca1ClassId = id;
        break;
      }
    }
    expect(bca1ClassId).toBeTruthy();

    const appleLab = parsed.rooms.find(r => r.name === 'Apple Lab');
    const dellLab = parsed.rooms.find(r => r.name === 'Dell Lab');
    expect(appleLab).toBeDefined();
    expect(dellLab).toBeDefined();

    // Tuesday is dayIndex 1
    const tuesday = 1 as const;
    const period8Occupied = store.getOccupiedRoomIds(tuesday, 8);

    // Both Apple Lab and Dell Lab must be registered as occupied in Period 8
    expect(period8Occupied.has(appleLab!.id)).toBe(true);
    expect(period8Occupied.has(dellLab!.id)).toBe(true);

    // Both are duration 2 labs, so period 9 must also be occupied
    const period9Occupied = store.getOccupiedRoomIds(tuesday, 9);
    expect(period9Occupied.has(appleLab!.id)).toBe(true);
    expect(period9Occupied.has(dellLab!.id)).toBe(true);
  });

  it('safely skips cards with unknown room IDs without crashing', () => {
    const bogusCard = {
      id: 'bogus_card_999',
      lessonid: parsed.cards[0].lessonid,
      period: '1',
      days: '100000',
      classroomids: ['*non_existent_room_99999*'],
      weeks: '1',
      locked: false
    };

    const expanded = buildOccupancies(
      [bogusCard],
      parsed.lessons,
      parsed.classes,
      parsed.subjects,
      parsed.teachers,
      knownRoomIds
    );

    expect(expanded).toHaveLength(0);
  });
});
