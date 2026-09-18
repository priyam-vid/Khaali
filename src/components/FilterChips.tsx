import React from 'react';
import { Building } from '@/lib/domain/rooms';

export type FilterBuilding = 'ALL' | Building;

interface FilterChipsProps {
  selected: FilterBuilding;
  onChange: (building: FilterBuilding) => void;
  counts?: Partial<Record<FilterBuilding, number>>;
  orientation?: 'horizontal' | 'vertical';
}

const CHIPS: Array<{ id: FilterBuilding; label: string; title: string }> = [
  { id: 'ALL', label: 'ALL ROOMS', title: 'All University Classrooms' },
  { id: 'EB', label: 'EB', title: 'Engineering Block (EB)' },
  { id: 'FB', label: 'FB', title: 'Foundation Block (FB)' },
  { id: 'SVH', label: 'SVH', title: 'Shri Vishwakarma Hall (SVH)' },
  { id: 'LAW', label: 'LAW', title: 'School of Law (LAW)' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  selected,
  onChange,
  counts = {},
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return (
      <nav aria-label="Building filters" className="space-y-2">
        <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
          <span>FILTER BY BUILDING</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {CHIPS.map(chip => {
            const isSelected = selected === chip.id;
            const count = counts[chip.id];

            return (
              <button
                key={chip.id}
                type="button"
                title={chip.title}
                aria-pressed={isSelected}
                onClick={() => onChange(chip.id)}
                className={`min-h-[50px] flex flex-col items-center justify-center p-2 text-xs font-mono transition-colors border focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                  isSelected
                    ? 'bg-board-case text-cell-ink border-signal border-b-2 font-bold'
                    : 'bg-cell-bg text-muted border-hairline hover:bg-board-case/60 hover:text-cell-ink font-medium'
                }`}
              >
                <span className="truncate">{chip.id === 'ALL' ? 'ALL' : chip.label}</span>
                {count !== undefined && (
                  <span className="text-[10px] opacity-75 tabular-nums mt-0.5 font-mono">
                    [{count}]
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Building filters"
      className="sticky bottom-0 z-20 py-2 bg-page-bg border-t border-hairline mt-auto"
    >
      <div className="grid grid-cols-5 gap-1 max-w-mobile mx-auto px-1">
        {CHIPS.map(chip => {
          const isSelected = selected === chip.id;
          const count = counts[chip.id];

          return (
            <button
              key={chip.id}
              type="button"
              title={chip.title}
              aria-pressed={isSelected}
              onClick={() => onChange(chip.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center p-1 text-xs font-mono transition-colors border focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                isSelected
                  ? 'bg-board-case text-cell-ink border-signal border-b-2 font-bold'
                  : 'bg-cell-bg text-muted border-hairline hover:text-cell-ink hover:bg-board-case/60 font-medium'
              }`}
            >
              <span className="truncate">{chip.id === 'ALL' ? 'ALL' : chip.label}</span>
              {count !== undefined && count > 0 && (
                <span className="text-[10px] opacity-75 tabular-nums mt-0.5">
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

