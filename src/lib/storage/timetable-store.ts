/**
 * Timetable Persistence Layer
 *
 * Persistence Strategy: Vercel Blob
 * --------------------------------
 * Justification:
 * 1. Single Atomic Document: Khaali does not require relational tables or row-level mutations.
 *    The timetable is a single normalized JSON document (~100-200 KB) containing periods,
 *    rooms, occupancies, active substitutions, and timetable metadata.
 * 2. Zero Cold-Start Overhead: Reading from Vercel Blob CDN is a direct HTTP fetch with
 *    zero connection pool limits, socket timeouts, or Redis memory constraints.
 * 3. Minimal Infrastructure: Requires only @vercel/blob and the BLOB_READ_WRITE_TOKEN.
 *
 * Local & Offline Resilience:
 * If BLOB_READ_WRITE_TOKEN is not configured (e.g. running Vitest test suites, local development,
 * or CI builds), this module automatically falls back to an atomic local file cache
 * (`.next/cache/timetable-store.json` or system temp directory), ensuring offline testing
 * and local development work seamlessly without external tokens.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { put, list } from '@vercel/blob';
import { Period, Room, Occupancy } from '@/lib/domain/rooms';
import { SubstitutionChange } from '@/lib/edupage/substitutions';

export interface PersistedTimetableStore {
  periods: Period[];
  rooms: Room[];
  occupancies: Occupancy[];
  substitutions: SubstitutionChange[];
  validityWindow?: {
    startDate: string;
    endDate: string;
  };
  fetchedAt: number;
  syncSource: 'cron' | 'manual' | 'upstream-fallback' | 'local-fixture';
}

export const STALENESS_THRESHOLD_MS = 26 * 60 * 60 * 1000; // 26 hours
const BLOB_FILENAME = 'timetable/store.json';

function getLocalFallbackPath(): string {
  const cacheDir = path.resolve(process.cwd(), '.next/cache');
  if (fs.existsSync(cacheDir)) {
    return path.join(cacheDir, 'timetable-store.json');
  }
  return path.join(os.tmpdir(), 'khaali-timetable-store.json');
}

/**
 * Checks if a persisted store exceeds the 26-hour staleness threshold.
 */
export function isStoreStale(store: PersistedTimetableStore): boolean {
  return Date.now() - store.fetchedAt > STALENESS_THRESHOLD_MS;
}

/**
 * Persists normalized timetable data to Vercel Blob (or local fallback).
 */
export async function savePersistedTimetable(store: PersistedTimetableStore): Promise<void> {
  const jsonString = JSON.stringify(store);

  // If Vercel Blob token is available, persist to Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await put(BLOB_FILENAME, jsonString, {
        access: 'public',
        addRandomSuffix: false,
      });
      return;
    } catch (err) {
      console.warn('Vercel Blob put failed, falling back to local storage:', err);
    }
  }

  // Fallback to local filesystem storage
  try {
    const filePath = getLocalFallbackPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, jsonString, 'utf8');
  } catch (localErr) {
    console.warn('Failed to save to local fallback storage:', localErr);
  }
}

/**
 * Retrieves normalized timetable data from Vercel Blob (or local fallback).
 * Returns null if no stored data exists.
 */
export async function getPersistedTimetable(): Promise<PersistedTimetableStore | null> {
  // Try Vercel Blob first if token is available
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: BLOB_FILENAME });
      const targetBlob = blobs.find(b => b.pathname === BLOB_FILENAME) || blobs[0];
      if (targetBlob && targetBlob.url) {
        const res = await fetch(targetBlob.url, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as PersistedTimetableStore;
          if (data && Array.isArray(data.periods) && Array.isArray(data.rooms)) {
            return data;
          }
        }
      }
    } catch (err) {
      console.warn('Vercel Blob read failed, attempting local fallback:', err);
    }
  }

  // Check local filesystem storage
  try {
    const filePath = getLocalFallbackPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw) as PersistedTimetableStore;
      if (data && Array.isArray(data.periods) && Array.isArray(data.rooms)) {
        return data;
      }
    }
  } catch (localErr) {
    console.warn('Failed to read from local fallback storage:', localErr);
  }

  return null;
}
