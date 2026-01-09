import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Clock, Zap, TrendingUp, Tag, Calendar, Layers } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

const AnalysisView = ({ logs, projects }) => {
    const stats = useMemo(() => {
        const totalDurationMin = logs.reduce((acc, l) => {
            if (!l.endTime || !l.startTime) return acc;
            return acc + (l.endTime - l.startTime) / 1000 / 60;
        }, 0);
        const totalHours = (totalDurationMin / 60).toFixed(1);

        // Project Distribution
        const projMap = {};
        logs.forEach(l => {
            if (!l.endTime || !l.startTime) return;
            const dur = (l.endTime - l.startTime) / 1000 / 60;
            const name = l.projectName || 'Unknown';
            projMap[name] = (projMap[name] || 0) + dur;
        });
        const projectData = Object.entries(projMap)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);

        // Tag Distribution
        const tagMap = {};
        logs.forEach(l => {
            if (!l.endTime || !l.startTime) return;
            const dur = (l.endTime - l.startTime) / 1000 / 60;
            const tags = l.tags && l.tags.length ? l.tags : ['Untagged'];
            tags.forEach(t => {
                tagMap[t] = (tagMap[t] || 0) + dur;
            });
        });
        const tagData = Object.entries(tagMap)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);

        // Daily Trend (Last 7 Days)
        const daysMap = {};
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            daysMap[key] = 0;
        }
        logs.forEach(l => {
            if (!l.startTime || !l.endTime) return;
            // Use local date string key for simplicity or UTC
            // Assuming l.startTime is Date object
            const key = l.startTime.toISOString().split('T')[0]; // Simple UTC date
            if (daysMap[key] !== undefined) {
                const dur = (l.endTime - l.startTime) / 1000 / 60 / 60; // hours
                daysMap[key] += dur;
            }
        });
        const dailyData = Object.entries(daysMap).map(([date, hours]) => ({
            date: date.slice(5), // MM-DD
            hours: parseFloat(hours.toFixed(1))
        }));

        return { totalHours, projectData, tagData, dailyData };
    }, [logs]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock size={24} /></div>
                    <div>
                        <div className="text-sm text-slate-500 font-bold uppercase">Total Time</div>
                        <div className="text-2xl font-bold text-slate-800">{stats.totalHours} <span className="text-sm font-normal">hrs</span></div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Layers size={24} /></div>
                    <div>
                        <div className="text-sm text-slate-500 font-bold uppercase">Projects</div>
                        <div className="text-2xl font-bold text-slate-800">{stats.projectData.length}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Tag size={24} /></div>
                    <div>
                        <div className="text-sm text-slate-500 font-bold uppercase">Tags</div>
                        <div className="text-2xl font-bold text-slate-800">{stats.tagData.length}</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><TrendingUp size={24} /></div>
                    <div>
                        <div className="text-sm text-slate-500 font-bold uppercase">Avg Daily</div>
                        <div className="text-2xl font-bold text-slate-800">{(parseFloat(stats.totalHours) / 7).toFixed(1)} <span className="text-sm font-normal">hrs</span></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Trend */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Calendar size={18} /> Last 7 Days (Hours)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                <Tooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Layers size={18} /> Project Distribution (Minutes)</h3>
                    <div className="h-64 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.projectData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.projectData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tag Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                    <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Tag size={18} /> Tag Analysis (Minutes)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.tagData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#E2E8F0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
