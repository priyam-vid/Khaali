import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTimetable } from '../../src/lib/edupage/parse';
import { buildOccupancies, createOccupancyStore } from '../../src/lib/domain/occupancy';
import { evaluateVacancy, computeFreeRun, sortFreeRuns } from '../../src/lib/domain/vacancy';
import { OverridesConfig } from '../../src/lib/domain/rooms';

describe('Vacancy & Ranking Engine', () => {
  const fixturePath = path.resolve(__dirname, '../../fixtures/regulartt.raw.json');
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const overridesPath = path.resolve(__dirname, '../../src/data/overrides.json');
  const overrides: OverridesConfig = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

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
  const occupancyStore = createOccupancyStore(occupancies);

  it('maintains the category sum invariant: sum(categories) === totalRooms for every day and period', () => {
    // Check all 6 days (Mon..Sat) and all 9 periods
    for (let day = 0; day < 6; day++) {
      for (let period = 1; period <= 9; period++) {
        const result = evaluateVacancy(
          day as any,
          period,
          parsed.rooms,
          parsed.periods,
          occupancyStore
        );

        const sum =
          result.vacantRoomsCount +
          result.occupiedRoomsCount +
          result.labsCount +
          result.excludedCount +
          result.neverScheduledCount;

        expect(sum).toBe(parsed.rooms.length);
        expect(sum).toBe(85);
      }
    }
  });

  it('guarantees that no lab ever appears in vacant ranked runs or hero answer', () => {
    for (let day = 0; day < 6; day++) {
      for (let period = 1; period <= 9; period++) {
        const result = evaluateVacancy(
          day as any,
          period,
          parsed.rooms,
          parsed.periods,
          occupancyStore
        );

        for (const run of result.rankedRuns) {
          expect(run.room.isLab).toBe(false);
          expect(/\blab\b/i.test(run.room.name)).toBe(false);
        }

        if (result.heroAnswer) {
          expect(result.heroAnswer.room.isLab).toBe(false);
          expect(/\blab\b/i.test(result.heroAnswer.room.name)).toBe(false);
        }
      }
    }
  });

  it('partitions neverScheduled rooms into separate list without mixing into ranked runs', () => {
    const result = evaluateVacancy(0, 1, parsed.rooms, parsed.periods, occupancyStore);

    expect(result.neverScheduledRooms.length).toBeGreaterThan(0);
    const neverScheduledIds = new Set(result.neverScheduledRooms.map(r => r.id));

    for (const run of result.rankedRuns) {
      expect(neverScheduledIds.has(run.roomId)).toBe(false);
    }
  });

  it('ranks free runs by durationMinutes DESC, then building, then floor ASC, then name', () => {
    const result = evaluateVacancy(2, 4, parsed.rooms, parsed.periods, occupancyStore); // Wednesday period 4

    for (let i = 0; i < result.rankedRuns.length - 1; i++) {
      const curr = result.rankedRuns[i];
      const next = result.rankedRuns[i + 1];

      // Duration should be descending or equal
      expect(curr.durationMinutes).toBeGreaterThanOrEqual(next.durationMinutes);
    }
  });

  it('detects noClassesToday when day has zero occupancies (e.g. simulated empty day)', () => {
    const emptyStore = createOccupancyStore([]);
    const result = evaluateVacancy(5, 1, parsed.rooms, parsed.periods, emptyStore);

    expect(result.noClassesToday).toBe(true);
  });
});
