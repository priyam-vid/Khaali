import { describe, it, expect } from 'vitest';
import { detectCurrentPeriod, getISTTimeInfo, formatRelativeTime } from '../../src/lib/domain/time';
import { Period } from '../../src/lib/domain/rooms';

describe('Time Engine & Period Detection', () => {
  const standardPeriods: Period[] = [
    { index: 1, label: '1', start: '09:00', end: '09:55', startMinutes: 540, endMinutes: 595 },
    { index: 2, label: '2', start: '09:55', end: '10:50', startMinutes: 595, endMinutes: 650 },
    { index: 3, label: '3', start: '10:50', end: '11:45', startMinutes: 650, endMinutes: 705 },
    { index: 4, label: '4', start: '11:45', end: '12:40', startMinutes: 705, endMinutes: 760 },
    { index: 5, label: '5', start: '12:40', end: '13:35', startMinutes: 760, endMinutes: 815 },
    { index: 6, label: '6', start: '13:35', end: '14:30', startMinutes: 815, endMinutes: 870 },
    { index: 7, label: '7', start: '14:30', end: '15:25', startMinutes: 870, endMinutes: 925 },
    { index: 8, label: '8', start: '15:25', end: '16:20', startMinutes: 925, endMinutes: 980 },
    { index: 9, label: '9', start: '16:20', end: '17:15', startMinutes: 980, endMinutes: 1035 }
  ];

  it('detects BEFORE_HOURS before 09:00 IST', () => {
    // 08:30 IST is 03:00 UTC (IST = UTC + 5:30)
    const date = new Date('2026-09-16T03:00:00Z');
    const result = detectCurrentPeriod(standardPeriods, date);

    expect(result.state).toBe('BEFORE_HOURS');
    expect(result.activePeriodIndex).toBe(1);
  });

  it('detects IN_PERIOD during Period 1', () => {
    // 09:20 IST is 03:50 UTC
    const date = new Date('2026-09-16T03:50:00Z');
    const result = detectCurrentPeriod(standardPeriods, date);

    expect(result.state).toBe('IN_PERIOD');
    expect(result.activePeriodIndex).toBe(1);
    expect(result.activePeriod.label).toBe('1');
  });

  it('respects exact-minute boundary [start, end): at 09:55 Period 1 ends and Period 2 begins', () => {
    // 09:54:59 IST -> Period 1
    const dateP1End = new Date('2026-09-16T04:24:59Z');
    const resP1 = detectCurrentPeriod(standardPeriods, dateP1End);
    expect(resP1.state).toBe('IN_PERIOD');
    expect(resP1.activePeriodIndex).toBe(1);

    // 09:55:00 IST -> Period 2 begins
    const dateP2Start = new Date('2026-09-16T04:25:00Z');
    const resP2 = detectCurrentPeriod(standardPeriods, dateP2Start);
    expect(resP2.state).toBe('IN_PERIOD');
    expect(resP2.activePeriodIndex).toBe(2);
  });

  it('detects AFTER_HOURS after 17:15 IST', () => {
    // 17:15:00 IST is 11:45:00 UTC
    const dateAfter = new Date('2026-09-16T11:45:00Z');
    const result = detectCurrentPeriod(standardPeriods, dateAfter);

    expect(result.state).toBe('AFTER_HOURS');
    expect(result.activePeriodIndex).toBe(9);
  });

  it('detects BETWEEN_PERIODS if periods have a gap', () => {
    const periodsWithGap: Period[] = [
      { index: 1, label: '1', start: '09:00', end: '09:50', startMinutes: 540, endMinutes: 590 },
      { index: 2, label: '2', start: '10:00', end: '10:50', startMinutes: 600, endMinutes: 650 }
    ];

    // 09:55 IST is between 09:50 and 10:00
    const dateGap = new Date('2026-09-16T04:25:00Z');
    const result = detectCurrentPeriod(periodsWithGap, dateGap);

    expect(result.state).toBe('BETWEEN_PERIODS');
    expect(result.activePeriodIndex).toBe(2); // shows upcoming period
  });

  it('evaluates Asia/Kolkata correctly regardless of host timezone', () => {
    // 12:45 IST on Wednesday 16 Sep 2026 is 07:15 UTC
    const utcDate = new Date('2026-09-16T07:15:00Z');
    const ist = getISTTimeInfo(utcDate);

    expect(ist.timeString).toBe('12:45');
    expect(ist.weekdayShort).toBe('Wed');
    expect(ist.dayIndex).toBe(2); // Wednesday

    const result = detectCurrentPeriod(standardPeriods, utcDate);
    expect(result.state).toBe('IN_PERIOD');
    expect(result.activePeriodIndex).toBe(5); // Period 5 (12:40-13:35)
  });

  describe('formatRelativeTime', () => {
    const baseNow = new Date('2026-09-16T12:00:00Z');

    it('returns "just now" for differences under 1 minute', () => {
      const past30s = new Date('2026-09-16T11:59:30Z').getTime();
      expect(formatRelativeTime(past30s, baseNow)).toBe('just now');
    });

    it('formats minutes ago correctly', () => {
      const past5m = new Date('2026-09-16T11:55:00Z').getTime();
      expect(formatRelativeTime(past5m, baseNow)).toBe('5m ago');

      const past59m = new Date('2026-09-16T11:01:00Z').getTime();
      expect(formatRelativeTime(past59m, baseNow)).toBe('59m ago');
    });

    it('formats hours ago correctly', () => {
      const past2h = new Date('2026-09-16T10:00:00Z').getTime();
      expect(formatRelativeTime(past2h, baseNow)).toBe('2h ago');

      const past23h = new Date('2026-09-15T13:00:00Z').getTime();
      expect(formatRelativeTime(past23h, baseNow)).toBe('23h ago');
    });

    it('formats days ago correctly', () => {
      const past1d = new Date('2026-09-15T12:00:00Z').getTime();
      expect(formatRelativeTime(past1d, baseNow)).toBe('1d ago');

      const past3d = new Date('2026-09-13T12:00:00Z').getTime();
      expect(formatRelativeTime(past3d, baseNow)).toBe('3d ago');
    });

    it('handles timestamps in the future or clock-skew safely as "just now"', () => {
      const futureTime = new Date('2026-09-16T12:05:00Z').getTime();
      expect(formatRelativeTime(futureTime, baseNow)).toBe('just now');
    });

    it('handles zero or NaN timestamps gracefully', () => {
      expect(formatRelativeTime(0, baseNow)).toBe('');
      expect(formatRelativeTime(NaN, baseNow)).toBe('');
    });
  });
});
