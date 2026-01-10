import React, { useEffect, useState } from 'react';
import { Square, Tag, StickyNote, MoreHorizontal, Link } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';

const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ActiveTimer = ({ activeLog, onStop, onAddTag, onAddNote, projects }) => {
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (!activeLog) return;
        const interval = setInterval(() => {
            const start = activeLog.startTime?.toDate ? activeLog.startTime.toDate() : new Date(activeLog.startTime);
            const diff = differenceInSeconds(new Date(), start);
            setDuration(diff > 0 ? diff : 0);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeLog]);

    if (!activeLog) return null;

    const project = projects.find(p => p.id === activeLog.projectId) || {};

    return (
        <div className="fixed bottom-0 left-0 w-full md:pl-64 z-40 animate-slide-up">
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center shadow-2xl mx-4 mb-4 rounded-xl border border-slate-800/50 backdrop-blur-md bg-slate-900/95">

                {/* Project & Task Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 shrink-0">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color || '#cbd5e1' }} />
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{activeLog.title || '(No Task)'}</div>
                        <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                            <span className="font-medium text-slate-300">{project.name || 'Unknown Project'}</span>
                            {activeLog.tags && activeLog.tags.length > 0 && (
                                <>
                                    <span className="text-slate-600">•</span>
                                    <div className="flex gap-1">
                                        {activeLog.tags.map(t => (
                                            <span key={t} className="bg-slate-800 px-1.5 rounded text-[10px] text-slate-300">{t}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Timer & Actions */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="font-mono text-xl md:text-2xl font-bold tabular-nums tracking-wider text-blue-400">
                        {formatDuration(duration)}
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={onAddTag} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors" title="Add Tags">
                            <Tag size={18} />
                        </button>
                        <button onClick={onStop} className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/20 transition-all transform hover:scale-105">
                            <Square size={16} fill="currentColor" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ActiveTimer;
