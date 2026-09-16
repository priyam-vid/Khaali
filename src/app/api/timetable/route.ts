import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { fetchRawTimetable } from '@/lib/edupage/client';
import { parseTimetable } from '@/lib/edupage/parse';
import { buildOccupancies } from '@/lib/domain/occupancy';
import { OverridesConfig } from '@/lib/domain/rooms';

// Base timetable revalidates every 1 hour (3600 seconds) via ISR
export const revalidate = 3600;

export async function GET() {
  try {
    const overridesPath = path.resolve(process.cwd(), 'src/data/overrides.json');
    let overrides: OverridesConfig = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    let rawData: unknown;
    let fromFallback = false;
    let fetchedAt = Date.now();
    let validityWindow = { startDate: '17/8/2026', endDate: '31/1/2027' };

    try {
      const upstream = await fetchRawTimetable();
      rawData = upstream.data;
      fromFallback = upstream.fromFallback;
      fetchedAt = upstream.fetchedAt;
      if (upstream.metadata.validityWindow) {
        validityWindow = upstream.metadata.validityWindow;
      }
    } catch (err) {
      console.warn('Timetable upstream fetch failed, using local fixture:', err);
      const fixturePath = path.resolve(process.cwd(), 'fixtures/regulartt.raw.json');
      rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      fromFallback = true;
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
  } catch (err: any) {
    console.error('Fatal timetable route failure:', err);
    return NextResponse.json({
      error: 'Failed to load timetable',
      message: err?.message || String(err)
    }, { status: 500 });
  }
}
