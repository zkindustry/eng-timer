import React, { useState, useMemo } from 'react';
import {
    CheckCircle2, Circle, MoreHorizontal, Calendar,
    User, Layers, GripVertical, Check, Folder,
    ChevronRight, ChevronDown, Play, Square, Pencil, Trash2, Archive, CheckSquare
} from 'lucide-react';

const TaskList = ({
    tasks,
    projects,
    onUpdateTask,
    onDeleteTask,
    onEditTask,
    onStartTimer,
    onStopTimer,
    activeLog
}) => {
    const [groupBy, setGroupBy] = useState('project'); // 'project' | 'status' | 'none'
    const [filter, setFilter] = useState('');
    const [expandedGroups, setExpandedGroups] = useState([]); // Array of group keys
    const [viewComplete, setViewComplete] = useState(false); // false = Active, true = Completed

    const getProjectName = (id) => {
        const p = projects.find(x => x.id === id);
        return p ? p.name : 'Unknown Project';
    };

    const getProjectColor = (id) => {
        const p = projects.find(x => x.id === id);
        return p ? (p.color || '#cbd5e1') : '#cbd5e1';
    };

    // Grouping Logic
    const groups = useMemo(() => {
        let filtered = tasks.filter(t => t.title.toLowerCase().includes(filter.toLowerCase()));

        // Filter by Completion Status
        filtered = filtered.filter(t => {
            const isDone = ['Done', 'Completed'].includes(t.statusNormalized || t.status);
            return viewComplete ? isDone : !isDone;
        });

        if (groupBy === 'none') return { 'All Tasks': filtered };

        return filtered.reduce((groups, task) => {
            let key = 'Other';
            if (groupBy === 'project') {
                key = getProjectName(task.projectId || (task.projectIds?.[0]) || '__other');
            } else if (groupBy === 'status') {
                key = task.status || 'To Do';
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(task);
            return groups;
        }, {});
    }, [tasks, filter, groupBy, projects, viewComplete]);

    const toggleGroup = (key) => {
        setExpandedGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const expandAll = () => setExpandedGroups(Object.keys(groups));
    const collapseAll = () => setExpandedGroups([]);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Controls */}
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                        {['project', 'status', 'none'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => { setGroupBy(mode); setExpandedGroups([]); }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${groupBy === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setViewComplete(!viewComplete)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${viewComplete
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                            }`}
                    >
                        {viewComplete ? <CheckSquare size={14} /> : <Archive size={14} />}
                        {viewComplete ? 'Viewing Completed' : 'View Completed'}
                    </button>
                    <div className="text-slate-400 text-xs font-mono">
                        {Object.values(groups).reduce((acc, list) => acc + list.length, 0)} tasks
                    </div>
                </div>
            </div>

            {/* Modern List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
                {Object.entries(groups).map(([groupName, groupTasks]) => {
                    const isExpanded = groupBy === 'none' || expandedGroups.includes(groupName);

                    return (
                        <div key={groupName} className="border-b border-slate-50 last:border-0">
                            {/* Group Header */}
                            {groupBy !== 'none' && (
                                <div
                                    className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => toggleGroup(groupName)}
                                >
                                    <span className="text-slate-400">
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                    {groupBy === 'project' ? <Folder size={14} className="text-blue-500" /> : <Layers size={14} className="text-purple-500" />}
                                    <span className="flex-1">{groupName}</span>
                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-mono">{groupTasks.length}</span>
                                </div>
                            )}

                            {/* Tasks in Group - Accordion Body */}
                            {(isExpanded || groupBy === 'none') && (
                                <div className="divide-y divide-slate-50 animate-slide-down">
                                    {groupTasks.map(task => {
                                        const isDone = ['Done', 'Completed'].includes(task.statusNormalized || task.status);
                                        const projColor = getProjectColor(task.projectId || task.projectIds?.[0]);
                                        // Use Task Color if present, else Project Color
                                        const displayColor = task.color || projColor;

                                        const isActive = activeLog?.taskId === task.id;

                                        return (
                                            <div key={task.id} className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors pl-10 ${isActive ? 'bg-blue-50/50' : ''}`}>
                                                {/* Status Toggle */}
                                                <button
                                                    onClick={() => onUpdateTask(task, { status: isDone ? 'To Do' : 'Done' })}
                                                    className={`shrink-0 transition-colors ${isDone ? 'text-green-500' : 'text-slate-300 hover:text-purple-500'}`}
                                                >
                                                    {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                                </button>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm truncate font-medium ${isDone ? 'text-slate-400 line-through' : isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                                                            {task.title}
                                                        </span>
                                                        {task.priority && (
                                                            <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${task.priority === 'High' ? 'bg-red-50 text-red-600' :
                                                                task.priority === 'Medium' ? 'bg-orange-50 text-orange-600' :
                                                                    'bg-blue-50 text-blue-600'
                                                                }`}>
                                                                {task.priority}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {groupBy !== 'project' && (
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: displayColor }} />
                                                            <span className="text-[10px] text-slate-400 truncate">
                                                                {getProjectName(task.projectId || task.projectIds?.[0])}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions (Appear on Hover) */}
                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    {/* Timer Action */}
                                                    {!isDone && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); isActive ? onStopTimer() : onStartTimer(task); }}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isActive
                                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                                : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200'
                                                                }`}
                                                            title={isActive ? "Stop Timer" : "Start Timer"}
                                                        >
                                                            {isActive ? <Square size={12} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => onEditTask(task)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg hidden md:block" // Hidden on mobile, maybe use long press or single simplified edit? Actually keeping it simplifies dev.
                                                        title="Edit Task"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    {/* Mobile Edit Trigger */}
                                                    <button onClick={() => onEditTask(task)} className="md:hidden p-1.5 text-slate-400">
                                                        <MoreHorizontal size={16} />
                                                    </button>

                                                    <button
                                                        onClick={() => onDeleteTask(task)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg hidden md:block"
                                                        title="Delete Task"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {Object.keys(groups).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <div className="text-4xl mb-4 text-slate-200">{viewComplete ? '🗃️' : '✓'}</div>
                        <p>{viewComplete ? 'No completed tasks found.' : 'All caught up! No tasks.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskList;
