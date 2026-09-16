import React, { useState, useEffect, useMemo } from 'react';
import { DayIndex, Period, Room } from '@/lib/domain/rooms';
import { OccupancyStore } from '@/lib/domain/occupancy';
import { evaluateVacancy } from '@/lib/domain/vacancy';

interface MyGapCardProps {
  day: DayIndex;
  currentPeriodIndex: number;
  periods: Period[];
  rooms: Room[];
  occupancyStore: OccupancyStore;
  allBatches: string[];
}

export const MyGapCard: React.FC<MyGapCardProps> = ({
  day,
  currentPeriodIndex,
  periods,
  rooms,
  occupancyStore,
  allBatches,
}) => {
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Load persisted batch from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('khaali_user_batch');
      if (saved) {
        setSelectedBatch(saved);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleSelectBatch = (batch: string) => {
    setSelectedBatch(batch);
    setIsEditing(false);
    try {
      localStorage.setItem('khaali_user_batch', batch);
    } catch {
      // Ignore localStorage write errors
    }
  };

  // Find batch occupancy schedule for the selected day
  const batchSchedule = useMemo(() => {
    if (!selectedBatch) return [];
    return occupancyStore.getBatchOccupancies(day, selectedBatch);
  }, [day, selectedBatch, occupancyStore]);

  // Find if batch is in class during the current period
  const currentClass = useMemo(() => {
    return batchSchedule.find(occ => occ.period === currentPeriodIndex);
  }, [batchSchedule, currentPeriodIndex]);

  // Find next free gap for this batch
  const gapAnalysis = useMemo(() => {
    if (!selectedBatch) return null;

    const currentPeriodObj = periods.find(p => p.index === currentPeriodIndex) || periods[0];

    // Check if free now
    if (!currentClass) {
      // Walk forward to find until when batch is free
      let endPeriod = currentPeriodIndex;
      while (endPeriod < periods.length) {
        const nextPeriod = endPeriod + 1;
        const hasNextClass = batchSchedule.some(occ => occ.period === nextPeriod);
        if (hasNextClass) break;
        endPeriod = nextPeriod;
      }

      const endPeriodObj = periods.find(p => p.index === endPeriod) || currentPeriodObj;
      
      // Calculate vacant rooms during this free gap
      const vacancy = evaluateVacancy(day, currentPeriodIndex, rooms, periods, occupancyStore);
      const nearestRooms = vacancy.rankedRuns.slice(0, 3).map(r => r.room.name);

      return {
        isFreeNow: true,
        startTime: currentPeriodObj.start,
        endTime: endPeriodObj.end,
        nearestRooms,
      };
    } else {
      // Currently in class. Find next upcoming gap
      let nextGapStart: Period | null = null;
      let nextGapEnd: Period | null = null;

      for (let p = currentPeriodIndex + 1; p <= periods.length; p++) {
        const hasClass = batchSchedule.some(occ => occ.period === p);
        if (!hasClass) {
          if (!nextGapStart) {
            nextGapStart = periods.find(item => item.index === p) || null;
            nextGapEnd = nextGapStart;
          } else {
            nextGapEnd = periods.find(item => item.index === p) || nextGapEnd;
          }
        } else if (nextGapStart) {
          break; // Gap ended
        }
      }

      let nearestRooms: string[] = [];
      if (nextGapStart) {
        const gapVacancy = evaluateVacancy(day, nextGapStart.index, rooms, periods, occupancyStore);
        nearestRooms = gapVacancy.rankedRuns.slice(0, 3).map(r => r.room.name);
      }

      return {
        isFreeNow: false,
        currentClass,
        nextGapStart: nextGapStart?.start,
        nextGapEnd: nextGapEnd?.end,
        nearestRooms,
      };
    }
  }, [selectedBatch, currentClass, batchSchedule, currentPeriodIndex, periods, day, rooms, occupancyStore]);

  // Filtered batch options for picker
  const filteredBatches = useMemo(() => {
    if (!searchFilter) return allBatches.slice(0, 20);
    return allBatches
      .filter(b => b.toLowerCase().includes(searchFilter.toLowerCase()))
      .slice(0, 20);
  }, [allBatches, searchFilter]);

  return (
    <div className="my-2 p-3 bg-cell-bg border border-hairline">
      {/* Header: Batch Selector Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted">
          <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
          <span className="uppercase tracking-wider">YOUR BATCH:</span>
          {selectedBatch ? (
            <span className="font-bold text-cell-ink bg-board-case px-2 py-0.5 border border-hairline uppercase">
              {selectedBatch}
            </span>
          ) : (
            <span className="text-muted italic">NONE CONFIGURED</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(prev => !prev)}
          className="text-xs font-mono text-cell-ink hover:text-signal px-2 py-1 bg-board-case border border-hairline uppercase transition-colors"
        >
          {isEditing ? '[DONE]' : selectedBatch ? '[CHANGE]' : '[SELECT BATCH]'}
        </button>
      </div>

      {/* Batch Autocomplete Dropdown */}
      {isEditing && (
        <div className="mt-2.5 pt-2.5 border-t border-hairline">
          <input
            type="text"
            placeholder="Type batch name (e.g. 2BCA1, 1CSE4)..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-page-bg border border-hairline font-mono text-xs text-cell-ink placeholder:text-muted focus:outline-none focus:border-signal"
            autoFocus
          />
          <div className="mt-1.5 max-h-36 overflow-y-auto flex flex-wrap gap-1">
            {filteredBatches.map(batch => (
              <button
                key={batch}
                type="button"
                onClick={() => handleSelectBatch(batch)}
                className={`px-2 py-1 font-mono text-xs border transition-colors ${
                  selectedBatch === batch
                    ? 'bg-board-case border-signal text-cell-ink font-bold'
                    : 'bg-cell-bg border-hairline text-muted hover:text-cell-ink'
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis Output */}
      {selectedBatch && !isEditing && gapAnalysis && (
        <div className="mt-2.5 pt-2 border-t border-hairline">
          {gapAnalysis.isFreeNow ? (
            <div>
              <div className="font-mono text-xs font-bold text-signal flex items-center gap-1.5 tabular-nums uppercase">
                <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
                <span>FREE NOW: {gapAnalysis.startTime}–{gapAnalysis.endTime}</span>
              </div>
              {gapAnalysis.nearestRooms.length > 0 && (
                <div className="text-xs font-mono text-muted mt-1 flex items-center flex-wrap gap-1">
                  <span>NEAREST VACANT:</span>
                  <span className="font-bold text-cell-ink">
                    {gapAnalysis.nearestRooms.join(', ')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="font-mono text-xs text-muted flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 bg-unlit shrink-0" aria-hidden="true" />
                <span className="uppercase">IN CLASS:</span>
                <span className="font-semibold text-cell-ink truncate">
                  {gapAnalysis.currentClass?.subjectCode || gapAnalysis.currentClass?.subjectName || 'Scheduled Session'}
                </span>
              </div>
              {gapAnalysis.nextGapStart ? (
                <div className="text-xs font-mono mt-1 tabular-nums">
                  <span className="text-muted uppercase">NEXT FREE: </span>
                  <span className="text-signal font-bold">
                    {gapAnalysis.nextGapStart}–{gapAnalysis.nextGapEnd}
                  </span>
                  {gapAnalysis.nearestRooms.length > 0 && (
                    <span className="text-muted">
                      {' '}[NEAREST: {gapAnalysis.nearestRooms.join(', ')}]
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono text-muted mt-1">
                  In class through remainder of college day.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

