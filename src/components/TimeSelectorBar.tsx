import React, { useState } from 'react';
import { DayIndex, Period } from '@/lib/domain/rooms';
import { DayTabs } from './DayTabs';
import { PeriodPicker } from './PeriodPicker';

interface TimeSelectorBarProps {
  periods: Period[];
  selectedDay: DayIndex;
  selectedPeriod: number;
  onSelectDay: (day: DayIndex) => void;
  onSelectPeriod: (periodIndex: number) => void;
  isLive: boolean;
  onResetToLive: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TimeSelectorBar: React.FC<TimeSelectorBarProps> = ({
  periods,
  selectedDay,
  selectedPeriod,
  onSelectDay,
  onSelectPeriod,
  isLive,
  onResetToLive,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activePeriod = periods.find(p => p.index === selectedPeriod) || periods[0];
  const dayLabel = DAY_LABELS[selectedDay] || 'Mon';

  return (
    <div className="my-2 border border-border rounded-lg bg-surface overflow-hidden">
      {/* Collapsed Bar: Minimum 44px tap target */}
      <div className="min-h-[44px] flex items-center justify-between px-3 py-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Change day and period"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex-1 flex items-center gap-2 text-left font-mono text-xs sm:text-sm text-text hover:text-white transition-colors"
        >
          <span className="font-bold text-text bg-surface-2 px-1.5 py-0.5 rounded border border-border">
            {dayLabel}
          </span>
          <span className="text-muted">·</span>
          <span className="font-semibold text-text">
            Period {selectedPeriod}
          </span>
          <span className="text-muted text-xs tabular-nums">
            ({activePeriod.start}–{activePeriod.end})
          </span>
          <span className="text-muted text-[10px] ml-1">
            {isOpen ? '▲' : '▼'}
          </span>
        </button>

        {!isLive && (
          <button
            type="button"
            onClick={onResetToLive}
            title="Snap back to current IST time"
            className="min-h-[32px] px-2 py-1 rounded bg-brand/20 border border-brand/50 text-brand text-[11px] font-mono font-medium hover:bg-brand/30 transition-colors ml-2"
          >
            Live IST ⟲
          </button>
        )}
      </div>

      {/* Expanded Picker */}
      {isOpen && (
        <div className="p-3 pt-1 border-t border-border bg-ink/40">
          <div className="mb-2">
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5">
              Select Day
            </div>
            <DayTabs
              selectedDay={selectedDay}
              onSelectDay={(d) => {
                onSelectDay(d);
              }}
            />
          </div>

          <div className="mt-2">
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5">
              Select Period
            </div>
            <PeriodPicker
              periods={periods}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={(p) => {
                onSelectPeriod(p);
                setIsOpen(false); // Automatically collapse once period selected for fast UX
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
