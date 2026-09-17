import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DayIndex, Period, Room, Occupancy } from '@/lib/domain/rooms';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayIndex;
  currentPeriod: number;
  periods: Period[];
  rooms: Room[];
  occupancies: Occupancy[];
  allProfessors: string[];
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  day,
  currentPeriod,
  periods,
  rooms,
  occupancies,
  allProfessors,
}) => {
  const [activeTab, setActiveTab] = useState<'professors' | 'rooms'>('professors');
  const [query, setQuery] = useState('');
  const [selectedProf, setSelectedProf] = useState<string>('Mr. Vikas Singh');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const modalRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  // History back-button integration
  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.modal === 'search') {
      window.history.back();
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Capture triggering element before modal takes focus
    triggerRef.current = document.activeElement;

    // Push history state if not already in modal state
    if (typeof window !== 'undefined' && window.history.state?.modal !== 'search') {
      window.history.pushState({ modal: 'search' }, '');
    }

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    // Auto-focus the search input
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    // Trap focus and handle Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
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
      clearTimeout(focusTimer);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose, handleClose]);

  // Auto-select first room or EB 305 if available
  useMemo(() => {
    if (!selectedRoomId && rooms.length > 0) {
      const eb305 = rooms.find(r => r.short.includes('305') || r.name.includes('305'));
      setSelectedRoomId(eb305 ? eb305.id : rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  if (!isOpen) return null;

  // Filtered professors list
  const filteredProfs = allProfessors
    .filter(p => p.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15);

  // Filtered rooms list (matches name or short code)
  const filteredRooms = rooms
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.short.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15);

  // Professor schedule for today
  const profSchedule = occupancies.filter(
    occ => occ.day === day && occ.teacherNames.some(t => t.toLowerCase() === selectedProf.toLowerCase())
  );

  // Room schedule for today
  const roomSchedule = occupancies.filter(
    occ => occ.day === day && occ.roomId === selectedRoomId
  );
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Current period status
  const currentProfClass = profSchedule.find(occ => occ.period === currentPeriod);
  const currentRoomClass = roomSchedule.find(occ => occ.period === currentPeriod);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schedule Inquiry"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-page-bg border border-hairline overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
      >
        {/* Mechanical Header */}
        <div className="flex items-center justify-between p-3 border-b border-hairline bg-board-case">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('professors');
                setQuery('');
              }}
              className={`px-3 py-1.5 font-bold uppercase transition-colors border ${
                activeTab === 'professors'
                  ? 'bg-cell-bg text-cell-ink border-signal border-b-2'
                  : 'text-muted border-transparent hover:text-cell-ink'
              }`}
            >
              FACULTY SCHEDULES
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('rooms');
                setQuery('');
              }}
              className={`px-3 py-1.5 font-bold uppercase transition-colors border ${
                activeTab === 'rooms'
                  ? 'bg-cell-bg text-cell-ink border-signal border-b-2'
                  : 'text-muted border-transparent hover:text-cell-ink'
              }`}
            >
              ROOM SCHEDULES
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog [ESC]"
            title="Close [ESC]"
            className="px-2 py-1 bg-cell-bg border border-hairline text-muted hover:text-cell-ink text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-signal"
          >
            [ESC]
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3 border-b border-hairline bg-cell-bg">
          <input
            ref={inputRef}
            type="text"
            placeholder={
              activeTab === 'professors'
                ? 'Search faculty name (e.g. Vikas Singh, AV)...'
                : 'Search room code (e.g. EB 305, Dell Lab)...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-3 py-2 bg-page-bg border border-hairline font-mono text-xs text-cell-ink placeholder:text-muted focus:outline-none focus:border-signal"
            autoFocus
          />
        </div>

        {/* Modal Body */}
        <div className="p-3 overflow-y-auto space-y-3 font-mono">
          {activeTab === 'professors' ? (
            <div>
              {/* Matches List */}
              {query && (
                <div className="mb-3">
                  <div className="text-[11px] text-muted uppercase mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
                    <span>MATCHING FACULTY:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filteredProfs.map(prof => (
                      <button
                        key={prof}
                        type="button"
                        onClick={() => {
                          setSelectedProf(prof);
                          setQuery('');
                        }}
                        className={`px-2 py-1 text-xs border transition-colors ${
                          selectedProf === prof
                            ? 'bg-board-case border-signal text-cell-ink font-bold'
                            : 'bg-cell-bg border-hairline text-muted hover:text-cell-ink'
                        }`}
                      >
                        {prof}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Professor Card */}
              <div className="p-3 bg-cell-bg border border-hairline">
                <div className="text-[10px] text-muted uppercase">FACULTY PROFILE</div>
                <div className="text-base font-bold text-cell-ink mt-0.5">{selectedProf}</div>

                {/* Right Now Status */}
                <div className="mt-2.5 pt-2 border-t border-hairline">
                  <div className="text-[11px] text-muted uppercase">STATUS (PERIOD {currentPeriod}):</div>
                  {currentProfClass ? (
                    <div className="mt-1 text-xs">
                      <span className="inline-block px-1.5 py-0.5 bg-board-case text-signal font-bold mr-1.5 border border-signal/60 uppercase">
                        IN CLASS
                      </span>
                      <span className="font-bold text-cell-ink">
                        {rooms.find(r => r.id === currentProfClass.roomId)?.short || currentProfClass.roomId}
                      </span>
                      <span className="text-muted">
                        {' '}[{currentProfClass.subjectName || currentProfClass.subjectCode}] ({currentProfClass.batchNames.join(', ')})
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-signal flex items-center gap-1.5 font-bold uppercase">
                      <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
                      FREE | NO CLASS IN PERIOD {currentPeriod}
                    </div>
                  )}
                </div>

                {/* Today's Schedule Breakdown */}
                <div className="mt-3 pt-2 border-t border-hairline">
                  <div className="text-[11px] text-muted uppercase mb-1.5">TODAY SCHEDULE:</div>
                  {profSchedule.length === 0 ? (
                    <div className="text-xs text-muted">No scheduled classes recorded for today.</div>
                  ) : (
                    <div className="space-y-1">
                      {periods.map(p => {
                        const classInP = profSchedule.find(occ => occ.period === p.index);
                        const rName = classInP ? (rooms.find(r => r.id === classInP.roomId)?.short || classInP.roomId) : null;
                        return (
                          <div
                            key={p.index}
                            className={`flex items-center justify-between p-1.5 text-xs border ${
                              p.index === currentPeriod
                                ? 'bg-board-case border-signal'
                                : 'bg-page-bg border-hairline'
                            }`}
                          >
                            <span className="text-muted tabular-nums">
                              P{p.index} ({p.start})
                            </span>
                            {classInP ? (
                              <span className="font-bold text-cell-ink truncate max-w-[220px]">
                                {rName} [{classInP.batchNames.join(', ')}]
                              </span>
                            ) : (
                              <span className="text-muted/60 uppercase text-[10px]">FREE</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Room Suggestions */}
              {query && (
                <div className="mb-3">
                  <div className="text-[11px] text-muted uppercase mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
                    <span>MATCHING ROOMS:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filteredRooms.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(r.id);
                          setQuery('');
                        }}
                        title={r.name}
                        className={`px-2 py-1 text-xs border transition-colors ${
                          selectedRoomId === r.id
                            ? 'bg-board-case border-signal text-cell-ink font-bold'
                            : 'bg-cell-bg border-hairline text-muted hover:text-cell-ink'
                        }`}
                      >
                        {r.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Room Info */}
              {selectedRoom && (
                <div className="p-3 bg-cell-bg border border-hairline">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted uppercase">ROOM PROFILE</div>
                      <div className="text-base font-bold text-cell-ink mt-0.5">{selectedRoom.name}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-board-case text-xs text-muted border border-hairline uppercase">
                      {selectedRoom.building} | FLOOR {selectedRoom.floor ?? '—'}
                    </span>
                  </div>

                  {/* Right Now Status */}
                  <div className="mt-2.5 pt-2 border-t border-hairline">
                    <div className="text-[11px] text-muted uppercase">STATUS (PERIOD {currentPeriod}):</div>
                    {currentRoomClass ? (
                      <div className="mt-1 text-xs">
                        <span className="inline-block px-1.5 py-0.5 bg-board-case text-unlit font-bold mr-1.5 border border-hairline uppercase">
                          OCCUPIED
                        </span>
                        <span className="font-semibold text-cell-ink">
                          {currentRoomClass.batchNames.join(', ')}
                        </span>
                        <span className="text-muted">
                          {' '}[{currentRoomClass.subjectCode || currentRoomClass.subjectName}]
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-signal flex items-center gap-1.5 font-bold uppercase">
                        <span className="w-2 h-2 bg-signal shrink-0" aria-hidden="true" />
                        VACANT NOW
                      </div>
                    )}
                  </div>

                  {/* Day breakdown */}
                  <div className="mt-3 pt-2 border-t border-hairline">
                    <div className="text-[11px] text-muted uppercase mb-1.5">TODAY SCHEDULE:</div>
                    <div className="space-y-1">
                      {periods.map(p => {
                        const classInP = roomSchedule.find(occ => occ.period === p.index);
                        return (
                          <div
                            key={p.index}
                            className={`flex items-center justify-between p-1.5 text-xs border ${
                              p.index === currentPeriod
                                ? 'bg-board-case border-signal'
                                : 'bg-page-bg border-hairline'
                            }`}
                          >
                            <span className="text-muted tabular-nums">
                              P{p.index} ({p.start}–{p.end})
                            </span>
                            {classInP ? (
                              <span className="font-semibold text-cell-ink truncate max-w-[220px]">
                                {classInP.batchNames.join(', ')} ({classInP.teacherNames[0] || 'Faculty'})
                              </span>
                            ) : (
                              <span className="text-signal font-bold text-[11px] uppercase">VACANT</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

