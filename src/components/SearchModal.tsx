import React, { useState, useMemo } from 'react';
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

  // Auto-select first room or EB 305 if available
  useMemo(() => {
    if (!selectedRoomId && rooms.length > 0) {
      const eb305 = rooms.find(r => r.name.includes('305'));
      setSelectedRoomId(eb305 ? eb305.id : rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  if (!isOpen) return null;

  // Filtered professors list
  const filteredProfs = allProfessors
    .filter(p => p.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15);

  // Filtered rooms list
  const filteredRooms = rooms
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
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

  // Professor current period status
  const currentProfClass = profSchedule.find(occ => occ.period === currentPeriod);
  const currentRoomClass = roomSchedule.find(occ => occ.period === currentPeriod);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-mobile bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border bg-surface-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('professors');
                setQuery('');
              }}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-colors ${
                activeTab === 'professors'
                  ? 'bg-ink text-text border border-border'
                  : 'text-muted hover:text-text'
              }`}
            >
              Professors
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('rooms');
                setQuery('');
              }}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-colors ${
                activeTab === 'rooms'
                  ? 'bg-ink text-text border border-border'
                  : 'text-muted hover:text-text'
              }`}
            >
              Room Schedules
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink text-muted hover:text-text text-sm font-mono"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border bg-ink">
          <input
            type="text"
            placeholder={
              activeTab === 'professors'
                ? 'Search professor (e.g. Vikas Singh, AV)...'
                : 'Search room (e.g. EB 305, Dell Lab)...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface border border-border font-mono text-xs text-text placeholder:text-muted focus:outline-none focus:border-brand"
            autoFocus
          />
        </div>

        {/* Modal Body */}
        <div className="p-3 overflow-y-auto space-y-3">
          {activeTab === 'professors' ? (
            <div>
              {/* Professor Suggestions */}
              {query && (
                <div className="mb-3">
                  <div className="text-[11px] font-mono text-muted uppercase mb-1">Matches:</div>
                  <div className="flex flex-wrap gap-1">
                    {filteredProfs.map(prof => (
                      <button
                        key={prof}
                        type="button"
                        onClick={() => {
                          setSelectedProf(prof);
                          setQuery('');
                        }}
                        className={`px-2 py-1 rounded font-mono text-xs border ${
                          selectedProf === prof
                            ? 'bg-brand/20 border-brand text-text font-bold'
                            : 'bg-surface-2 border-border text-muted hover:text-text'
                        }`}
                      >
                        {prof}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Professor Info */}
              <div className="p-3 rounded bg-surface-2 border border-border">
                <div className="text-xs font-mono text-muted">FACULTY MEMBER</div>
                <div className="text-base font-bold font-mono text-text mt-0.5">{selectedProf}</div>

                {/* Right Now Status */}
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="text-[11px] font-mono text-muted uppercase">Right Now (Period {currentPeriod}):</div>
                  {currentProfClass ? (
                    <div className="mt-1 font-mono text-xs">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-soon/20 text-soon font-bold mr-1.5 border border-soon/40">
                        In Class
                      </span>
                      <span className="font-bold text-text">
                        {rooms.find(r => r.id === currentProfClass.roomId)?.name || currentProfClass.roomId}
                      </span>
                      <span className="text-muted">
                        {' '}· {currentProfClass.subjectName || currentProfClass.subjectCode} ({currentProfClass.batchNames.join(', ')})
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 font-mono text-xs text-free flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-free" />
                      Free / No scheduled class in Period {currentPeriod}
                    </div>
                  )}
                </div>

                {/* Today's Schedule */}
                <div className="mt-3 pt-2 border-t border-border">
                  <div className="text-[11px] font-mono text-muted uppercase mb-1.5">Today&apos;s Schedule:</div>
                  {profSchedule.length === 0 ? (
                    <div className="text-xs font-mono text-muted">No classes scheduled today.</div>
                  ) : (
                    <div className="space-y-1">
                      {periods.map(p => {
                        const classInP = profSchedule.find(occ => occ.period === p.index);
                        const rName = classInP ? rooms.find(r => r.id === classInP.roomId)?.name : null;
                        return (
                          <div
                            key={p.index}
                            className={`flex items-center justify-between p-1.5 rounded font-mono text-xs ${
                              p.index === currentPeriod
                                ? 'bg-ink border border-border'
                                : 'bg-surface/50'
                            }`}
                          >
                            <span className="text-muted tabular-nums">
                              P{p.index} ({p.start})
                            </span>
                            {classInP ? (
                              <span className="font-bold text-text truncate max-w-[200px]">
                                {rName} · {classInP.batchNames.join(', ')}
                              </span>
                            ) : (
                              <span className="text-muted italic text-[11px]">Free</span>
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
                  <div className="text-[11px] font-mono text-muted uppercase mb-1">Matches:</div>
                  <div className="flex flex-wrap gap-1">
                    {filteredRooms.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(r.id);
                          setQuery('');
                        }}
                        className={`px-2 py-1 rounded font-mono text-xs border ${
                          selectedRoomId === r.id
                            ? 'bg-brand/20 border-brand text-text font-bold'
                            : 'bg-surface-2 border-border text-muted hover:text-text'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Room Info */}
              {selectedRoom && (
                <div className="p-3 rounded bg-surface-2 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono text-muted">CLASSROOM</div>
                      <div className="text-base font-bold font-mono text-text mt-0.5">{selectedRoom.name}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-ink text-xs font-mono text-muted border border-border">
                      {selectedRoom.building} · Floor {selectedRoom.floor ?? '—'}
                    </span>
                  </div>

                  {/* Right Now Status */}
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-[11px] font-mono text-muted uppercase">Period {currentPeriod}:</div>
                    {currentRoomClass ? (
                      <div className="mt-1 font-mono text-xs">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-busy/40 text-text font-bold mr-1.5 border border-busy">
                          Occupied
                        </span>
                        <span className="font-semibold text-text">
                          {currentRoomClass.batchNames.join(', ')}
                        </span>
                        <span className="text-muted">
                          {' '}· {currentRoomClass.subjectCode || currentRoomClass.subjectName}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 font-mono text-xs text-free flex items-center gap-1.5 font-bold">
                        <span className="w-2 h-2 rounded-full bg-free" />
                        Vacant
                      </div>
                    )}
                  </div>

                  {/* Day breakdown */}
                  <div className="mt-3 pt-2 border-t border-border">
                    <div className="text-[11px] font-mono text-muted uppercase mb-1.5">Today&apos;s Schedule:</div>
                    <div className="space-y-1">
                      {periods.map(p => {
                        const classInP = roomSchedule.find(occ => occ.period === p.index);
                        return (
                          <div
                            key={p.index}
                            className={`flex items-center justify-between p-1.5 rounded font-mono text-xs ${
                              p.index === currentPeriod
                                ? 'bg-ink border border-border'
                                : 'bg-surface/50'
                            }`}
                          >
                            <span className="text-muted tabular-nums">
                              P{p.index} ({p.start}–{p.end})
                            </span>
                            {classInP ? (
                              <span className="font-semibold text-text truncate max-w-[200px]">
                                {classInP.batchNames.join(', ')} ({classInP.teacherNames[0] || 'Faculty'})
                              </span>
                            ) : (
                              <span className="text-free font-bold text-[11px]">VACANT</span>
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
