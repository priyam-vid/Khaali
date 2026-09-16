import React from 'react';
import { Building } from '@/lib/domain/rooms';

export type FilterBuilding = 'ALL' | Building;

interface FilterChipsProps {
  selected: FilterBuilding;
  onChange: (building: FilterBuilding) => void;
  counts?: Partial<Record<FilterBuilding, number>>;
}

const CHIPS: Array<{ id: FilterBuilding; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'EB', label: 'EB' },
  { id: 'FB', label: 'FB' },
  { id: 'SVH', label: 'SVH' },
  { id: 'LAW', label: 'Law' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({
  selected,
  onChange,
  counts = {},
}) => {
  return (
    <nav
      aria-label="Building filters"
      className="sticky bottom-0 z-20 py-2.5 bg-ink/95 backdrop-blur border-t border-border mt-auto"
    >
      <div className="flex items-center justify-between gap-1 max-w-mobile mx-auto px-1">
        {CHIPS.map(chip => {
          const isSelected = selected === chip.id;
          const count = counts[chip.id];

          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(chip.id)}
              className={`min-h-[44px] min-w-[48px] flex-1 flex flex-col items-center justify-center px-2 py-1 rounded text-xs font-mono font-medium transition-all duration-150 relative ${
                isSelected
                  ? 'text-text font-bold'
                  : 'text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              <span className="flex items-center gap-1">
                {chip.label}
                {count !== undefined && count > 0 && (
                  <span className="text-[10px] opacity-75 tabular-nums">
                    ({count})
                  </span>
                )}
              </span>

              {/* Brand Maroon Underline Indicator */}
              {isSelected && (
                <span
                  className="absolute bottom-1 w-6 h-[2px] rounded-full bg-brand"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
