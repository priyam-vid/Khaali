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
      className="grid grid-cols-4 gap-1 pt-2 border-t border-hairline"
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
            className={`min-h-[44px] flex flex-col items-center justify-center p-1.5 border text-center transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
              isSelected
                ? 'bg-board-case border-signal border-b-2 text-cell-ink font-bold'
                : 'bg-cell-bg border-hairline text-muted hover:text-cell-ink hover:bg-board-case/60'
            }`}
          >
            <div className="font-mono text-xs font-bold text-cell-ink">
              P{p.index}
            </div>
            <div className="text-[10px] font-mono tabular-nums text-muted leading-tight mt-0.5">
              {p.start}
            </div>
          </button>
        );
      })}
    </div>
  );
};

