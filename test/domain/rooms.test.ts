import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveBuilding,
  deriveFloor,
  isLab,
  deriveShortRoomName,
  resolveRoom,
  OverridesConfig
} from '../../src/lib/domain/rooms';
import { parseTimetable } from '../../src/lib/edupage/parse';

describe('Room Domain & Classification', () => {
  const fixturePath = path.resolve(__dirname, '../../fixtures/regulartt.raw.json');
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const classroomsRaw = rawFixture.r.dbiAccessorRes.tables.find(
    (t: { id: string }) => t.id === 'classrooms'
  ).data_rows;

  const overridesPath = path.resolve(__dirname, '../../src/data/overrides.json');
  const overrides: OverridesConfig = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

  describe('deriveBuilding', () => {
    it('correctly classifies LAW block names', () => {
      expect(deriveBuilding('Law Block 301')).toBe('LAW');
      expect(deriveBuilding('Law Block 408')).toBe('LAW');
      expect(deriveBuilding('LAB Law Block 103')).toBe('LAW');
      expect(deriveBuilding('LAW 101')).toBe('LAW');
    });

    it('correctly classifies SVH names', () => {
      expect(deriveBuilding('SVH 201')).toBe('SVH');
      expect(deriveBuilding('SVH 302')).toBe('SVH');
      expect(deriveBuilding('LAB SVH 102')).toBe('SVH');
      expect(deriveBuilding('LAB SVH 213')).toBe('SVH');
    });

    it('correctly classifies Foundation Block names', () => {
      expect(deriveBuilding('Foundation Block 101')).toBe('FB');
      expect(deriveBuilding('Foundation Block 406')).toBe('FB');
      expect(deriveBuilding('FB 204')).toBe('FB');
    });

    it('correctly classifies Engineering Block (EB) names', () => {
      expect(deriveBuilding('EB 201')).toBe('EB');
      expect(deriveBuilding('EB 305')).toBe('EB');
      expect(deriveBuilding('EB 407')).toBe('EB');
      expect(deriveBuilding('LAB EB 102')).toBe('EB');
    });

    it('classifies un-prefixed rooms as OTHER', () => {
      expect(deriveBuilding('Apple Lab')).toBe('OTHER');
      expect(deriveBuilding('Dell Lab')).toBe('OTHER');
      expect(deriveBuilding('Seminar Hall')).toBe('OTHER');
      expect(deriveBuilding('Physics Lab I')).toBe('OTHER');
      expect(deriveBuilding('Digital Electronics-2')).toBe('OTHER');
    });

    it('classifies every distinct room name in the fixture without errors', () => {
      const roomNames = classroomsRaw.map((r: { name: string }) => r.name);
      for (const name of roomNames) {
        const building = deriveBuilding(name);
        expect(['EB', 'FB', 'SVH', 'LAW', 'OTHER']).toContain(building);
      }
    });
  });

  describe('deriveFloor', () => {
    it('extracts floor from first 3-digit number', () => {
      expect(deriveFloor('EB 305')).toBe(3);
      expect(deriveFloor('Law Block 401')).toBe(4);
      expect(deriveFloor('SVH 206')).toBe(2);
      expect(deriveFloor('Foundation Block 101')).toBe(1);
      expect(deriveFloor('LAB Law Block 304')).toBe(3);
      expect(deriveFloor('LAB SVH 102')).toBe(1);
    });

    it('returns null when no 3-digit number exists', () => {
      expect(deriveFloor('Apple Lab')).toBeNull();
      expect(deriveFloor('Dell Lab')).toBeNull();
      expect(deriveFloor('Seminar Hall')).toBeNull();
      expect(deriveFloor('Physics Lab I')).toBeNull();
      expect(deriveFloor('Digital Electronics-2')).toBeNull();
    });
  });

  describe('isLab', () => {
    it('identifies labs using word boundary pattern', () => {
      expect(isLab('Apple Lab')).toBe(true);
      expect(isLab('Dell Lab')).toBe(true);
      expect(isLab('LAB SVH 210')).toBe(true);
      expect(isLab('LAB SVH 213')).toBe(true);
      expect(isLab('LAB EB 102')).toBe(true);
      expect(isLab('Physics Lab I')).toBe(true);
      expect(isLab('LAB Law Block 103')).toBe(true);
    });

    it('does not classify ordinary classrooms as labs', () => {
      expect(isLab('EB 305')).toBe(false);
      expect(isLab('Law Block 401')).toBe(false);
      expect(isLab('Foundation Block 101')).toBe(false);
      expect(isLab('SVH 206')).toBe(false);
      expect(isLab('Seminar Hall')).toBe(false);
    });
  });

  describe('overrides.json wiring', () => {
    it('applies forced labs from overrides.json', () => {
      const de2 = classroomsRaw.find((r: { name: string }) => r.name === 'Digital Electronics-2');
      expect(de2).toBeDefined();

      const resolved = resolveRoom(de2, 10, overrides);
      expect(resolved.isLab).toBe(true);
    });

    it('leaves non-overridden classrooms unaffected', () => {
      const eb305 = classroomsRaw.find((r: { name: string }) => r.name === 'EB 305');
      const resolved = resolveRoom(eb305, 10, overrides);
      expect(resolved.name).toBe('EB 305');
      expect(resolved.short).toBe('EB 305');
      expect(resolved.isLab).toBe(false);
      expect(resolved.building).toBe('EB');
      expect(resolved.floor).toBe(3);
      expect(resolved.excluded).toBe(false);
    });
  });

  describe('deriveShortRoomName & room abbreviation resolution', () => {
    it('abbreviates plain Foundation Block rooms properly', () => {
      const fb303 = resolveRoom({ id: 'fb303', name: 'Foundation Block 303' }, 5);
      expect(fb303.name).toBe('Foundation Block 303');
      expect(fb303.short).toBe('FB 303');

      const fb101 = resolveRoom({ id: 'fb101', name: 'Foundation Block 101' }, 5);
      expect(fb101.short).toBe('FB 101');

      const fb102 = resolveRoom({ id: 'fb102', name: 'Foundation Block-102' }, 5);
      expect(fb102.short).toBe('FB 102');
    });

    it('abbreviates EB rooms properly', () => {
      const eb305 = resolveRoom({ id: 'eb305', name: 'EB 305' }, 5);
      expect(eb305.name).toBe('EB 305');
      expect(eb305.short).toBe('EB 305');

      const eb201 = resolveRoom({ id: 'eb201', name: 'EB 201' }, 5);
      expect(eb201.short).toBe('EB 201');
    });

    it('abbreviates SVH rooms properly', () => {
      const svh201 = resolveRoom({ id: 'svh201', name: 'SVH 201' }, 5);
      expect(svh201.name).toBe('SVH 201');
      expect(svh201.short).toBe('SVH 201');

      const svh302 = resolveRoom({ id: 'svh302', name: 'SVH 302' }, 5);
      expect(svh302.short).toBe('SVH 302');
    });

    it('abbreviates Law Block rooms properly', () => {
      const law301 = resolveRoom({ id: 'law301', name: 'Law Block 301' }, 5);
      expect(law301.name).toBe('Law Block 301');
      expect(law301.short).toBe('LAW 301');

      const law408 = resolveRoom({ id: 'law408', name: 'Law Block 408' }, 5);
      expect(law408.short).toBe('LAW 408');
    });

    it('applies displayNameOverrides to abbreviation logic', () => {
      const customOverrides: OverridesConfig = {
        displayNameOverrides: {
          'Seminar Hall': 'Seminar Hall EB 305',
          'Special Room': 'Foundation Block 405'
        }
      };

      const semHall = resolveRoom({ id: 'sh1', name: 'Seminar Hall' }, 0, customOverrides);
      expect(semHall.name).toBe('Seminar Hall EB 305');
      expect(semHall.short).toBe('EB 305');

      const specRoom = resolveRoom({ id: 'sr1', name: 'Special Room' }, 0, customOverrides);
      expect(specRoom.name).toBe('Foundation Block 405');
      expect(specRoom.short).toBe('FB 405');
    });

    it('applies buildingOverrides to abbreviation logic', () => {
      const customOverrides: OverridesConfig = {
        buildingOverrides: {
          'Room 204': 'FB'
        }
      };

      const room = resolveRoom({ id: 'r204', name: 'Room 204' }, 5, customOverrides);
      expect(room.building).toBe('FB');
      expect(room.short).toBe('FB 204');
    });

    it('preserves un-prefixed rooms without room numbers', () => {
      expect(deriveShortRoomName('Apple Lab', 'OTHER')).toBe('Apple Lab');
      expect(deriveShortRoomName('Dell Lab', 'OTHER')).toBe('Dell Lab');
      expect(deriveShortRoomName('Physics Lab I', 'OTHER')).toBe('Physics Lab I');
    });
  });

  describe('parseTimetable against fixture', () => {
    const parsed = parseTimetable(rawFixture, overrides);

    it('parses all 9 periods with valid start and end times', () => {
      expect(parsed.periods).toHaveLength(9);
      expect(parsed.periods[0].start).toBe('09:00');
      expect(parsed.periods[0].end).toBe('09:55');
      expect(parsed.periods[0].startMinutes).toBe(540);
      expect(parsed.periods[0].endMinutes).toBe(595);

      expect(parsed.periods[8].start).toBe('16:20');
      expect(parsed.periods[8].end).toBe('17:15');
      expect(parsed.periods[8].startMinutes).toBe(980);
      expect(parsed.periods[8].endMinutes).toBe(1035);
    });

    it('parses exactly 85 classrooms with no dropped records', () => {
      expect(parsed.rooms).toHaveLength(85);
      expect(parsed.roomMap.size).toBe(85);
    });

    it('partitions neverScheduled rooms correctly', () => {
      const neverScheduled = parsed.rooms.filter(r => r.neverScheduled);
      expect(neverScheduled.length).toBeGreaterThan(0);
      const names = neverScheduled.map(r => r.name);
      expect(names).toContain('Seminar Hall');
      expect(names).toContain('LAB EB 104');
      expect(names).toContain('Foundation Block 403');
      expect(names).toContain('Foundation Block 406');
    });

    it('correctly resolves derived lab count', () => {
      // 18 from /\blab\b/ + 2 from overrides (Digital Electronics 2 & 3) = 20 labs
      const labs = parsed.rooms.filter(r => r.isLab);
      expect(labs).toHaveLength(20);
    });
  });
});
