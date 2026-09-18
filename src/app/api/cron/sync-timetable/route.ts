import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { fetchRawTimetable } from '@/lib/edupage/client';
import { fetchSubstitutions, SubstitutionChange } from '@/lib/edupage/substitutions';
import { parseTimetable } from '@/lib/edupage/parse';
import { buildOccupancies } from '@/lib/domain/occupancy';
import { OverridesConfig } from '@/lib/domain/rooms';
import { savePersistedTimetable, PersistedTimetableStore } from '@/lib/storage/timetable-store';

/**
 * Daily Automatic Timetable Synchronization Route
 * ------------------------------------------------
 * Vercel Cron Schedule: 0 4 * * *
 * UTC Time: 04:00 UTC
 * IST Time: 09:30 IST (Asia/Kolkata = UTC + 5:30 with no daylight saving time)
 *
 * Rationale:
 * College classes begin at 09:00 IST. The cron triggers at 09:30 IST to capture
 * morning departmental substitution notices, cancellations, and room swaps
 * before students look up their mid-day free periods.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for full upstream scrape

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const debugKey = process.env.DEBUG_KEY || (isProd ? undefined : 'khaali-debug');

  // 1. Check Vercel Cron Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 2. Check query parameter ?key=... for manual debug triggers
  const { searchParams } = new URL(request.url);
  const paramKey = searchParams.get('key');
  if (paramKey && ((debugKey && paramKey === debugKey) || (cronSecret && paramKey === cronSecret))) {
    return true;
  }

  // 3. Check custom header x-debug-key
  const customHeader = request.headers.get('x-debug-key');
  if (customHeader && ((debugKey && customHeader === debugKey) || (cronSecret && customHeader === cronSecret))) {
    return true;
  }

  return false;
}

async function handleSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide valid CRON_SECRET or ?key=...' },
      { status: 401 }
    );
  }

  try {
    const overridesPath = path.resolve(process.cwd(), 'src/data/overrides.json');
    let overrides: OverridesConfig = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    let rawData: unknown;
    let validityWindow = { startDate: '17/8/2026', endDate: '31/1/2027' };
    let syncSource: PersistedTimetableStore['syncSource'] = 'cron';

    // 1. Fetch raw timetable from EduPage RPC
    try {
      const upstream = await fetchRawTimetable();
      rawData = upstream.data;
      if (upstream.metadata.validityWindow) {
        validityWindow = upstream.metadata.validityWindow;
      }
    } catch (err) {
      console.warn('Cron: Upstream timetable fetch failed, using local fixture:', err);
      const fixturePath = path.resolve(process.cwd(), 'fixtures/regulartt.raw.json');
      rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      syncSource = 'upstream-fallback';
    }

    // 2. Fetch active substitutions
    let substitutions: SubstitutionChange[] = [];
    try {
      const subResult = await fetchSubstitutions();
      substitutions = subResult.changes || [];
    } catch (subErr) {
      console.warn('Cron: Upstream substitutions fetch failed:', subErr);
    }

    // 3. Normalize tables and build domain models
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

    const fetchedAt = Date.now();
    const storePayload: PersistedTimetableStore = {
      periods: parsed.periods,
      rooms: parsed.rooms,
      occupancies,
      substitutions,
      validityWindow,
      fetchedAt,
      syncSource
    };

    // 4. Persist to Vercel Blob (with local filesystem fallback)
    await savePersistedTimetable(storePayload);

    return NextResponse.json({
      status: 'ok',
      message: 'Timetable and substitutions synchronized successfully',
      syncSource,
      fetchedAt,
      istTime: new Date(fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      counts: {
        periods: parsed.periods.length,
        rooms: parsed.rooms.length,
        occupancies: occupancies.length,
        substitutions: substitutions.length
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Cron synchronization fatal error:', err);
    return NextResponse.json({
      status: 'error',
      message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
