import React from 'react';
import { DayIndex } from '@/lib/domain/rooms';

interface DayTabsProps {
  selectedDay: DayIndex;
  onSelectDay: (day: DayIndex) => void;
}

const DAYS: Array<{ index: DayIndex; label: string }> = [
  { index: 0, label: 'MON' },
  { index: 1, label: 'TUE' },
  { index: 2, label: 'WED' },
  { index: 3, label: 'THU' },
  { index: 4, label: 'FRI' },
  { index: 5, label: 'SAT' },
];

export const DayTabs: React.FC<DayTabsProps> = ({ selectedDay, onSelectDay }) => {
  return (
    <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="Select day">
      {DAYS.map(day => {
        const isSelected = selectedDay === day.index;
        return (
          <button
            key={day.index}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onSelectDay(day.index)}
            className={`min-h-[44px] flex items-center justify-center px-2 py-2 text-xs font-mono font-bold transition-colors duration-150 border uppercase focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
              isSelected
                ? 'bg-board-case text-cell-ink border-signal border-b-2'
                : 'bg-cell-bg text-muted border-hairline hover:text-cell-ink hover:bg-board-case/60'
            }`}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
};

