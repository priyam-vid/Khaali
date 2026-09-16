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

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
  const dayLabel = DAY_LABELS[selectedDay] || 'MON';

  return (
    <div className="my-2 border border-hairline bg-cell-bg">
      {/* Collapsed Bar: Minimum 44px tap target */}
      <div className="min-h-[44px] flex items-center justify-between px-3 py-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Change day and period"
          onClick={() => setIsOpen(prev => !prev)}
          className="flex-1 flex items-center gap-2 sm:gap-2.5 text-left font-mono text-xs sm:text-sm text-cell-ink hover:text-signal transition-colors focus:outline-none"
        >
          <span className="font-bold text-cell-ink bg-board-case px-2 py-0.5 border border-hairline uppercase">
            {dayLabel}
          </span>
          <span className="w-px h-3 bg-hairline shrink-0" aria-hidden="true" />
          <span className="font-semibold text-cell-ink uppercase">
            PERIOD {selectedPeriod}
          </span>
          <span className="text-muted text-xs tabular-nums">
            ({activePeriod.start}–{activePeriod.end})
          </span>
          <span className="text-muted text-[10px] font-mono ml-1 px-1 py-0.5 border border-hairline bg-board-case">
            {isOpen ? '[-]' : '[+]'}
          </span>
        </button>

        {!isLive && (
          <button
            type="button"
            onClick={onResetToLive}
            title="Snap back to current IST time"
            className="min-h-[32px] px-2.5 py-1 bg-brand text-white text-[11px] font-mono font-bold tracking-wider hover:opacity-90 transition-opacity ml-2 border border-brand uppercase"
          >
            LIVE IST ⟲
          </button>
        )}
      </div>

      {/* Expanded Picker */}
      {isOpen && (
        <div className="p-3 pt-2 border-t border-hairline bg-board-case/40">
          <div className="mb-3">
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
              <span>SELECT TIMETABLE DAY</span>
            </div>
            <DayTabs
              selectedDay={selectedDay}
              onSelectDay={(d) => {
                onSelectDay(d);
              }}
            />
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
              <span>SELECT PERIOD SLOT</span>
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

