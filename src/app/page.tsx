import fs from 'node:fs';
import path from 'node:path';
import { parseTimetable } from '@/lib/edupage/parse';
import { buildOccupancies } from '@/lib/domain/occupancy';
import { OverridesConfig } from '@/lib/domain/rooms';
import { KhaaliClient } from '@/components/KhaaliClient';
import { KhaaliInitialData } from '@/lib/domain/types';
import { getPersistedTimetable, isStoreStale } from '@/lib/storage/timetable-store';

export const revalidate = 300;

async function loadInitialTimetable(): Promise<KhaaliInitialData> {
  try {
    const persisted = await getPersistedTimetable();
    if (persisted) {
      return {
        periods: persisted.periods,
        rooms: persisted.rooms,
        occupancies: persisted.occupancies,
        validityWindow: persisted.validityWindow,
        fetchedAt: persisted.fetchedAt,
        fromFallback: isStoreStale(persisted),
      };
    }
  } catch (err) {
    console.warn('Page: Could not load persisted timetable, using local fixture:', err);
  }

  const fixturePath = path.resolve(process.cwd(), 'fixtures/regulartt.raw.json');
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const overridesPath = path.resolve(process.cwd(), 'src/data/overrides.json');
  let overrides: OverridesConfig = {};
  if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  }

  const parsed = parseTimetable(rawFixture, overrides, {
    startDate: '17/8/2026',
    endDate: '31/1/2027',
  });

  const knownRoomIds = new Set(parsed.rooms.map(r => r.id));
  const occupancies = buildOccupancies(
    parsed.cards,
    parsed.lessons,
    parsed.classes,
    parsed.subjects,
    parsed.teachers,
    knownRoomIds
  );

  return {
    periods: parsed.periods,
    rooms: parsed.rooms,
    occupancies,
    validityWindow: parsed.validityWindow,
    fetchedAt: Date.now(),
    fromFallback: false,
  };
}

export default async function Page() {
  const initialData = await loadInitialTimetable();

  return (
    <main>
      <KhaaliClient initialData={initialData} />
    </main>
  );
}
