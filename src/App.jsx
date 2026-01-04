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
  Play, Square, Clock, PieChart, Database, List, Briefcase, LogOut, KeyRound, AlertCircle, Zap, Plus, Calendar, BarChart3, ChevronRight, Trash2, FolderTree, FileText, ChevronDown, ChevronUp, Settings, X, GripVertical, AlertTriangle, Check, Search, Filter, RefreshCw
} from 'lucide-react';

// --- 1. Firebase 配置 (保持不变) ---
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
        <h1 className="text-2xl font-bold text-slate-800 mb-2">EngTimer</h1>
        <p className="text-sm text-slate-500 mb-8">工程时间管理系统</p>
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
  const [view, setView] = useState('projects'); // 默认改为项目视图，更灵活
  const [searchQuery, setSearchQuery] = useState('');
  
  // Notion Config
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [notionConfig, setNotionConfig] = useState({
    dbId: '',
    titleProp: 'Name',
    statusProp: 'Status', // 用于过滤 "Done"
    writeBackProp: 'TimeSpent', // 用于回写
    isRealMode: true
  });
  const [importLog, setImportLog] = useState('');

  // 1. Auth & Data
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
    // 只监听 Project 和 Logs，简化数据流
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

  // 快捷开始/停止 (灵活交互核心)
  const toggleTimer = async (project) => {
    if (activeLog) {
      // 如果正在计时，且点击的是同一个项目 -> 停止
      if (activeLog.projectId === project.id) {
        await stopTimer();
      } else {
        // 如果点击的是不同项目 -> 先停止当前，再开始新的 (无缝切换)
        await stopTimer();
        await startTimer(project);
      }
    } else {
      await startTimer(project);
    }
  };

  const startTimer = async (project) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), {
        projectId: project.id,
        projectName: project.name, // 冗余存储方便显示
        startTime: serverTimestamp(),
        endTime: null
      });
    } catch (e) { alert(e.message); }
  };

  const stopTimer = async () => {
    if (!activeLog) return;
    const endTime = new Date();
    const durationMin = ((endTime - activeLog.startTime) / 1000 / 60); // 分钟

    try {
      // 1. Firebase 存档
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), { endTime });
      
      // 2. Notion 回写 (如果项目关联了 Notion)
      const project = projects.find(p => p.id === activeLog.projectId);
      if (project?.notionId) {
        await syncToNotion(project.notionId, durationMin, project.name);
      }
    } catch (e) { console.error(e); }
  };

  // 关键：统一回写逻辑
  const syncToNotion = async (pageId, durationAdd, name) => {
    if (!notionConfig.isRealMode) {
      showToast(`[模拟] ${name}: 更新 +${durationAdd.toFixed(1)}min 到列 ${notionConfig.writeBackProp}`);
      return;
    }

    showToast(`正在同步 ${name} 数据至 Notion...`, 'loading');
    
    // 调用 notion-update.js
    // 注意：本地开发时路径可能是 /.netlify/functions/notion-update
    const endpoint = '/.netlify/functions/notion-update';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: pageId,
          property: notionConfig.writeBackProp,
          value: durationAdd
        })
      });

      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      showToast(`同步成功! ${name} 最新累计: ${data.newValue?.toFixed(1)}`, 'success');
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

  // 智能导入逻辑
  const executeImport = async (e) => {
    e.preventDefault();
    setImportLog('连接中...');
    const { dbId, titleProp, statusProp, isRealMode } = notionConfig;

    if (!isRealMode) {
      // 模拟导入
      const mock = [
        { id: 'm1', [titleProp]: 'P-101 压缩机设计', [statusProp]: 'In Progress' },
        { id: 'm2', [titleProp]: 'T-204 历史归档任务', [statusProp]: 'Done' }, // 这个应该被过滤
      ];
      await processImport(mock);
    } else {
      try {
        const res = await fetch('/.netlify/functions/notion', {
          method: 'POST',
          body: JSON.stringify({ 
            databaseId: dbId,
            // 可选: 在这里加 filter payload 减少传输量，或者在前端过滤
          })
        });
        if (!res.ok) throw new Error("API连接失败");
        const data = await res.json();
        
        const parsed = data.results.map(p => {
           const props = p.properties;
           // 解析标题
           const title = props[titleProp]?.title?.[0]?.plain_text || 'Unknown';
           // 解析状态 (支持 Select, Status)
           const status = props[statusProp]?.select?.name || props[statusProp]?.status?.name || '';
           return { id: p.id, [titleProp]: title, [statusProp]: status };
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
    const { titleProp, statusProp } = notionConfig;

    for (const item of items) {
      const status = item[statusProp] || '';
      // 过滤逻辑：如果状态包含 "Done", "Completed", "已完成"，则跳过
      if (['Done', 'Completed', '已完成', 'Archived'].includes(status)) {
        skipped++;
        continue;
      }
      
      const name = item[titleProp];
      // 避免重复
      if (!projects.find(p => p.notionId === item.id)) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
          name, 
          notionId: item.id,
          status: status,
          createdAt: serverTimestamp()
        });
        count++;
      }
    }
    setImportLog(`导入完成: 新增 ${count} 个, 跳过(已完成) ${skipped} 个。`);
    setTimeout(() => setConfigModalOpen(false), 1500);
  };

  // --- 过滤项目 (搜索) ---
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [projects, searchQuery]);

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
      
      {/* 顶部搜索栏 (随时搜索) */}
      <div className="fixed top-0 left-0 md:left-64 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 z-40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-xl flex-1 max-w-lg">
          <Search size={18} className="text-slate-400"/>
          <input 
            className="bg-transparent outline-none w-full text-sm font-medium" 
            placeholder="搜索项目..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* 活动计时器 (全局显示) */}
        {activeLog && (
           <div className="hidden md:flex items-center gap-4 bg-green-50 border border-green-200 px-4 py-2 rounded-xl animate-fade-in">
             <div className="flex flex-col">
               <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Active</span>
               <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{activeLog.projectName}</span>
             </div>
             <LiveTimer startTime={activeLog.startTime} />
             <button onClick={stopTimer} className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-sm transition"><Square size={14} fill="currentColor"/></button>
           </div>
        )}
      </div>

      {/* 配置弹窗 */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex gap-2"><Settings size={18}/> 同步配置中心</h3>
              <button onClick={() => setConfigModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100">
                <p>1. 只要填写一次，系统会自动处理读取和反写。</p>
                <p>2. "已完成"的项目将自动被过滤。</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Database ID</label>
                  <input className="input-std" value={notionConfig.dbId} onChange={e=>setNotionConfig({...notionConfig, dbId: e.target.value})} placeholder="Notion URL ID" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">标题列名</label>
                   <input className="input-std" value={notionConfig.titleProp} onChange={e=>setNotionConfig({...notionConfig, titleProp: e.target.value})} placeholder="e.g. Name" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">状态列名 (用于过滤)</label>
                   <input className="input-std" value={notionConfig.statusProp} onChange={e=>setNotionConfig({...notionConfig, statusProp: e.target.value})} placeholder="e.g. Status" />
                </div>
                <div>
                   <label className="text-xs font-bold text-purple-600 uppercase">回写时间列名</label>
                   <input className="input-std border-purple-200 bg-purple-50" value={notionConfig.writeBackProp} onChange={e=>setNotionConfig({...notionConfig, writeBackProp: e.target.value})} placeholder="e.g. TimeSpent" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer" onClick={()=>setNotionConfig(c=>({...c, isRealMode: !c.isRealMode}))}>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${notionConfig.isRealMode ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${notionConfig.isRealMode ? 'translate-x-4' : ''}`}></div>
                </div>
                <span>{notionConfig.isRealMode ? '真实 API 模式' : '模拟演示模式'}</span>
              </div>

              {importLog && <div className="text-xs font-mono bg-slate-900 text-green-400 p-2 rounded max-h-20 overflow-auto">{importLog}</div>}
              
              <button onClick={executeImport} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition">开始全量同步</button>
            </div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <nav className="fixed bottom-0 md:top-0 left-0 w-full md:w-64 bg-white border-t md:border-r border-slate-200 z-50 md:h-full flex md:flex-col p-4 shadow-2xl md:shadow-none">
        <div className="hidden md:block mb-8">
           <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</h1>
           <div className="mt-4 text-xs text-slate-400">
             Engineer: {user.email}
           </div>
        </div>
        
        <div className="flex md:flex-col justify-around w-full gap-2">
           <NavBtn icon={<List/>} label="项目列表" active={view==='projects'} onClick={()=>setView('projects')} />
           <NavBtn icon={<PieChart/>} label="统计报表" active={view==='dashboard'} onClick={()=>setView('dashboard')} />
           <NavBtn icon={<RefreshCw/>} label="同步配置" onClick={()=>setConfigModalOpen(true)} />
        </div>
        
        <div className="hidden md:block mt-auto">
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-red-500 hover:bg-red-50 w-full p-3 rounded-xl transition"><LogOut size={18}/> 退出</button>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="pt-20 px-4 md:px-8 pb-8 max-w-5xl mx-auto">
        
        {/* 项目列表视图 */}
        {view === 'projects' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {/* 手机端可见的 Active Timer 卡片 */}
             {activeLog && (
               <div className="md:hidden col-span-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between sticky top-20 z-30">
                 <div>
                   <div className="text-[10px] opacity-60 uppercase font-bold">Current Task</div>
                   <div className="font-bold truncate max-w-[150px]">{activeLog.projectName}</div>
                 </div>
                 <div className="flex items-center gap-3">
                    <LiveTimer startTime={activeLog.startTime}/>
                    <button onClick={stopTimer} className="bg-red-500 p-2 rounded-lg"><Square size={16} fill="currentColor"/></button>
                 </div>
               </div>
             )}

             {/* 本地新建项目卡片 */}
             <div 
               onClick={() => {
                 const n = prompt("输入新项目名称:");
                 if(n) addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {name: n, createdAt: serverTimestamp()});
               }}
               className="border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors text-slate-400 hover:text-blue-600 group h-32"
             >
               <Plus size={32} className="group-hover:scale-110 transition-transform"/>
               <span className="text-sm font-bold mt-2">新建项目</span>
             </div>

             {/* 项目卡片列表 */}
             {filteredProjects.map(p => {
               const isActive = activeLog?.projectId === p.id;
               return (
                 <div 
                   key={p.id} 
                   className={`relative group bg-white rounded-2xl p-5 border transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between h-32 ${isActive ? 'border-green-500 ring-1 ring-green-500 bg-green-50/30' : 'border-slate-200 hover:border-blue-300'}`}
                 >
                    {/* 快捷播放遮罩 (核心交互) */}
                    <div 
                      onClick={() => toggleTimer(p)}
                      className="absolute inset-0 bg-white/0 group-hover:bg-white/10 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"
                    >
                       <div className={`p-4 rounded-full shadow-2xl transform scale-75 group-hover:scale-100 transition-transform ${isActive ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                          {isActive ? <Square size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}
                       </div>
                    </div>

                    <div className="flex justify-between items-start">
                       <div className={`p-2 rounded-lg ${p.notionId ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                         {p.notionId ? <Database size={18}/> : <Briefcase size={18}/>}
                       </div>
                       {isActive && <div className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full animate-pulse">Running</div>}
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 text-lg truncate">{p.name}</h3>
                      <div className="text-xs text-slate-400 mt-1 flex gap-2">
                        <span>{p.notionId ? 'Notion Linked' : 'Local'}</span>
                        {p.status && <span className="bg-slate-100 px-1 rounded">{p.status}</span>}
                      </div>
                    </div>
                 </div>
               )
             })}
          </div>
        )}

        {/* 报表视图 (保留核心功能) */}
        {view === 'dashboard' && (
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BarChart3/> 简报</h2>
             <div className="space-y-4">
               {projects.map(p => {
                 const pLogs = logs.filter(l => l.projectId === p.id && l.endTime);
                 const total = pLogs.reduce((acc, l) => acc + (l.endTime - l.startTime), 0);
                 if (total === 0) return null;
                 const hrs = (total / 3600000).toFixed(1);
                 return (
                   <div key={p.id}>
                     <div className="flex justify-between text-sm mb-1">
                       <span>{p.name}</span>
                       <span className="font-mono">{hrs} hr</span>
                     </div>
                     <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div className="bg-blue-600 h-full" style={{width: `${Math.min((total/3600000)*10, 100)}%`}}></div>
                     </div>
                   </div>
                 )
               })}
               {logs.length === 0 && <div className="text-center text-slate-400 py-10">暂无数据</div>}
             </div>
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
  <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left ${active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
    {icon} <span className="hidden md:inline text-sm">{label}</span>
  </button>
);