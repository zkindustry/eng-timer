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
  deleteDoc
} from 'firebase/firestore';
import { 
  Play, Square, Clock, PieChart, Database, List, Briefcase, LogOut, KeyRound, AlertCircle, Zap, Plus, Calendar, BarChart3, ChevronRight
} from 'lucide-react';

// --- 1. Firebase 配置 ---
let firebaseConfig;
let appId;

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} else {
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

// --- 2. 极简暗号登录组件 (保持不变) ---
const AuthScreen = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccess = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setLoading(true);
    setError('');

    const cleanCode = accessCode.trim().toLowerCase().replace(/\s/g, '');
    if (cleanCode.length < 4) {
      setError("暗号太短，请至少输入4位字符");
      setLoading(false);
      return;
    }

    const fakeEmail = `${cleanCode}@engtimer.local`;
    const fakePassword = `engtimer-${cleanCode}-secure`; 

    try {
      await signInWithEmailAndPassword(auth, fakeEmail, fakePassword);
    } catch (loginErr) {
      if (loginErr.code === 'auth/operation-not-allowed') {
        setError("请去 Firebase 控制台开启 'Email/Password' 登录权限。");
        setLoading(false);
        return;
      }
      if (loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/wrong-password') {
        try {
          await createUserWithEmailAndPassword(auth, fakeEmail, fakePassword);
        } catch (createErr) {
          setError("初始化失败: " + createErr.message);
        }
      } else {
        setError("连接失败: " + loginErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 text-center">
        <div className="flex justify-center mb-6 text-blue-600">
          <div className="bg-blue-50 p-4 rounded-full animate-pulse-slow">
            <Zap size={32} fill="currentColor" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">EngTimer</h1>
        <p className="text-sm text-slate-500 mb-8">工程时间管理系统</p>
        <form onSubmit={handleAccess} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="text" 
              required
              autoFocus
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg font-medium text-slate-800 placeholder:text-slate-300"
              placeholder="输入暗号 (如: mywork)"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
          </div>
          {error && <div className="text-red-600 text-xs bg-red-50 p-2 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-50">
            {loading ? '同步中...' : '进入系统'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- 3. 主应用组件 ---
export default function TimeTrackerApp() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // 计时器状态
  const [activeLog, setActiveLog] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [taskDescription, setTaskDescription] = useState(''); // 新增: 任务具体描述
  
  // 视图状态
  const [view, setView] = useState('timer'); 
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState('week'); // 'day', 'week', 'month', 'year'
  
  // 本地创建项目状态
  const [newProjectName, setNewProjectName] = useState('');

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
       if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
         try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e) { console.error(e); }
       }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    const projectsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    const unsubProjects = onSnapshot(query(projectsRef), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs');
    const unsubLogs = onSnapshot(query(logsRef), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate()
      }));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setLogs(list);

      const running = list.find(log => !log.endTime);
      setActiveLog(running || null);
      if (running) {
        if (!selectedProjectId) setSelectedProjectId(running.projectId);
        if (!taskDescription) setTaskDescription(running.taskName || '');
      }
    });

    return () => { unsubProjects(); unsubLogs(); };
  }, [user]);

  // --- 逻辑控制 ---

  // 1. 开始计时 (包含具体任务描述)
  const handleStartTimer = async () => {
    if (!user || !selectedProjectId || activeLog) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), {
        projectId: selectedProjectId,
        taskName: taskDescription || '常规任务', // 新增: 记录具体任务名
        startTime: serverTimestamp(),
        endTime: null,
      });
    } catch (e) {
      alert("开始失败：" + e.message);
    }
  };

  // 2. 结束计时 (触发 Notion 回写逻辑)
  const handleStopTimer = async () => {
    if (!user || !activeLog) return;
    try {
      const endTime = new Date();
      // 更新 Firestore
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), {
        endTime: endTime
      });

      // --- Notion 回写逻辑 (闭环关键) ---
      const project = projects.find(p => p.id === activeLog.projectId);
      if (project && project.notionId) {
        // 计算本次时长 (秒)
        const durationSec = (endTime - activeLog.startTime) / 1000;
        await syncBackToNotion(project.notionId, durationSec);
      }

      setTaskDescription(''); // 清空描述
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  // 模拟 Notion 回写 API 调用
  const syncBackToNotion = async (notionId, durationSec) => {
    console.log(`[Notion Sync] Updating Page ${notionId}, adding ${durationSec} seconds.`);
    // 在真实生产环境中，这里会调用您的 Vercel 后端接口:
    // await fetch('/api/update-notion-time', { method: 'POST', body: ... })
    
    // 这里做个 UI 提示模拟
    const msg = document.createElement('div');
    msg.innerText = `已自动更新 Notion 项目时长 (+${(durationSec/60).toFixed(1)} min)`;
    msg.className = "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in";
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  };

  // 3. 本地创建项目
  const handleCreateLocalProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        name: newProjectName,
        notionId: null, // 标记为本地项目
        createdAt: serverTimestamp()
      });
      setNewProjectName('');
      alert("本地项目创建成功");
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportFromNotion = async () => {
     // 简化版模拟
     if(confirm("连接真实 Notion API 失败 (预览环境)。是否导入模拟数据？")) {
       const mockProjects = [
         { name: 'P-101: 离心压缩机组设计', notionId: 'n-123' },
         { name: 'T-204: 燃气轮机大修计划', notionId: 'n-456' },
       ];
       for (const p of mockProjects) {
          const exists = projects.find(existing => existing.name === p.name);
          if (!exists) {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { ...p, createdAt: serverTimestamp() });
          }
       }
     }
  };

  // --- 报表计算逻辑 (多维度) ---
  const getFilteredLogs = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let cutoffDate = startOfDay; // Default day

    if (dashboardTab === 'week') {
      const day = now.getDay() || 7; // Get current day number, converting Sun(0) to 7
      if (day !== 1) cutoffDate.setHours(-24 * (day - 1)); // Set to Monday
    } else if (dashboardTab === 'month') {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dashboardTab === 'year') {
      cutoffDate = new Date(now.getFullYear(), 0, 1);
    }

    return logs.filter(log => {
      if (!log.endTime) return false;
      return log.startTime >= cutoffDate;
    });
  };

  // --- 辅助组件 ---
  const formatDuration = (start, end) => {
    if (!start) return "00:00:00";
    const endTime = end || new Date();
    const diff = Math.floor((endTime - start) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const LiveTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState("00:00:00");
    useEffect(() => {
      const interval = setInterval(() => setElapsed(formatDuration(startTime)), 1000);
      return () => clearInterval(interval);
    }, [startTime]);
    return <span className="font-mono text-5xl font-bold text-slate-800 tracking-tight">{elapsed}</span>;
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">加载中...</div>;
  if (!user) return <AuthScreen />;

  // --- 视图渲染 ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-0 md:pl-64">
      {/* 侧边栏 */}
      <nav className="fixed bottom-0 md:top-0 left-0 w-full md:w-64 bg-white border-t md:border-r border-slate-200 z-50 md:h-full flex md:flex-col justify-around md:justify-start md:p-6 shadow-lg md:shadow-none">
        <div className="hidden md:block mb-8 mt-2">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</h1>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">当前暗号</p>
            <p className="text-sm text-slate-700 font-mono">{user.email ? user.email.split('@')[0] : '...'}</p>
          </div>
        </div>
        
        <div className="flex md:flex-col justify-around w-full md:space-y-2">
          <button onClick={() => setView('timer')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'timer' ? 'text-blue-600 bg-blue-50 md:translate-x-1 font-bold' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Clock size={22} /> <span className="text-[10px] md:text-sm mt-1 md:mt-0">计时工作台</span>
          </button>
          <button onClick={() => setView('dashboard')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'dashboard' ? 'text-blue-600 bg-blue-50 md:translate-x-1 font-bold' : 'text-slate-400 hover:bg-slate-50'}`}>
            <BarChart3 size={22} /> <span className="text-[10px] md:text-sm mt-1 md:mt-0">多维报表</span>
          </button>
          <button onClick={() => setView('projects')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'projects' ? 'text-blue-600 bg-blue-50 md:translate-x-1 font-bold' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Briefcase size={22} /> <span className="text-[10px] md:text-sm mt-1 md:mt-0">项目管理</span>
          </button>
        </div>
        
        <div className="hidden md:block md:mt-auto">
          <button onClick={() => signOut(auth)} className="p-3 rounded-xl flex md:space-x-3 items-center text-red-500 hover:bg-red-50 w-full transition-colors">
            <LogOut size={20} /> <span className="font-medium">退出系统</span>
          </button>
        </div>
      </nav>

      {/* 主界面 */}
      <main className="max-w-3xl mx-auto p-4 md:p-8 min-h-screen">
        <header className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-40">
          <div className="flex flex-col">
            <span className="font-bold flex gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</span>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 bg-slate-100 rounded-full text-slate-500"><LogOut size={18} /></button>
        </header>

        {/* --- 1. 计时工作台 --- */}
        {view === 'timer' && (
          <div className="flex flex-col items-center space-y-6 mt-4 animate-fade-in">
            {/* 计时主卡片 */}
            <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 text-center border border-slate-100 relative overflow-hidden">
               {activeLog && <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500 animate-pulse-slow"></div>}
               
               <div className="mb-8 flex justify-center">
                 <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activeLog ? 'bg-green-100 text-green-700 ring-1 ring-green-500' : 'bg-slate-100 text-slate-500'}`}>
                   {activeLog ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-ping"/> 进行中</> : '等待开始'}
                 </span>
               </div>
               
               <div className="mb-8">
                 {activeLog ? <LiveTimer startTime={activeLog.startTime}/> : <span className="text-6xl font-mono font-bold text-slate-200 tracking-tight">00:00:00</span>}
               </div>
               
               <div className="space-y-4 mb-8 text-left">
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase ml-1">项目 (Project)</label>
                   <select 
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-bold transition-all"
                     value={selectedProjectId}
                     onChange={(e) => setSelectedProjectId(e.target.value)}
                     disabled={!!activeLog}
                   >
                     <option value="">-- 选择项目 --</option>
                     {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
                 
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase ml-1">具体任务 (Task)</label>
                   <input 
                      type="text"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium transition-all placeholder:font-normal"
                      placeholder="例如：绘制PID图、复核应力计算..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      disabled={!!activeLog}
                   />
                 </div>
               </div>
               
               {activeLog ? (
                 <button onClick={handleStopTimer} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-lg">
                   <Square size={24} fill="currentColor"/> 结束并存档
                 </button>
               ) : (
                 <button onClick={handleStartTimer} disabled={!selectedProjectId} className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-lg ${!selectedProjectId ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
                   <Play size={24} fill="currentColor"/> 开始计时
                 </button>
               )}
            </div>
            
            {/* 最近记录 */}
            <div className="w-full">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1 tracking-wider">今日动态</h3>
              <div className="space-y-2">
                {logs.slice(0,5).map(l => (
                  <div key={l.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center text-sm shadow-sm hover:shadow-md transition-shadow">
                    <div>
                      <div className="font-bold text-slate-700">{projects.find(p=>p.id===l.projectId)?.name || '未知项目'}</div>
                      <div className="text-xs text-slate-400 mt-1">{l.taskName || '无描述'}</div>
                    </div>
                    <div className="text-right">
                       <div className="font-mono text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">
                         {formatDuration(l.startTime, l.endTime)}
                       </div>
                       {!l.endTime && <span className="text-[10px] text-green-500 font-bold uppercase mt-1 block">Running</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 2. 多维报表 --- */}
        {view === 'dashboard' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChart className="text-blue-600"/> 统计看板</h2>
            
            {/* 时间维度 Tab */}
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
              {['day', 'week', 'month', 'year'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setDashboardTab(tab)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${dashboardTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tab === 'day' ? '今日' : tab === 'week' ? '本周' : tab === 'month' ? '本月' : '全年'}
                </button>
              ))}
            </div>

            {/* 核心指标 */}
            {(() => {
              const filteredLogs = getFilteredLogs();
              const totalMs = filteredLogs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0);
              const totalHours = (totalMs / 3600000).toFixed(1);
              
              // 按项目分组计算
              const stats = {};
              filteredLogs.forEach(l => {
                if(!l.endTime) return;
                const pid = l.projectId;
                if(!stats[pid]) stats[pid] = 0;
                stats[pid] += (l.endTime - l.startTime);
              });

              return (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-6 rounded-2xl shadow-xl shadow-blue-200 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-blue-100 text-sm font-medium mb-1 capitalize">{dashboardTab} 总工时</div>
                        <div className="text-5xl font-bold tracking-tight">
                          {totalHours} <span className="text-xl font-normal opacity-80">hr</span>
                        </div>
                      </div>
                      <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                        <Calendar size={24} className="text-white"/>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart3 size={18}/> 项目投入分布
                      </h3>
                      <div className="space-y-5">
                        {Object.entries(stats).sort(([,a], [,b]) => b - a).map(([pid, ms]) => {
                          const pName = projects.find(p => p.id === pid)?.name || '未知项目';
                          const hrs = (ms / 3600000).toFixed(1);
                          const pct = totalMs > 0 ? (ms / totalMs) * 100 : 0;
                          
                          return (
                            <div key={pid}>
                              <div className="flex justify-between text-sm mb-1.5">
                                <span className="text-slate-700 font-bold">{pName}</span>
                                <span className="text-slate-500 font-mono">{hrs} hr</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{width: `${pct}%`}}></div>
                              </div>
                            </div>
                          )
                        })}
                        {Object.keys(stats).length === 0 && <div className="py-8 text-center text-slate-400">该时间段暂无数据</div>}
                      </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* --- 3. 项目管理 (支持本地新建) --- */}
        {view === 'projects' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><List className="text-blue-600"/> 项目管理</h2>
            
            {/* 新建本地项目 */}
            <form onSubmit={handleCreateLocalProject} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-2">
               <input 
                 type="text" 
                 placeholder="新建本地项目名称..." 
                 className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                 value={newProjectName}
                 onChange={(e) => setNewProjectName(e.target.value)}
               />
               <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1 hover:bg-blue-700 transition-colors">
                 <Plus size={18}/> <span className="hidden sm:inline">新建</span>
               </button>
            </form>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">项目列表</span>
              <button onClick={handleImportFromNotion} className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1">
                <Database size={12}/> 导入 Notion 数据
              </button>
            </div>

            <div className="space-y-3">
              {projects.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${p.notionId ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                      {p.notionId ? <Database size={20}/> : <Briefcase size={20}/>}
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">{p.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">
                        {p.notionId ? `Notion Linked` : 'Local Project'}
                      </div>
                    </div>
                  </div>
                  {p.notionId && (
                     <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                       <Zap size={10} fill="currentColor"/> Auto-Sync
                     </span>
                  )}
                </div>
              ))}
              {projects.length === 0 && (
                 <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                    暂无项目，请新建或导入
                 </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}