import { DayIndex, Period } from './rooms';

export type TimeState = 'BEFORE_HOURS' | 'IN_PERIOD' | 'BETWEEN_PERIODS' | 'AFTER_HOURS';

export interface ISTTimeInfo {
  dateString: string;       // e.g. "2026-09-16"
  timeString: string;       // e.g. "12:47"
  weekdayShort: string;     // e.g. "Wed"
  dayIndex: DayIndex | null; // 0..5 for Mon..Sat, null for Sunday
  minutesSinceMidnight: number;
}

export interface PeriodDetectionResult {
  state: TimeState;
  activePeriodIndex: number; // 1..9 (the active period, or upcoming period if between/before)
  activePeriod: Period;
  dayIndex: DayIndex | null;
  istTime: ISTTimeInfo;
}

/**
 * Extracts date and time components strictly in Asia/Kolkata (IST),
 * regardless of host machine timezone.
 */
export function getISTTimeInfo(date: Date = new Date()): ISTTimeInfo {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  let hourStr = '';
  let minuteStr = '';
  let weekday = '';

  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
    if (part.type === 'hour') hourStr = part.value;
    if (part.type === 'minute') minuteStr = part.value;
    if (part.type === 'weekday') weekday = part.value;
  }

  const hour = (parseInt(hourStr, 10) || 0) % 24;
  const minute = parseInt(minuteStr, 10) || 0;
  const minutesSinceMidnight = hour * 60 + minute;

  const weekdayMap: Record<string, DayIndex> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5
  };

  const dayIndex = weekday in weekdayMap ? weekdayMap[weekday] : null;
  const formattedHour = String(hour).padStart(2, '0');
  const formattedMinute = String(minute).padStart(2, '0');

  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${formattedHour}:${formattedMinute}`,
    weekdayShort: weekday,
    dayIndex,
    minutesSinceMidnight
  };
}

/**
 * Detects current period in Asia/Kolkata according to the time grid:
 * - BEFORE_HOURS: before periods[0].start -> show period 1
 * - AFTER_HOURS: after periods[last].end -> show last period
 * - IN_PERIOD: inside [start, end) -> show that period
 * - BETWEEN_PERIODS: between two periods -> show the upcoming period
 */
export function detectCurrentPeriod(
  periods: Period[],
  referenceDate: Date = new Date()
): PeriodDetectionResult {
  if (!periods || periods.length === 0) {
    throw new Error('Periods array cannot be empty');
  }

  const ist = getISTTimeInfo(referenceDate);
  const nowMin = ist.minutesSinceMidnight;

  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  // 1. Before hours
  if (nowMin < firstPeriod.startMinutes) {
    return {
      state: 'BEFORE_HOURS',
      activePeriodIndex: firstPeriod.index,
      activePeriod: firstPeriod,
      dayIndex: ist.dayIndex,
      istTime: ist
    };
  }

  // 2. After hours
  if (nowMin >= lastPeriod.endMinutes) {
    return {
      state: 'AFTER_HOURS',
      activePeriodIndex: lastPeriod.index,
      activePeriod: lastPeriod,
      dayIndex: ist.dayIndex,
      istTime: ist
    };
  }

  // 3. Inside a period [start, end)
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (nowMin >= p.startMinutes && nowMin < p.endMinutes) {
      return {
        state: 'IN_PERIOD',
        activePeriodIndex: p.index,
        activePeriod: p,
        dayIndex: ist.dayIndex,
        istTime: ist
      };
    }

    // 4. Between periods: after p.endMinutes and before next period start
    if (i < periods.length - 1) {
      const nextP = periods[i + 1];
      if (nowMin >= p.endMinutes && nowMin < nextP.startMinutes) {
        return {
          state: 'BETWEEN_PERIODS',
          activePeriodIndex: nextP.index,
          activePeriod: nextP,
          dayIndex: ist.dayIndex,
          istTime: ist
        };
      }
    }
  }

  // Fallback (safe default)
  return {
    state: 'IN_PERIOD',
    activePeriodIndex: firstPeriod.index,
    activePeriod: firstPeriod,
    dayIndex: ist.dayIndex,
    istTime: ist
  };
}

/**
 * Formats elapsed duration from a past timestamp relative to referenceDate.
 * E.g. "just now", "5m ago", "2h ago", "1d ago".
 */
export function formatRelativeTime(
  timestamp: number,
  referenceDate: Date = new Date()
): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const diffMs = Math.max(0, referenceDate.getTime() - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'just now';
  if (diffHours < 1) return `${diffMin}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export const DAY_THEME_START_MINUTES = 6 * 60; // 06:00 IST
export const DAY_THEME_END_MINUTES = 18 * 60; // 18:00 IST

export function isDaytime(minutesSinceMidnight: number): boolean {
  return minutesSinceMidnight >= DAY_THEME_START_MINUTES && minutesSinceMidnight < DAY_THEME_END_MINUTES;
}

