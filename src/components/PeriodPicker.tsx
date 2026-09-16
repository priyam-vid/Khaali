import React from 'react';
import { Period } from '@/lib/domain/rooms';

interface PeriodPickerProps {
  periods: Period[];
  selectedPeriod: number;
  onSelectPeriod: (periodIndex: number) => void;
}

export const PeriodPicker: React.FC<PeriodPickerProps> = ({
  periods,
  selectedPeriod,
  onSelectPeriod,
}) => {
  return (
    <div
      className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border"
      role="radiogroup"
      aria-label="Select period"
    >
      {periods.map(p => {
        const isSelected = selectedPeriod === p.index;
        return (
          <button
            key={p.index}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelectPeriod(p.index)}
            className={`min-h-[44px] flex flex-col items-center justify-center p-1.5 rounded border text-left transition-colors duration-150 relative ${
              isSelected
                ? 'bg-surface-2 border-brand text-text font-bold shadow-sm'
                : 'bg-surface border-border text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs font-bold text-text">P{p.index}</span>
            </div>
            <div className="text-[10px] font-mono tabular-nums text-muted leading-tight">
              {p.start}–{p.end}
            </div>
            {isSelected && (
              <span
                className="absolute bottom-1 w-4 h-[2px] rounded-full bg-brand"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
