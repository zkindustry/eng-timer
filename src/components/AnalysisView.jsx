import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
    Clock, Zap, TrendingUp, Tag, Calendar as CalendarIcon, Layers, ChevronLeft, ChevronRight,
    Plus, Filter, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, isSameDay, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

const AnalysisView = ({ logs, projects, tasks, onManualAddLog }) => {
    const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'timeline'
    const [rangeType, setRangeType] = useState('week'); // 'day', 'week', 'month', 'year'
    const [anchorDate, setAnchorDate] = useState(new Date());

    // Manual Log State
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualForm, setManualForm] = useState({ start: '', end: '', projectId: '', notes: '' });

    // --- Date Logic ---
    const dateRange = useMemo(() => {
        const now = anchorDate;
        switch (rangeType) {
            case 'day': return { start: startOfDay(now), end: endOfDay(now), label: format(now, 'yyyy-MM-dd') };
            case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: `Week of ${format(startOfWeek(now, { weekStartsOn: 1 }), 'MMM d')}` };
            case 'month': return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'yyyy MMM') };
            case 'year': return { start: startOfYear(now), end: endOfYear(now), label: format(now, 'yyyy') };
            default: return { start: startOfDay(now), end: endOfDay(now) };
        }
    }, [rangeType, anchorDate]);

    const shiftDate = (dir) => {
        const d = anchorDate;
        if (rangeType === 'day') setAnchorDate(dir > 0 ? addDays(d, 1) : subDays(d, 1));
        if (rangeType === 'week') setAnchorDate(dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
        if (rangeType === 'month') setAnchorDate(dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
        if (rangeType === 'year') setAnchorDate(dir > 0 ? addYears(d, 1) : subYears(d, 1));
    };

    // --- Data Processing ---
    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            if (!l.startTime || !l.endTime) return false;
            return l.startTime >= dateRange.start && l.startTime <= dateRange.end;
        });
    }, [logs, dateRange]);

    const stats = useMemo(() => {
        const totalMin = filteredLogs.reduce((acc, l) => acc + (l.endTime - l.startTime) / 60000, 0);
        const totalHours = (totalMin / 60).toFixed(1);

        // Project Breakdown
        const projMap = {};
        filteredLogs.forEach(l => {
            const min = (l.endTime - l.startTime) / 60000;
            const name = l.projectName || 'Unknown';
            projMap[name] = (projMap[name] || 0) + min;
        });
        const projectData = Object.entries(projMap)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);

        // Task Breakdown (Top 5)
        const taskMap = {};
        filteredLogs.forEach(l => {
            if (l.taskTitle) {
                const min = (l.endTime - l.startTime) / 60000;
                taskMap[l.taskTitle] = (taskMap[l.taskTitle] || 0) + min;
            }
        });
        const taskData = Object.entries(taskMap)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Trend Data
        let trendData = [];
        if (rangeType === 'day') {
            // Hourly distribution
            const hours = Array(24).fill(0);
            filteredLogs.forEach(l => {
                const h = l.startTime.getHours();
                hours[h] += (l.endTime - l.startTime) / 60000;
            });
            trendData = hours.map((min, h) => ({ label: `${h}:00`, value: Math.round(min) }));
        } else {
            // Daily distribution
            const map = {};
            filteredLogs.forEach(l => {
                const key = format(l.startTime, 'MMM dd');
                map[key] = (map[key] || 0) + (l.endTime - l.startTime) / 60000 / 60; // Hours
            });
            // Fill gaps
            if (rangeType === 'week') {
                const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
                trendData = days.map(d => ({ label: format(d, 'EEE'), value: parseFloat((map[format(d, 'MMM dd')] || 0).toFixed(1)) }));
            } else {
                trendData = Object.entries(map).map(([k, v]) => ({ label: k, value: parseFloat(v.toFixed(1)) }));
            }
        }

        return { totalHours, projectData, taskData, trendData };
    }, [filteredLogs, rangeType, dateRange]);

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualForm.start || !manualForm.end || !manualForm.projectId) return;

        const start = new Date(`${format(anchorDate, 'yyyy-MM-dd')}T${manualForm.start}`); // Simple date Mapping
        const end = new Date(`${format(anchorDate, 'yyyy-MM-dd')}T${manualForm.end}`); // Simple date Mapping

        if (end <= start) {
            alert('End time must be after start time');
            return;
        }

        await onManualAddLog({
            projectId: manualForm.projectId,
            startTime: start,
            endTime: end,
            notes: manualForm.notes
        });
        setShowManualForm(false);
        setManualForm({ start: '', end: '', projectId: '', notes: '' });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    {['dashboard', 'timeline'].map(m => (
                        <button
                            key={m}
                            onClick={() => setViewMode(m)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all flex items-center gap-2 ${viewMode === m ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {m === 'dashboard' ? <PieChartIcon size={14} /> : <CalendarIcon size={14} />}
                            {m}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                    <button onClick={() => shiftDate(-1)} className="p-1 hover:bg-slate-200 rounded"><ChevronLeft size={16} /></button>
                    <span className="font-mono font-bold text-sm min-w-[120px] text-center">{dateRange.label}</span>
                    <button onClick={() => shiftDate(1)} className="p-1 hover:bg-slate-200 rounded"><ChevronRight size={16} /></button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['day', 'week', 'month', 'year'].map(r => (
                        <button
                            key={r}
                            onClick={() => setRangeType(r)}
                            className={`px-3 py-1 text-xs font-bold uppercase rounded transition-all ${rangeType === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dashboard View */}
            {viewMode === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in flex-1 overflow-y-auto pb-10">
                    {/* Summary Cards */}
                    <div className="col-span-1 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KPICard title="Total Focus" value={`${stats.totalHours}`} unit="hrs" icon={<Clock size={20} />} color="blue" />
                        <KPICard title="Projects Active" value={stats.projectData.length} unit="" icon={<Layers size={20} />} color="purple" />
                        <KPICard title="Tasks Worked" value={stats.taskData.length} unit="" icon={<Activity size={20} />} color="green" />
                        <KPICard title="Daily Avg" value={(stats.totalHours / (rangeType === 'day' ? 1 : 7)).toFixed(1)} unit="hrs" icon={<TrendingUp size={20} />} color="orange" />
                    </div>

                    {/* Main Charts */}
                    <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><PieChartIcon size={16} /> Project Distribution</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.projectData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                        {stats.projectData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Focus Trend ({rangeType === 'day' ? 'Min' : 'Hours'})</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                    <YAxis />
                                    <RechartsTooltip />
                                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Activity size={16} /> Top Tasks</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.taskData} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline View */}
            {viewMode === 'timeline' && (
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-fade-in relative">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-700">Timeline / List</h3>
                        <button onClick={() => setShowManualForm(!showManualForm)} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-700 transition">
                            <Plus size={14} /> Add Manual Log
                        </button>
                    </div>

                    {/* Manual Entry Form */}
                    {showManualForm && (
                        <form onSubmit={handleManualSubmit} className="p-4 bg-blue-50 border-b border-blue-100 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-blue-800">Start Time</label>
                                <input type="time" className="input-sm w-full" value={manualForm.start} onChange={e => setManualForm({ ...manualForm, start: e.target.value })} required />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-blue-800">End Time</label>
                                <input type="time" className="input-sm w-full" value={manualForm.end} onChange={e => setManualForm({ ...manualForm, end: e.target.value })} required />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold uppercase text-blue-800">Project</label>
                                <select className="input-sm w-full" value={manualForm.projectId} onChange={e => setManualForm({ ...manualForm, projectId: e.target.value })} required>
                                    <option value="">Select Project...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white h-9 rounded-lg font-bold text-xs" >Add Log</button>
                        </form>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {filteredLogs.length === 0 ? (
                            <div className="text-center text-slate-400 py-12">No logs found for this period.</div>
                        ) : (
                            filteredLogs.sort((a, b) => b.startTime - a.startTime).map(log => (
                                <div key={log.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 border border-slate-100 rounded-xl group transition-all">
                                    <div className="w-1.5 h-12 rounded-full hidden md:block" style={{ backgroundColor: projects.find(p => p.id === log.projectId)?.color || '#e2e8f0' }}></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-700 truncate">{log.projectName}</span>
                                            {log.taskTitle && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded truncate max-w-[150px]">{log.taskTitle}</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                            {format(log.startTime, 'HH:mm')} - {log.endTime ? format(log.endTime, 'HH:mm') : 'Now'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-800">
                                            {log.endTime ? ((log.endTime - log.startTime) / 60000).toFixed(0) : '...'} <span className="text-[10px] font-normal text-slate-400">min</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">{format(log.startTime, 'MMM dd')}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .input-sm { width: 100%; padding: 0.25rem 0.5rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; font-size: 0.875rem; outline: none; }
                .input-sm:focus { border-color: #3b82f6; ring: 2px; }
            `}</style>
        </div>
    );
};

const KPICard = ({ title, value, unit, icon, color }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 bg-${color}-50 text-${color}-600 rounded-xl`}>{icon}</div>
        <div>
            <div className="text-xs text-slate-500 font-bold uppercase">{title}</div>
            <div className="text-2xl font-bold text-slate-800">{value} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
        </div>
    </div>
);

export default AnalysisView;
