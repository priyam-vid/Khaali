import { describe, it, expect } from 'vitest';
import { parseTimetable, timeToMinutes } from '../../src/lib/edupage/parse';

describe('EduPage Parser & Validation Edge Cases', () => {
  describe('timeToMinutes', () => {
    it('converts standard military times to minutes since midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:00')).toBe(540);
      expect(timeToMinutes('12:40')).toBe(760);
      expect(timeToMinutes('17:15')).toBe(1035);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('handles malformed time strings safely without throwing', () => {
      expect(timeToMinutes('')).toBe(0);
      expect(timeToMinutes('invalid')).toBe(0);
      expect(timeToMinutes('10')).toBe(600);
    });
  });

  describe('parseTimetable error handling', () => {
    it('throws when payload is null or non-object', () => {
      expect(() => parseTimetable(null)).toThrow('Invalid timetable payload: expected an object');
      expect(() => parseTimetable(undefined)).toThrow('Invalid timetable payload: expected an object');
      expect(() => parseTimetable('string payload')).toThrow('Invalid timetable payload: expected an object');
    });

    it('handles empty dbi tables gracefully without crashing', () => {
      const emptyPayload = {
        r: {
          dbiAccessorRes: {
            tables: [],
          },
        },
      };

      const parsed = parseTimetable(emptyPayload);
      expect(parsed.periods).toEqual([]);
      expect(parsed.rooms).toEqual([]);
      expect(parsed.cards).toEqual([]);
      expect(parsed.lessons.size).toBe(0);
    });
  });
});
