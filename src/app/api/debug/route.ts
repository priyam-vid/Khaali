import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { parseTimetable } from '@/lib/edupage/parse';
import { buildOccupancies, createOccupancyStore } from '@/lib/domain/occupancy';
import { evaluateVacancy } from '@/lib/domain/vacancy';
import { detectCurrentPeriod } from '@/lib/domain/time';
import { OverridesConfig } from '@/lib/domain/rooms';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const expectedKey = process.env.DEBUG_KEY || 'khaali-debug';

  if (!key || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized. Provide ?key=...' }, { status: 401 });
  }

  try {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/regulartt.raw.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    const overridesPath = path.resolve(process.cwd(), 'src/data/overrides.json');
    let overrides: OverridesConfig = {};
    if (fs.existsSync(overridesPath)) {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    const parsed = parseTimetable(rawFixture, overrides);
    const knownRoomIds = new Set(parsed.rooms.map(r => r.id));
    const occupancies = buildOccupancies(
      parsed.cards,
      parsed.lessons,
      parsed.classes,
      parsed.subjects,
      parsed.teachers,
      knownRoomIds
    );
    const occupancyStore = createOccupancyStore(occupancies);

    const periodDetection = detectCurrentPeriod(parsed.periods);
    const activeDay = periodDetection.dayIndex ?? 0;
    const activePeriod = periodDetection.activePeriodIndex;

    const vacancy = evaluateVacancy(
      activeDay,
      activePeriod,
      parsed.rooms,
      parsed.periods,
      occupancyStore
    );

    const labs = parsed.rooms.filter(r => r.isLab).map(r => ({
      id: r.id,
      name: r.name,
      building: r.building,
      floor: r.floor
    }));

    const neverScheduled = parsed.rooms.filter(r => r.neverScheduled).map(r => ({
      id: r.id,
      name: r.name,
      building: r.building
    }));

    return NextResponse.json({
      status: 'ok',
      currentDetection: periodDetection,
      tablesSummary: {
        periodsCount: parsed.periods.length,
        roomsCount: parsed.rooms.length,
        cardsCount: parsed.cards.length,
        lessonsCount: parsed.lessons.size,
        classesCount: parsed.classes.size,
        subjectsCount: parsed.subjects.size,
        teachersCount: parsed.teachers.size,
        totalOccupanciesExpanded: occupancies.length
      },
      vacancySummary: {
        day: activeDay,
        period: activePeriod,
        totalRooms: vacancy.totalRooms,
        vacantCount: vacancy.vacantRoomsCount,
        occupiedCount: vacancy.occupiedRoomsCount,
        labsCount: vacancy.labsCount,
        neverScheduledCount: vacancy.neverScheduledCount,
        heroRoom: vacancy.heroAnswer ? {
          room: vacancy.heroAnswer.room.name,
          durationMinutes: vacancy.heroAnswer.durationMinutes,
          until: vacancy.heroAnswer.endTime
        } : null
      },
      labs,
      neverScheduled,
      allRooms: parsed.rooms
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err?.message || String(err),
      stack: err?.stack
    }, { status: 500 });
  }
}
