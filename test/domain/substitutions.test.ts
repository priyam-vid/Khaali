import { describe, it, expect } from 'vitest';
import { parseSubstitutionHtml, applySubstitutions, SubstitutionChange } from '../../src/lib/edupage/substitutions';
import { Occupancy, Room } from '../../src/lib/domain/rooms';

describe('Substitutions & Resilience Engine', () => {
  const sampleRooms: Room[] = [
    { id: '*1', name: 'EB 201', short: 'EB 201', building: 'EB', floor: 2, isLab: false, excluded: false, neverScheduled: false },
    { id: '*2', name: 'EB 202', short: 'EB 202', building: 'EB', floor: 2, isLab: false, excluded: false, neverScheduled: false },
    { id: '*11', name: 'EB 305', short: 'EB 305', building: 'EB', floor: 3, isLab: false, excluded: false, neverScheduled: false },
  ];

  it('parses empty substitution HTML as zero changes', () => {
    const emptyHtml = '<div class="row nosubst"><div class="info"><span>There is no substitution defined for this day.</span></div></div>';
    const changes = parseSubstitutionHtml(emptyHtml, '2026-09-16');
    expect(changes).toHaveLength(0);
  });

  it('parses room change and cancellation from substitution HTML report', () => {
    const reportHtml = `
      <div class="row">
        <div class="period"><span>3</span></div>
        <div class="info"><span>2CSE1: Class cancelled</span></div>
      </div>
      <div class="row">
        <div class="period"><span>5</span></div>
        <div class="info"><span>3CSE2: Room changed to EB 305</span></div>
      </div>
    `;

    const changes = parseSubstitutionHtml(reportHtml, '2026-09-16');
    expect(changes).toHaveLength(2);
    expect(changes[0].period).toBe(3);
    expect(changes[0].type).toBe('cancelled');

    expect(changes[1].period).toBe(5);
    expect(changes[1].type).toBe('room_swap');
    expect(changes[1].newRoomName).toBe('EB 305');
  });

  it('merges cancellations: frees up the cancelled room', () => {
    const initialOccupancies: Occupancy[] = [
      {
        roomId: '*1', // EB 201
        day: 2, // Wednesday
        period: 3,
        subjectCode: 'CSE101',
        subjectName: 'Programming',
        teacherNames: ['Dr. Sharma'],
        batchNames: ['2CSE1'],
        source: 'timetable'
      }
    ];

    const subst: SubstitutionChange[] = [
      {
        date: '2026-09-16',
        period: 3,
        batchName: '2CSE1',
        originalRoomName: 'EB 201',
        type: 'cancelled',
        rawText: '2CSE1 class cancelled'
      }
    ];

    const merged = applySubstitutions(initialOccupancies, subst, sampleRooms, 2);
    expect(merged).toHaveLength(0); // cancelled room is freed
  });

  it('merges room swaps: marks new room as occupied', () => {
    const initialOccupancies: Occupancy[] = [
      {
        roomId: '*1', // EB 201
        day: 2,
        period: 5,
        subjectCode: 'CSE102',
        subjectName: 'Data Structures',
        teacherNames: ['Dr. Roy'],
        batchNames: ['3CSE2'],
        source: 'timetable'
      }
    ];

    const subst: SubstitutionChange[] = [
      {
        date: '2026-09-16',
        period: 5,
        originalRoomName: 'EB 201',
        newRoomName: 'EB 305',
        type: 'room_swap',
        rawText: 'Room changed to EB 305'
      }
    ];

    const merged = applySubstitutions(initialOccupancies, subst, sampleRooms, 2);
    expect(merged).toHaveLength(1);
    expect(merged[0].roomId).toBe('*11'); // EB 305
    expect(merged[0].source).toBe('substitution');
  });
});
