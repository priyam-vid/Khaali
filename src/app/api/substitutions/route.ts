import { NextRequest, NextResponse } from 'next/server';
import { fetchSubstitutions } from '@/lib/edupage/substitutions';
import {
  getPersistedTimetable,
  savePersistedTimetable,
  isStoreStale
} from '@/lib/storage/timetable-store';

// Substitutions revalidate every 5 minutes (300 seconds) via ISR
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;

  try {
    const persisted = await getPersistedTimetable();

    // If today's substitutions are requested and fresh in store, serve directly
    if (!date && persisted && Array.isArray(persisted.substitutions) && !isStoreStale(persisted)) {
      return NextResponse.json({
        substitutions: persisted.substitutions,
        date: new Date(persisted.fetchedAt).toISOString().split('T')[0],
        fromFallback: false,
        fetchedAt: persisted.fetchedAt
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
        }
      });
    }

    // Attempt live fetch from EduPage
    try {
      const result = await fetchSubstitutions(date);

      // If we fetched today's substitutions and have a persisted store, update it
      if (!date && persisted && !result.fromFallback) {
        await savePersistedTimetable({
          ...persisted,
          substitutions: result.changes,
        });
      }

      return NextResponse.json({
        substitutions: result.changes,
        date: result.date,
        fromFallback: result.fromFallback,
        fetchedAt: result.fetchedAt
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
        }
      });
    } catch (fetchErr) {
      console.warn('Live substitutions fetch failed, serving persisted fallback:', fetchErr);

      if (persisted && Array.isArray(persisted.substitutions)) {
        return NextResponse.json({
          substitutions: persisted.substitutions,
          date: new Date(persisted.fetchedAt).toISOString().split('T')[0],
          fromFallback: true,
          fetchedAt: persisted.fetchedAt
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
          }
        });
      }

      throw fetchErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Fatal substitution route error:', message);
    return NextResponse.json({
      substitutions: [],
      error: 'Failed to fetch substitutions',
      fromFallback: true,
      fetchedAt: Date.now()
    }, { status: 500 });
  }
}

