import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTimetable } from '../../src/lib/edupage/parse';
import { buildOccupancies, createOccupancyStore } from '../../src/lib/domain/occupancy';
import { evaluateVacancy } from '../../src/lib/domain/vacancy';

describe('Hand-Verification of Full Period (Wednesday Period 5)', () => {
  const fixturePath = path.resolve(__dirname, '../../fixtures/regulartt.raw.json');
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const overridesPath = path.resolve(__dirname, '../../src/data/overrides.json');
  const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

  const parsed = parseTimetable(rawFixture, overrides);
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

  it('cross-checks every claimed vacant room in Wednesday Period 5 against raw cards with zero conflicts', () => {
    const testDay = 2; // Wednesday
    const testPeriod = 5; // 12:40 - 13:35

    const result = evaluateVacancy(testDay, testPeriod, parsed.rooms, parsed.periods, store);

    expect(result.vacantRoomsCount).toBeGreaterThan(0);
    const vacantRoomIds = new Set(result.rankedRuns.map(r => r.roomId));

    const cards = rawFixture.r.dbiAccessorRes.tables.find((x: any) => x.id === 'cards').data_rows;
    const lessons = rawFixture.r.dbiAccessorRes.tables.find((x: any) => x.id === 'lessons').data_rows;

    let conflicts = 0;

    for (const card of cards) {
      if (!card.days || card.days[testDay] !== '1') continue;

      const cardStartP = parseInt(card.period, 10);
      const lesson = lessons.find((l: any) => l.id === card.lessonid);
      const duration = lesson?.durationperiods || 1;
      const cardEndP = cardStartP + duration - 1;

      // Checks if card active during testPeriod
      if (testPeriod >= cardStartP && testPeriod <= cardEndP) {
        for (const rId of (card.classroomids || [])) {
          if (vacantRoomIds.has(rId)) {
            conflicts++;
          }
        }
      }
    }

    expect(conflicts).toBe(0);
  });
});
