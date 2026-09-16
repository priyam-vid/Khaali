import React from 'react';
import { DayIndex } from '@/lib/domain/rooms';

interface DayTabsProps {
  selectedDay: DayIndex;
  onSelectDay: (day: DayIndex) => void;
}

const DAYS: Array<{ index: DayIndex; label: string }> = [
  { index: 0, label: 'Mon' },
  { index: 1, label: 'Tue' },
  { index: 2, label: 'Wed' },
  { index: 3, label: 'Thu' },
  { index: 4, label: 'Fri' },
  { index: 5, label: 'Sat' },
];

export const DayTabs: React.FC<DayTabsProps> = ({ selectedDay, onSelectDay }) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Select day">
      {DAYS.map(day => {
        const isSelected = selectedDay === day.index;
        return (
          <button
            key={day.index}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onSelectDay(day.index)}
            className={`min-h-[44px] flex-1 px-3 py-2 rounded text-xs font-mono font-medium transition-colors duration-150 relative ${
              isSelected
                ? 'bg-surface-2 text-text font-bold'
                : 'text-muted hover:text-text hover:bg-surface'
            }`}
          >
            {day.label}
            {isSelected && (
              <span
                className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-brand"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
