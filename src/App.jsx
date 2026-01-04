import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  where
} from 'firebase/firestore';
import { 
  Play, Square, Clock, PieChart, Database, List, Briefcase, LogOut, KeyRound, AlertCircle, Zap, Plus, Calendar as CalendarIcon, BarChart3, ChevronRight, Trash2, FolderTree, FileText, ChevronDown, ChevronUp, Settings, X, GripVertical, AlertTriangle, Check, Search, Filter, RefreshCw, LayoutGrid, Table as TableIcon, Columns, ArrowRight, TrendingUp, Activity, MoreHorizontal, CalendarDays
} from 'lucide-react';

// --- 1. Firebase 配置 ---
let firebaseConfig;
let appId;

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} else {
  // 本地开发配置
  firebaseConfig = {
apiKey: "AIzaSyA4BIfAOxJqWzdzGPx900Zx2_IOQLn4-Bg",
  authDomain: "timer-4c74c.firebaseapp.com",
  projectId: "timer-4c74c",
  storageBucket: "timer-4c74c.firebasestorage.app",
  messagingSenderId: "234002025816",
  appId: "1:234002025816:web:849120987400bd095fa92d"
  };
  appId = 'eng-timer-production';
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. 邮箱/密码登录组件 ---
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <div className="flex justify-center mb-6 text-blue-600"><Zap size={32} fill="currentColor"/></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">EngTimer Pro</h1>
        <p className="text-sm text-slate-500 mb-8">工程项目与时间管理系统</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" required placeholder="邮箱 (Email)" className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" required placeholder="密码 (Password)" className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={e=>setPassword(e.target.value)} />
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50">
            {loading ? '处理中...' : (isRegister ? '注册并登录' : '登录')}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="mt-4 text-xs text-slate-400 hover:text-blue-500">
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </button>
      </div>
    </div>
  );
};

// --- 3. 主应用 ---
export default function TimeTrackerApp() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // 核心状态
  const [activeLog, setActiveLog] = useState(null);
  const [view, setView] = useState('projects'); // 'projects', 'calendar', 'dashboard'
  const [subView, setSubView] = useState('board'); // 'board', 'table' for projects
  const [searchQuery, setSearchQuery] = useState('');
  
  // 新建项目状态 (行内输入)
  const [newProjectTitle, setNewProjectTitle] = useState('');
  
  // Notion Config
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [notionConfig, setNotionConfig] = useState({
    dbId: '', titleProp: 'Name', statusProp: 'Status', categoryProp: 'Category', writeBackProp: 'TimeSpent', isRealMode: true
  });
  const [importLog, setImportLog] = useState('');

  // 1. Auth & Data Listeners
  useEffect(() => {
    const initAuth = async () => {
       if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
         try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e) {}
       }
    };
    initAuth();
    const sub = onAuthStateChanged(auth, u => setUser(u));
    return () => sub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const qP = query(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'));
    const subP = onSnapshot(qP, s => setProjects(s.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qL = query(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'));
    const subL = onSnapshot(qL, s => {
      const list = s.docs.map(d => ({id: d.id, ...d.data(), startTime: d.data().startTime?.toDate(), endTime: d.data().endTime?.toDate()}));
      setLogs(list.sort((a,b) => b.startTime - a.startTime));
      setActiveLog(list.find(l => !l.endTime) || null);
    });
    return () => { subP(); subL(); };
  }, [user]);

  // --- 动作逻辑 ---

  // 创建新项目 (支持同步到 Notion)
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    const title = newProjectTitle.trim();
    setNewProjectTitle(''); // 清空输入框

    try {
      let notionPageId = null;

      // 如果开启了真实模式且配置了DB ID，尝试在 Notion 创建
      if (notionConfig.isRealMode && notionConfig.dbId) {
         try {
           const res = await fetch('/.netlify/functions/notion-create', {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({
               databaseId: notionConfig.dbId,
               properties: {
                 [notionConfig.titleProp]: { title: [{ text: { content: title } }] },
                 [notionConfig.statusProp]: { select: { name: 'To Do' } }, // 默认状态
                 [notionConfig.categoryProp]: { select: { name: 'General' } } // 默认分类
               }
             })
           });
           if (res.ok) {
             const data = await res.json();
             notionPageId = data.id;
             showToast('已同步创建 Notion 页面', 'success');
           }
         } catch (err) {
           console.error("Notion create failed:", err);
           showToast('Notion 创建失败，仅保存本地', 'error');
         }
      }

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        name: title,
        status: 'To Do',
        category: 'General',
        notionId: notionPageId, // 关联 ID
        createdAt: serverTimestamp()
      });
    } catch (e) { alert(e.message); }
  };

  const toggleTimer = async (project) => {
    if (activeLog) {
      if (activeLog.projectId === project.id) { await stopTimer(); } 
      else { await stopTimer(); await startTimer(project); }
    } else {
      await startTimer(project);
    }
  };

  const startTimer = async (project) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), {
        projectId: project.id,
        projectName: project.name,
        category: project.category || 'Uncategorized',
        startTime: serverTimestamp(),
        endTime: null
      });
    } catch (e) { alert(e.message); }
  };

  const stopTimer = async () => {
    if (!activeLog) return;
    const endTime = new Date();
    const durationMin = ((endTime - activeLog.startTime) / 1000 / 60);

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), { endTime });
      const project = projects.find(p => p.id === activeLog.projectId);
      if (project?.notionId) {
        await syncToNotion(project.notionId, durationMin, project.name);
      }
    } catch (e) { console.error(e); }
  };

  // Notion 导入逻辑 (恢复并增强)
  const executeImport = async (e) => {
    e.preventDefault();
    setImportLog('连接中...');
    const { dbId, titleProp, statusProp, categoryProp, isRealMode } = notionConfig;

    if (!isRealMode) {
      // 模拟导入
      const mock = [
        { id: 'm1', [titleProp]: 'P-101 压缩机设计', [statusProp]: 'In Progress', [categoryProp]: 'Design' },
        { id: 'm2', [titleProp]: 'T-204 历史任务', [statusProp]: 'Done', [categoryProp]: 'Maintenance' },
      ];
      await processImport(mock);
    } else {
      try {
        const res = await fetch('/.netlify/functions/notion', {
          method: 'POST',
          body: JSON.stringify({ databaseId: dbId })
        });
        if (!res.ok) throw new Error("API连接失败");
        const data = await res.json();
        
        const parsed = data.results.map(p => {
           const props = p.properties;
           const title = props[titleProp]?.title?.[0]?.plain_text || 'Unknown';
           const status = props[statusProp]?.select?.name || props[statusProp]?.status?.name || 'To Do';
           const category = props[categoryProp]?.select?.name || props[categoryProp]?.multi_select?.[0]?.name || 'General';
           return { id: p.id, [titleProp]: title, [statusProp]: status, [categoryProp]: category };
        });
        
        await processImport(parsed);
      } catch (e) {
        setImportLog('错误: ' + e.message);
      }
    }
  };

  const processImport = async (items) => {
    let count = 0;
    let skipped = 0;
    const { titleProp, statusProp, categoryProp } = notionConfig;

    for (const item of items) {
      const status = item[statusProp] || '';
      // 过滤掉已完成的任务
      if (['Done', 'Completed', '已完成', 'Archived'].includes(status)) {
        skipped++;
        continue;
      }
      
      const name = item[titleProp];
      // 避免重复导入，如果 notionId 已存在则更新信息
      const existing = projects.find(p => p.notionId === item.id);
      if (!existing) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
          name, 
          notionId: item.id,
          status: status,
          category: item[categoryProp] || 'General',
          createdAt: serverTimestamp()
        });
        count++;
      } else {
        // 可选：更新本地状态以匹配 Notion
        // await updateDoc(doc(db, ...), { status, category }); 
      }
    }
    setImportLog(`同步完成: 新增 ${count} 个, 跳过(已完成) ${skipped} 个。`);
    setTimeout(() => { if(count>0) setConfigModalOpen(false); }, 1500);
  };

  const syncToNotion = async (pageId, durationAdd, name) => {
    if (!notionConfig.isRealMode) {
      showToast(`[模拟] ${name}: 更新 +${durationAdd.toFixed(1)}min`);
      return;
    }
    showToast(`正在同步 ${name}...`, 'loading');
    const endpoint = '/.netlify/functions/notion-update';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pageId, property: notionConfig.writeBackProp, value: durationAdd })
      });
      if (!res.ok) throw new Error("API Error");
      showToast(`同步成功!`, 'success');
    } catch (e) {
      showToast(`同步失败: ${e.message}`, 'error');
    }
  };

  const showToast = (msg, type='info') => {
    const el = document.createElement('div');
    const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';
    el.className = `fixed bottom-4 right-4 ${color} text-white px-4 py-3 rounded-lg shadow-xl z-[999] animate-fade-in text-sm font-bold flex items-center gap-2`;
    el.innerHTML = type === 'loading' ? `<span class="animate-spin">↻</span> ${msg}` : msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  // --- 过滤 ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [projects, searchQuery]);

  // --- 子组件: 看板视图 (Kanban) ---
  const KanbanBoard = () => {
    const statuses = ['To Do', 'In Progress', 'Done'];
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-220px)]">
        {statuses.map(status => (
          <div key={status} className="min-w-[280px] bg-slate-100/50 rounded-xl p-3 flex flex-col">
            <div className="font-bold text-slate-500 mb-3 px-2 flex justify-between">
              {status} <span className="bg-slate-200 px-2 rounded-full text-xs py-0.5">{filteredProjects.filter(p => (p.status || 'To Do') === status).length}</span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filteredProjects.filter(p => (p.status || 'To Do') === status).map(p => (
                <div key={p.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative">
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => {e.stopPropagation(); toggleTimer(p)}} className="p-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white">
                        {activeLog?.projectId === p.id ? <Square size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                      </button>
                   </div>
                   <div className="font-bold text-slate-700 text-sm mb-1">{p.name}</div>
                   <div className="flex gap-1 flex-wrap">
                     <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{p.category || 'General'}</span>
                     {p.notionId && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">Notion</span>}
                   </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- 子组件: 表格视图 (Table) ---
  const TableView = () => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[calc(100vh-220px)] overflow-y-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th className="p-4">项目名称</th>
            <th className="p-4">状态</th>
            <th className="p-4">分类</th>
            <th className="p-4">来源</th>
            <th className="p-4 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredProjects.map(p => (
            <tr key={p.id} className="hover:bg-slate-50 group">
              <td className="p-4 font-bold text-slate-700">{p.name}</td>
              <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{p.status || 'To Do'}</span></td>
              <td className="p-4 text-slate-500">{p.category || 'General'}</td>
              <td className="p-4 text-xs">
                {p.notionId ? <span className="flex items-center gap-1 text-purple-600"><Database size={12}/> Notion</span> : <span className="text-slate-400">Local</span>}
              </td>
              <td className="p-4 text-right">
                <button onClick={() => toggleTimer(p)} className="text-blue-600 hover:text-blue-800 font-bold text-xs border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                  {activeLog?.projectId === p.id ? '停止' : '开始'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // --- 子组件: 日历视图 (Calendar) ---
  const CalendarView = () => {
    const [calMode, setCalMode] = useState('month'); // 'month', 'week', 'day'
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    // 辅助：获取某天的日志
    const getLogsForDate = (date) => {
      const dateStr = date.toISOString().split('T')[0];
      return logs.filter(l => {
         if(!l.startTime) return false;
         return l.startTime.toISOString().split('T')[0] === dateStr;
      });
    };

    // 月视图
    const renderMonthGrid = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const days = daysInMonth(year, month);
      const startDay = firstDayOfMonth(year, month);
      const blanks = Array(startDay).fill(null);
      const daySlots = Array.from({length: days}, (_, i) => i + 1);
      
      return (
        <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
          ))}
          {[...blanks, ...daySlots].map((d, i) => {
            if (!d) return <div key={`blank-${i}`} className="bg-white min-h-[100px]"></div>;
            const targetDate = new Date(year, month, d);
            const dayLogs = getLogsForDate(targetDate);

            return (
              <div key={d} className="bg-white min-h-[100px] p-2 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setCurrentDate(targetDate); setCalMode('day'); }}>
                <div className={`text-xs font-bold mb-1 ${new Date().getDate() === d && new Date().getMonth() === month ? 'text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>{d}</div>
                <div className="space-y-1">
                  {dayLogs.map(l => (
                    <div key={l.id} className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded truncate border-l-2 border-blue-400">
                      {l.projectName}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    // 周视图
    const renderWeekGrid = () => {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(currentDate.getDate() - day); // Set to Sunday

      const weekDays = Array.from({length: 7}, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
      });

      return (
        <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden h-[600px]">
           {weekDays.map((d, i) => {
             const dayLogs = getLogsForDate(d);
             const isToday = d.toDateString() === new Date().toDateString();
             return (
               <div key={i} className="bg-white p-2 hover:bg-slate-50 flex flex-col cursor-pointer" onClick={() => { setCurrentDate(d); setCalMode('day'); }}>
                 <div className={`text-center text-xs font-bold mb-2 p-1 ${isToday ? 'bg-blue-100 text-blue-600 rounded-full' : 'text-slate-500'}`}>
                   {d.toLocaleDateString('en-US', {weekday: 'short', day: 'numeric'})}
                 </div>
                 <div className="flex-1 space-y-1 overflow-y-auto">
                    {dayLogs.map(l => (
                      <div key={l.id} className="text-[10px] bg-purple-50 text-purple-700 p-1 rounded border border-purple-100 shadow-sm truncate">
                        {l.projectName}
                      </div>
                    ))}
                 </div>
               </div>
             );
           })}
        </div>
      );
    };

    // 日视图 (时间流)
    const renderDayStream = () => {
      const dayLogs = getLogsForDate(currentDate);
      const hours = Array.from({length: 24}, (_, i) => i);

      return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden h-[600px] overflow-y-auto relative">
           {hours.map(h => (
             <div key={h} className="flex border-b border-slate-50 min-h-[60px]">
               <div className="w-16 border-r border-slate-100 p-2 text-xs text-slate-400 text-right">{h}:00</div>
               <div className="flex-1 relative">
                 {/* 渲染该小时内的任务块 */}
                 {dayLogs.map(l => {
                    const startH = l.startTime?.getHours();
                    const startM = l.startTime?.getMinutes();
                    if (startH === h) {
                       // 简单定位: 假设一个任务不超过一小时或跨小时显示首行
                       const top = (startM / 60) * 100; 
                       return (
                         <div key={l.id} 
                              className="absolute left-2 right-2 bg-blue-100 border-l-4 border-blue-500 text-blue-800 text-xs p-1 rounded shadow-sm z-10 cursor-pointer hover:bg-blue-200"
                              style={{top: `${top}%`}}
                              onClick={() => {
                                const proj = projects.find(p => p.id === l.projectId);
                                if(proj) toggleTimer(proj);
                              }}
                         >
                           <div className="font-bold">{l.projectName}</div>
                           <div className="text-[9px] opacity-75">{l.startTime?.toLocaleTimeString()}</div>
                         </div>
                       )
                    }
                    return null;
                 })}
               </div>
             </div>
           ))}
           {/* 当前时间线 */}
           {currentDate.toDateString() === new Date().toDateString() && (
             <div className="absolute left-16 right-0 border-t-2 border-red-400 z-20 pointer-events-none" style={{top: `${(new Date().getHours() * 60 + new Date().getMinutes()) / (24*60) * 100}%`}}>
                <div className="absolute -left-2 -top-1.5 w-3 h-3 bg-red-400 rounded-full"></div>
             </div>
           )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
             <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate()- (calMode==='month'?30:calMode==='week'?7:1) )))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight className="rotate-180" size={18}/></button>
             <span className="font-bold text-lg text-slate-800">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric', day: calMode==='day'?'numeric':undefined })}</span>
             <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate()+ (calMode==='month'?30:calMode==='week'?7:1) )))} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={18}/></button>
           </div>
           <div className="flex bg-slate-100 p-1 rounded-lg">
             {['month', 'week', 'day'].map(m => (
               <button key={m} onClick={() => setCalMode(m)} className={`px-3 py-1 rounded text-xs font-bold capitalize transition-all ${calMode === m ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{m}</button>
             ))}
           </div>
        </div>
        {calMode === 'month' && renderMonthGrid()}
        {calMode === 'week' && renderWeekGrid()}
        {calMode === 'day' && renderDayStream()}
      </div>
    );
  };

  // --- 子组件: 高级报表 (Advanced Analytics) ---
  const AdvancedDashboard = () => {
    const totalTime = logs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0);
    const totalHours = (totalTime / 3600000).toFixed(1);
    
    // Deep Work Logic
    const deepWorkLogs = logs.filter(l => l.endTime && (l.endTime - l.startTime) > 45 * 60 * 1000);
    const deepWorkTime = deepWorkLogs.reduce((acc, l) => acc + (l.endTime - l.startTime), 0);
    const deepWorkHours = (deepWorkTime / 3600000).toFixed(1);

    return (
      <div className="space-y-6">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg shadow-blue-200">
             <div className="text-blue-200 text-xs font-bold uppercase mb-1">Total Hours</div>
             <div className="text-3xl font-bold">{totalHours} <span className="text-sm font-normal">hr</span></div>
           </div>
           <div className="bg-purple-600 text-white p-5 rounded-2xl shadow-lg shadow-purple-200">
             <div className="text-purple-200 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Zap size={12}/> Deep Work</div>
             <div className="text-3xl font-bold">{deepWorkHours} <span className="text-sm font-normal">hr</span></div>
             <div className="text-[10px] mt-1 opacity-80">Sessions {'>'} 45m</div>
           </div>
           <div className="bg-white border border-slate-200 p-5 rounded-2xl">
             <div className="text-slate-400 text-xs font-bold uppercase mb-1">Projects Active</div>
             <div className="text-3xl font-bold text-slate-700">{projects.length}</div>
           </div>
           <div className="bg-white border border-slate-200 p-5 rounded-2xl">
             <div className="text-slate-400 text-xs font-bold uppercase mb-1">Avg Session</div>
             <div className="text-3xl font-bold text-slate-700">{logs.length ? (totalHours/logs.length).toFixed(1) : 0} <span className="text-sm font-normal text-slate-400">hr</span></div>
           </div>
         </div>

         <div className="bg-white rounded-2xl border border-slate-200 p-6">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><List size={18}/> 最近工作明细</h3>
           <div className="space-y-3">
             {logs.slice(0, 8).map(l => (
               <div key={l.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                 <div>
                   <div className="font-bold text-slate-700">{l.projectName}</div>
                   <div className="text-xs text-slate-400 flex gap-2">
                      <span>{l.startTime?.toLocaleDateString()}</span>
                      <span>{l.startTime?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {l.endTime?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || 'Now'}</span>
                   </div>
                 </div>
                 <div className="text-right">
                    <div className="font-mono font-bold text-slate-600">
                      {l.endTime ? ((l.endTime - l.startTime)/1000/60).toFixed(0) + ' min' : 'Running'}
                    </div>
                    {l.endTime && (l.endTime - l.startTime) > 45*60*1000 && (
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">Deep Work</span>
                    )}
                 </div>
               </div>
             ))}
           </div>
         </div>
      </div>
    );
  };

  // --- 辅助 UI ---
  const LiveTimer = ({ startTime }) => {
    const [ms, setMs] = useState(0);
    useEffect(() => {
      const i = setInterval(() => setMs(new Date() - startTime), 1000);
      return () => clearInterval(i);
    }, [startTime]);
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s/3600).toString().padStart(2,'0');
    const mm = Math.floor((s%3600)/60).toString().padStart(2,'0');
    const ss = (s%60).toString().padStart(2,'0');
    return <span className="font-mono text-xl font-bold">{hh}:{mm}:{ss}</span>;
  };

  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 md:pl-64">
      
      {/* 顶部搜索栏 */}
      <div className="fixed top-0 left-0 md:left-64 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 z-40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-xl flex-1 max-w-lg transition-all focus-within:ring-2 focus-within:ring-blue-200">
          <Search size={18} className="text-slate-400"/>
          <input 
            className="bg-transparent outline-none w-full text-sm font-medium" 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* 活动计时器 */}
        {activeLog && (
           <div className="hidden md:flex items-center gap-4 bg-green-50 border border-green-200 px-4 py-2 rounded-xl animate-fade-in shadow-sm">
             <div className="flex flex-col">
               <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-1"><Activity size={10}/> Focusing</span>
               <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{activeLog.projectName}</span>
             </div>
             <LiveTimer startTime={activeLog.startTime} />
             <button onClick={stopTimer} className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-sm transition"><Square size={14} fill="currentColor"/></button>
           </div>
        )}
      </div>

      {/* Notion 配置弹窗 (已恢复) */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex gap-2"><Settings size={18}/> 同步配置中心</h3>
              <button onClick={() => setConfigModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100">
                <p>1. 实时双向同步: 新建项目会自动推送到 Notion。</p>
                <p>2. "已完成"的项目在导入时会被自动过滤。</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Database ID</label>
                  <input className="input-std" value={notionConfig.dbId} onChange={e=>setNotionConfig({...notionConfig, dbId: e.target.value})} placeholder="Notion URL ID" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">标题列名</label>
                   <input className="input-std" value={notionConfig.titleProp} onChange={e=>setNotionConfig({...notionConfig, titleProp: e.target.value})} placeholder="Name" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">状态列名</label>
                   <input className="input-std" value={notionConfig.statusProp} onChange={e=>setNotionConfig({...notionConfig, statusProp: e.target.value})} placeholder="Status" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">分类列名</label>
                   <input className="input-std" value={notionConfig.categoryProp} onChange={e=>setNotionConfig({...notionConfig, categoryProp: e.target.value})} placeholder="Category" />
                </div>
                <div className="col-span-2">
                   <label className="text-xs font-bold text-purple-600 uppercase">反写时间列 (Number)</label>
                   <input className="input-std border-purple-200 bg-purple-50" value={notionConfig.writeBackProp} onChange={e=>setNotionConfig({...notionConfig, writeBackProp: e.target.value})} placeholder="TimeSpent" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer" onClick={()=>setNotionConfig(c=>({...c, isRealMode: !c.isRealMode}))}>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${notionConfig.isRealMode ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${notionConfig.isRealMode ? 'translate-x-4' : ''}`}></div>
                </div>
                <span>{notionConfig.isRealMode ? '真实 API 模式' : '模拟演示模式'}</span>
              </div>

              {importLog && <div className="text-xs font-mono bg-slate-900 text-green-400 p-2 rounded max-h-20 overflow-auto">{importLog}</div>}
              
              <button onClick={executeImport} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition flex justify-center gap-2">
                <RefreshCw size={18}/> 立即同步 (Pull)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <nav className="fixed bottom-0 md:top-0 left-0 w-full md:w-64 bg-white border-t md:border-r border-slate-200 z-50 md:h-full flex md:flex-col p-4 shadow-2xl md:shadow-none">
        <div className="hidden md:block mb-8">
           <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer Pro</h1>
        </div>
        
        <div className="flex md:flex-col justify-around w-full gap-2">
           <div className="md:mb-4">
             <div className="hidden md:block text-xs font-bold text-slate-400 uppercase mb-2 px-3">Workspace</div>
             <NavBtn icon={<LayoutGrid/>} label="Projects" active={view==='projects'} onClick={()=>setView('projects')} />
             <NavBtn icon={<CalendarIcon/>} label="Calendar" active={view==='calendar'} onClick={()=>setView('calendar')} />
             <NavBtn icon={<BarChart3/>} label="Analytics" active={view==='dashboard'} onClick={()=>setView('dashboard')} />
           </div>
           
           <div className="md:mb-4">
             <div className="hidden md:block text-xs font-bold text-slate-400 uppercase mb-2 px-3">Integration</div>
             <NavBtn icon={<RefreshCw/>} label="Notion Sync" onClick={()=>setConfigModalOpen(true)} />
           </div>
        </div>
        
        <div className="hidden md:block mt-auto">
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-red-500 hover:bg-red-50 w-full p-3 rounded-xl transition"><LogOut size={18}/> Sign Out</button>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="pt-24 px-4 md:px-8 pb-8 max-w-6xl mx-auto">
        
        {/* 项目视图 */}
        {view === 'projects' && (
          <div className="animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex bg-slate-200 p-1 rounded-lg self-start">
                   <button onClick={() => setSubView('board')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${subView === 'board' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><Columns size={16}/> Board</button>
                   <button onClick={() => setSubView('table')} className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${subView === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><TableIcon size={16}/> Table</button>
                </div>
                
                {/* 行内新建项目 (No Prompt) */}
                <form onSubmit={handleCreateProject} className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full md:w-auto">
                   <input 
                     className="px-4 py-2 outline-none text-sm w-full md:w-64"
                     placeholder="New project name..."
                     value={newProjectTitle}
                     onChange={e => setNewProjectTitle(e.target.value)}
                   />
                   <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 flex items-center gap-2 transition"><Plus size={18}/> <span className="hidden md:inline">Add</span></button>
                </form>
             </div>

             {subView === 'board' ? <KanbanBoard /> : <TableView />}
          </div>
        )}

        {/* 日历视图 */}
        {view === 'calendar' && (
           <div className="animate-fade-in">
             <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><CalendarIcon className="text-blue-600"/> Schedule</h2>
             <CalendarView />
           </div>
        )}

        {/* 报表视图 */}
        {view === 'dashboard' && (
           <div className="animate-fade-in">
             <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="text-blue-600"/> Insights</h2>
             <AdvancedDashboard />
           </div>
        )}

      </main>

      <style>{`
        .input-std { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background-color: #f8fafc; border: 1px solid #e2e8f0; outline: none; font-size: 0.875rem; }
        .input-std:focus { ring: 2px; ring-color: #3b82f6; }
      `}</style>
    </div>
  );
}

const NavBtn = ({icon, label, active, onClick}) => (
  <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left ${active ? 'bg-slate-900 text-white font-bold shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
    {icon} <span className="hidden md:inline text-sm">{label}</span>
  </button>
);