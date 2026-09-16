import { NextRequest, NextResponse } from 'next/server';
import { fetchSubstitutions } from '@/lib/edupage/substitutions';

// Substitutions revalidate every 5 minutes (300 seconds) via ISR
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || undefined;

  try {
    const result = await fetchSubstitutions(date);
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
  } catch (err: any) {
    console.error('Fatal substitution route error:', err);
    return NextResponse.json({
      substitutions: [],
      error: 'Failed to fetch substitutions',
      fromFallback: true,
      fetchedAt: Date.now()
    }, { status: 500 });
  }
}
