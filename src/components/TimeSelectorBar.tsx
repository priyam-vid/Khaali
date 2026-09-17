import React, { useState, useEffect, useRef } from 'react';
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
  const [isOpen, setIsOpen] = useState(true);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Restore user manual preference for open/closed state (default true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('khaali:timeSelectorOpen');
      if (stored !== null) {
        setIsOpen(stored === 'true');
      }
    } catch {
      // Ignore
    }
  }, []);

  // Check if first-time swipe hint should be displayed
  useEffect(() => {
    try {
      const seen = localStorage.getItem('khaali:swipeHintSeen');
      if (!seen) {
        setShowSwipeHint(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try {
      localStorage.setItem('khaali:swipeHintSeen', 'true');
    } catch {
      // Ignore
    }
  };

  const toggleOpen = () => {
    setIsOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('khaali:timeSelectorOpen', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const activePeriod = periods.find(p => p.index === selectedPeriod) || periods[0];
  const dayLabel = DAY_LABELS[selectedDay] || 'MON';

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // Threshold >40px and predominantly horizontal (|deltaX| > |deltaY| * 1.2)
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      dismissSwipeHint();
      if (deltaX < 0) {
        // Swiped Left -> Advance
        if (selectedPeriod < periods.length) {
          onSelectPeriod(selectedPeriod + 1);
        } else {
          onSelectDay(((selectedDay + 1) % 6) as DayIndex);
          onSelectPeriod(1);
        }
      } else {
        // Swiped Right -> Retreat
        if (selectedPeriod > 1) {
          onSelectPeriod(selectedPeriod - 1);
        } else {
          onSelectDay(((selectedDay + 5) % 6) as DayIndex);
          onSelectPeriod(periods.length);
        }
      }
    }
  };

  return (
    <div className="my-2 border border-hairline bg-cell-bg select-none">
      {/* First-Time Mobile Swipe Hint */}
      {showSwipeHint && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-board-case/80 border-b border-hairline text-muted font-mono text-[11px] animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <span className="text-signal" aria-hidden="true">⇄</span>
            <span>Swipe ← → to change period</span>
          </div>
          <button
            type="button"
            onClick={dismissSwipeHint}
            aria-label="Dismiss swipe hint"
            className="text-[10px] text-muted hover:text-cell-ink px-1.5 py-0.5 border border-hairline/60 bg-cell-bg uppercase ml-2 focus:outline-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Collapsed Bar: Minimum 44px tap target with touch swipe support */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="min-h-[44px] flex items-center justify-between px-3 py-2"
      >
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label="Change day and period (swipe left/right to cycle)"
          onClick={toggleOpen}
          className="flex-1 flex items-center gap-2 sm:gap-2.5 text-left font-mono text-xs sm:text-sm text-cell-ink hover:text-signal transition-colors focus:outline-none min-h-[44px]"
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
            className="min-h-[44px] px-3 py-2 bg-brand text-white text-[11px] font-mono font-bold tracking-wider hover:opacity-90 transition-opacity ml-2 border border-brand uppercase flex items-center justify-center shrink-0"
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
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

