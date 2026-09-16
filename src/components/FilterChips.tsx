import React from 'react';
import { Building } from '@/lib/domain/rooms';

export type FilterBuilding = 'ALL' | Building;

interface FilterChipsProps {
  selected: FilterBuilding;
  onChange: (building: FilterBuilding) => void;
  counts?: Partial<Record<FilterBuilding, number>>;
  orientation?: 'horizontal' | 'vertical';
}

const CHIPS: Array<{ id: FilterBuilding; label: string }> = [
  { id: 'ALL', label: 'ALL ROOMS' },
  { id: 'EB', label: 'EB' },
  { id: 'FB', label: 'FB' },
  { id: 'SVH', label: 'SVH' },
  { id: 'LAW', label: 'LAW' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  selected,
  onChange,
  counts = {},
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return (
      <nav aria-label="Building filters" className="space-y-1">
        <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
          <span>FILTER BY BUILDING</span>
        </div>
        <div className="flex flex-col gap-1">
          {CHIPS.map(chip => {
            const isSelected = selected === chip.id;
            const count = counts[chip.id];

            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange(chip.id)}
                className={`min-h-[38px] w-full flex items-center justify-between px-3 py-2 text-xs font-mono transition-colors border focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                  isSelected
                    ? 'bg-board-case text-cell-ink border-signal border-l-4 font-bold'
                    : 'bg-cell-bg text-muted border-hairline hover:bg-board-case/60 hover:text-cell-ink font-medium'
                }`}
              >
                <span>{chip.label}</span>
                {count !== undefined && (
                  <span className="text-[11px] tabular-nums font-mono opacity-80">
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

