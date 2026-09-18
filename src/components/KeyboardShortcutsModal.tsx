'use client';

import React, { useEffect, useRef } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  // Store trigger element and handle Escape key + focus trapping
  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;

    // Focus close button on open
    const focusTimeout = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimeout);
      window.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: '← / →', desc: 'Cycle day (Mon – Sat)' },
    { key: '↑ / ↓', desc: 'Cycle timetable period slot (1 – 9)' },
    { key: '/', desc: 'Quick search (faculty schedules & room profiles)' },
    { key: '?', desc: 'Toggle keyboard shortcuts guide' },
    { key: 'ESC', desc: 'Dismiss active dialog or drawer' },
  ];

  const touchGestures = [
    { gesture: 'Swipe Left', desc: 'Advance to next period slot' },
    { gesture: 'Swipe Right', desc: 'Return to previous period slot' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts and Navigation Guide"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-page-bg border border-hairline overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Departure Board Header */}
        <div className="flex items-center justify-between p-3 border-b border-hairline bg-board-case">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-cell-ink">
              KEYBOARD & GESTURE COMMANDS
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog [ESC]"
            className="px-2.5 py-1 bg-cell-bg border border-hairline text-muted hover:text-cell-ink text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-signal"
          >
            [ESC]
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 font-mono text-xs">
          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
              <span>DESKTOP SHORTCUTS</span>
            </div>
            <div className="border border-hairline divide-y divide-hairline bg-cell-bg">
              {shortcuts.map((sc) => (
                <div key={sc.key} className="flex items-center justify-between p-2.5">
                  <span className="text-muted">{sc.desc}</span>
                  <kbd className="px-2 py-0.5 bg-board-case border border-hairline text-cell-ink font-bold tabular-nums">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
              <span>TOUCH & MOBILE GESTURES</span>
            </div>
            <div className="border border-hairline divide-y divide-hairline bg-cell-bg">
              {touchGestures.map((tg) => (
                <div key={tg.gesture} className="flex items-center justify-between p-2.5">
                  <span className="text-muted">{tg.desc}</span>
                  <span className="px-2 py-0.5 bg-board-case border border-hairline text-cell-ink font-bold">
                    {tg.gesture}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-muted border-t border-hairline pt-3">
            Press <kbd className="px-1 py-0.5 bg-board-case border border-hairline text-cell-ink font-bold">?</kbd> anytime from anywhere on the page to toggle this guide.
          </div>
        </div>
      </div>
    </div>
  );
};
