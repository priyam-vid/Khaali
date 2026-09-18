import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { fetchRawTimetable } from '@/lib/edupage/client';
import { parseTimetable } from '@/lib/edupage/parse';
import { buildOccupancies } from '@/lib/domain/occupancy';
import { OverridesConfig } from '@/lib/domain/rooms';
import {
  getPersistedTimetable,
  savePersistedTimetable,
  isStoreStale,
  PersistedTimetableStore
} from '@/lib/storage/timetable-store';

// Base timetable revalidates every 1 hour (3600 seconds) via ISR
export const revalidate = 3600;

export async function GET() {
  try {
    // 1. Try reading from the persisted store (Vercel Blob / local cache)
    const persisted = await getPersistedTimetable();

    if (persisted && !isStoreStale(persisted)) {
      return NextResponse.json({
        periods: persisted.periods,
        rooms: persisted.rooms,
        occupancies: persisted.occupancies,
        validityWindow: persisted.validityWindow,
        fetchedAt: persisted.fetchedAt,
        fromFallback: false
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      });
    }

    // 2. If missing or older than 26 hours, attempt live fetch from EduPage
    const overridesPath = path.resolve(process.cwd(), 'src/data/overrides.json');
    let overrides: OverridesConfig = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    let rawData: unknown;
    let fromFallback = false;
    let fetchedAt = Date.now();
    let validityWindow = { startDate: '17/8/2026', endDate: '31/1/2027' };
    let syncSource: PersistedTimetableStore['syncSource'] = 'cron';

    try {
      const upstream = await fetchRawTimetable();
      rawData = upstream.data;
      fromFallback = upstream.fromFallback;
      fetchedAt = upstream.fetchedAt;
      if (upstream.metadata.validityWindow) {
        validityWindow = upstream.metadata.validityWindow;
      }
    } catch (err) {
      console.warn('Live timetable fetch failed:', err);

      // Resilient fallback: if we have a persisted store (even if stale), serve it!
      if (persisted) {
        return NextResponse.json({
          periods: persisted.periods,
          rooms: persisted.rooms,
          occupancies: persisted.occupancies,
          validityWindow: persisted.validityWindow,
          fetchedAt: persisted.fetchedAt,
          fromFallback: true
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
          }
        });
      }

      // If no persisted store at all, fall back to offline fixture
      const fixturePath = path.resolve(process.cwd(), 'fixtures/regulartt.raw.json');
      rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      fromFallback = true;
      syncSource = 'local-fixture';
    }

    const parsed = parseTimetable(rawData, overrides, validityWindow);
    const knownRoomIds = new Set(parsed.rooms.map(r => r.id));
    const occupancies = buildOccupancies(
      parsed.cards,
      parsed.lessons,
      parsed.classes,
      parsed.subjects,
      parsed.teachers,
      knownRoomIds
    );

    // Save successful live fetch to persisted store
    if (!fromFallback) {
      await savePersistedTimetable({
        periods: parsed.periods,
        rooms: parsed.rooms,
        occupancies,
        substitutions: persisted?.substitutions || [],
        validityWindow,
        fetchedAt,
        syncSource
      });
    }

    return NextResponse.json({
      periods: parsed.periods,
      rooms: parsed.rooms,
      occupancies,
      validityWindow,
      fetchedAt,
      fromFallback
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Fatal timetable route failure:', err);
    return NextResponse.json({
      error: 'Failed to load timetable',
      message
    }, { status: 500 });
  }
}

