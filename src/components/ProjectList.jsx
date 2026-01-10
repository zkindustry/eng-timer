import React, { useState, useMemo } from 'react';
import {
    Play, Square, Pencil, Trash2, Database, Search,
    MoreHorizontal, ChevronDown, LayoutGrid, List as ListIcon,
    ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

const ProjectList = ({
    projects,
    activeLog,
    onStartTimer,
    onStopTimer,
    onEditProject,
    onDeleteProject,
    onUpdateProject
}) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
    const [groupBy, setGroupBy] = useState('status'); // 'status' | 'category'
    const [selectedIds, setSelectedIds] = useState([]);
    const [hoverId, setHoverId] = useState(null);
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Sorting & Filtering
    const sortedProjects = useMemo(() => {
        let data = [...projects];
        // Filter
        if (filter) {
            data = data.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
        }
        // Sort
        data.sort((a, b) => {
            let aVal = a[sortConfig.key] || '';
            let bVal = b[sortConfig.key] || '';

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return data;
    }, [projects, filter, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sortedProjects.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sortedProjects.map(p => p.id));
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-140px)] overflow-hidden">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50/50 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-slate-700">Projects</h2>
                    <div className="flex bg-slate-200 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                        >
                            <ListIcon size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                    {viewMode === 'board' && (
                        <div className="flex bg-slate-200 rounded-lg p-1 text-xs font-bold">
                            <button onClick={() => setGroupBy('status')} className={`px-2 py-1 rounded transition-all ${groupBy === 'status' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Status</button>
                            <button onClick={() => setGroupBy('category')} className={`px-2 py-1 rounded transition-all ${groupBy === 'category' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Category</button>
                        </div>
                    )}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            className="pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all w-48 md:w-64"
                            placeholder="Search..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <span className="text-xs font-bold text-slate-500">{selectedIds.length} selected</span>
                            <button
                                onClick={() => {
                                    // This assumes parent has a bulk delete or we iterate.
                                    // For now, let's just use the single delete for each (not ideal but safe).
                                    // Ideally pass a onBulkDelete prop.
                                    if (confirm(`Delete ${selectedIds.length} projects?`)) {
                                        selectedIds.forEach(id => {
                                            const p = projects.find(x => x.id === id);
                                            if (p) onDeleteProject(p);
                                        });
                                        setSelectedIds([]);
                                    }
                                }}
                                className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100 hover:bg-red-100"
                            >
                                Delete Selected
                            </button>
                        </div>
                    )}
                    <div className="text-sm text-slate-500">
                        {sortedProjects.length} projects
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'list' ? (
                <>
                    {/* List Header */}
                    <div className="grid grid-cols-[40px_1fr_120px_150px_100px] gap-4 px-6 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider relative">
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={selectedIds.length === sortedProjects.length && sortedProjects.length > 0}
                                onChange={toggleSelectAll}
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                        </div>

                        <SortableHeader label="Project Name" sortKey="name" currentConfig={sortConfig} onSort={handleSort} />
                        <SortableHeader label="Status" sortKey="statusNormalized" currentConfig={sortConfig} onSort={handleSort} />
                        <SortableHeader label="Category" sortKey="category" currentConfig={sortConfig} onSort={handleSort} />
                        <div className="text-slate-400">Source</div>
                    </div>

                    {/* List Rows */}
                    <div className="overflow-y-auto flex-1">
                        {sortedProjects.map(project => {
                            const isActive = activeLog?.projectId === project.id;

                            return (
                                <div
                                    key={project.id}
                                    className={`group grid grid-cols-[40px_1fr_120px_150px_100px] gap-4 px-6 py-3 border-b border-slate-50 hover:bg-slate-50/80 transition-colors items-center relative ${isActive ? 'bg-purple-50/50' : ''}`}
                                    onMouseEnter={() => setHoverId(project.id)}
                                    onMouseLeave={() => setHoverId(null)}
                                >
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(project.id)}
                                            onChange={() => toggleSelect(project.id)}
                                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                        />
                                    </div>

                                    <div className="font-medium text-slate-800 flex items-center gap-2 relative">
                                        <div
                                            className={`w-3 h-3 rounded-full shrink-0`}
                                            style={{ backgroundColor: project.color || '#cbd5e1' }}
                                        />
                                        <span className="truncate">{project.name}</span>
                                        {project.isOtherBucket && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded">Default</span>}
                                    </div>

                                    <div>
                                        <button
                                            className={`text-[10px] px-2 py-1 rounded-full border truncate max-w-[100px] ${project.statusNormalized === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                project.statusNormalized === 'Done' ? 'bg-green-50 text-green-600 border-green-100' :
                                                    'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}
                                            onClick={() => onUpdateProject && onUpdateProject(project, { status: cycleStatus(project.status) })}
                                        >
                                            {project.statusNormalized || 'To Do'}
                                        </button>
                                    </div>

                                    <div className="text-sm text-slate-500 truncate">
                                        {project.category || '-'}
                                    </div>

                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                        {project.notionId ? <><Database size={12} className="text-purple-500" /> Notion</> : 'Local'}
                                    </div>

                                    {/* Floating Action Overlay (Right Side) */}
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white/90 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none p-1 sm:p-0 rounded-lg shadow-sm sm:shadow-none border sm:border-none border-slate-100">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); isActive ? onStopTimer() : onStartTimer(project); }}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${isActive
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                                }`}
                                            title={isActive ? "Stop Timer" : "Start Timer"}
                                        >
                                            {isActive ? <Square size={12} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                                        </button>

                                        <button onClick={() => onEditProject(project)} className="p-2 text-slate-400 hover:text-slate-700 transition-colors bg-white border border-slate-200 rounded-full hover:bg-slate-50">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => onDeleteProject(project)} className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-white border border-slate-200 rounded-full hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedProjects.length === 0 && <EmptyState />}
                    </div>
                </>
            ) : (
                <KanbanView
                    projects={sortedProjects}
                    activeLog={activeLog}
                    groupBy={groupBy}
                    {...{ onStartTimer, onStopTimer, onEditProject, onDeleteProject, onUpdateProject }}
                />
            )}
        </div>
    );
};

// Sub-components
const SortableHeader = ({ label, sortKey, currentConfig, onSort }) => (
    <div
        className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors select-none"
        onClick={() => onSort(sortKey)}
    >
        {label}
        {currentConfig.key === sortKey ? (
            currentConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
            <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50" />
        )}
    </div>
);

const KanbanView = ({ projects, activeLog, groupBy, onStartTimer, onStopTimer, onEditProject, onDeleteProject, onUpdateProject }) => {
    // Dynamic Grouping
    const columns = useMemo(() => {
        if (groupBy === 'status') return ['To Do', 'In Progress', 'Done'];
        // For category, extract unique categories
        const cats = [...new Set(projects.map(p => p.category || 'General'))].sort();
        return cats.length ? cats : ['General'];
    }, [projects, groupBy]);

    const getGroupItems = (col) => {
        return projects.filter(p => {
            if (groupBy === 'status') return (p.statusNormalized || 'To Do') === col;
            return (p.category || 'General') === col;
        });
    };

    return (
        <div className="flex gap-4 p-4 overflow-x-auto h-full bg-slate-50/50">
            {columns.map(col => (
                <div key={col} className="flex-shrink-0 w-80 flex flex-col">
                    <div className="font-bold text-slate-500 mb-3 px-2 flex justify-between items-center text-sm uppercase tracking-wider">
                        <span>{col}</span>
                        <span className="bg-slate-200 px-2 py-0.5 rounded-full text-xs font-mono">
                            {getGroupItems(col).length}
                        </span>
                    </div>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2 pb-20">
                        {getGroupItems(col).map(project => {
                            const isActive = activeLog?.projectId === project.id;
                            return (
                                <div
                                    key={project.id}
                                    className={`bg-white p-4 rounded-xl border transition-all relative group ${isActive ? 'border-purple-300 shadow-purple-100 ring-1 ring-purple-100' : 'border-slate-200 shadow-sm hover:shadow-md'}`}
                                >
                                    {/* Color Line */}
                                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: project.color || '#cbd5e1' }} />

                                    <div className="pl-3 mb-2">
                                        <div className="font-bold text-slate-800 text-sm mb-1">{project.name}</div>
                                        <div className="text-xs text-slate-500">{project.category || 'General'}</div>
                                    </div>

                                    <div className="pl-3 flex items-center justify-between mt-3 border-t border-slate-50 pt-2">
                                        <div className="flex gap-1">
                                            {groupBy !== 'status' && (
                                                <button onClick={() => onUpdateProject(project, { status: cycleStatus(project.status) })} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors">
                                                    {project.statusNormalized || 'To Do'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEditProject(project)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil size={12} /></button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); isActive ? onStopTimer() : onStartTimer(project); }}
                                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                                            >
                                                {isActive ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <div className="text-4xl mb-4">📂</div>
        <p>No projects found.</p>
    </div>
);

const cycleStatus = (current) => {
    if (['Done', 'Completed'].includes(current)) return 'To Do';
    if (['To Do', 'Planned'].includes(current)) return 'In Progress';
    return 'Done';
};

export default ProjectList;
