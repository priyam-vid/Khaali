import { describe, it, expect } from 'vitest';
import {
  isStoreStale,
  STALENESS_THRESHOLD_MS,
  savePersistedTimetable,
  getPersistedTimetable,
  PersistedTimetableStore,
} from '../../src/lib/storage/timetable-store';

describe('Timetable Storage & Staleness Engine', () => {
  it('correctly identifies fresh vs. stale store states against 26-hour threshold', () => {
    const now = Date.now();

    const freshStore: PersistedTimetableStore = {
      periods: [],
      rooms: [],
      occupancies: [],
      substitutions: [],
      fetchedAt: now - (25 * 60 * 60 * 1000), // 25 hours ago
      syncSource: 'cron',
    };

    expect(isStoreStale(freshStore)).toBe(false);

    const staleStore: PersistedTimetableStore = {
      periods: [],
      rooms: [],
      occupancies: [],
      substitutions: [],
      fetchedAt: now - (27 * 60 * 60 * 1000), // 27 hours ago (exceeds 26h threshold)
      syncSource: 'cron',
    };

    expect(isStoreStale(staleStore)).toBe(true);
  });

  it('persists and retrieves store atomically via local filesystem fallback', async () => {
    const mockStore: PersistedTimetableStore = {
      periods: [
        {
          index: 1,
          label: '1',
          start: '09:00',
          end: '09:55',
          startMinutes: 540,
          endMinutes: 595,
        },
      ],
      rooms: [
        {
          id: 'test-room-1',
          name: 'EB 305',
          short: 'EB 305',
          building: 'EB',
          floor: 3,
          isLab: false,
          excluded: false,
          neverScheduled: false,
        },
      ],
      occupancies: [],
      substitutions: [],
      fetchedAt: Date.now(),
      syncSource: 'local-fixture',
    };

    await savePersistedTimetable(mockStore);
    const retrieved = await getPersistedTimetable();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.periods).toHaveLength(1);
    expect(retrieved?.periods[0].start).toBe('09:00');
    expect(retrieved?.rooms[0].name).toBe('EB 305');
  });
});
