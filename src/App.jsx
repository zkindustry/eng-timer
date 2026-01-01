import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Play, Square, Clock, PieChart, Database, List, Briefcase, LogOut, KeyRound, AlertCircle, Zap
} from 'lucide-react';

// --- 1. Firebase 配置 (自动适配环境) ---
let firebaseConfig;
let appId;

// 判断是否在 Canvas 预览环境中运行
if (typeof __firebase_config !== 'undefined') {
  // [预览环境] 使用系统提供的配置，确保您在右侧能看到效果
  firebaseConfig = JSON.parse(__firebase_config);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} else {
  // [本地/生产环境] 请在此处填入您的真实 Firebase 配置
  // 当您部署到 Vercel 时，请使用此处的配置
  // firebaseConfig = {
  //   apiKey: "AIzaSy... (替换为您的真实Key)", 
  //   authDomain: "your-app.firebaseapp.com",
  //   projectId: "your-app",
  //   storageBucket: "your-app.appspot.com",
  //   messagingSenderId: "123456789",
  //   appId: "1:123456789:web:abcdef"
  // };
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

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. 极简暗号登录组件 ---
const AuthScreen = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccess = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    
    setLoading(true);
    setError('');

    // --- 暗号机制核心逻辑 ---
    const cleanCode = accessCode.trim().toLowerCase().replace(/\s/g, '');
    if (cleanCode.length < 4) {
      setError("暗号太短，请至少输入4位字符（如：work2024）");
      setLoading(false);
      return;
    }

    // 将暗号转换为虚拟邮箱，实现“免注册”体验
    const fakeEmail = `${cleanCode}@engtimer.local`;
    const fakePassword = `engtimer-${cleanCode}-secure`; 

    try {
      // 1. 尝试直接登录
      await signInWithEmailAndPassword(auth, fakeEmail, fakePassword);
    } catch (loginErr) {
      // 2. 登录失败则尝试注册 (第一次使用该暗号时)
      if (loginErr.code === 'auth/invalid-credential' || loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/wrong-password') {
        try {
          await createUserWithEmailAndPassword(auth, fakeEmail, fakePassword);
        } catch (createErr) {
          console.error("注册失败:", createErr);
          if (createErr.code === 'auth/email-already-in-use') {
             // 极端情况：邮箱被占但密码不对（通常不会发生，除非改了生成逻辑）
             setError("暗号验证失败，请确认暗号是否正确");
          } else {
             setError("初始化暗号失败，请重试");
          }
        }
      } else {
        console.error("登录错误:", loginErr);
        setError("连接服务器失败: " + loginErr.message);
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
        <p className="text-sm text-slate-500 mb-8">输入您的唯一暗号以同步数据</p>

        <form onSubmit={handleAccess} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="text" 
              required
              autoFocus
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg font-medium text-slate-800 placeholder:text-slate-300"
              placeholder="例如: mywork"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded-lg break-all text-left">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold transition-transform active:scale-95 shadow-lg disabled:opacity-50"
          >
            {loading ? '正在同步...' : '进入系统'}
          </button>
        </form>
        
        <p className="mt-6 text-xs text-slate-400">
          * 在任何设备输入相同暗号即可同步
        </p>
      </div>
    </div>
  );
};

// --- 3. 主应用组件 ---
export default function TimeTrackerApp() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeLog, setActiveLog] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [view, setView] = useState('timer'); 
  const [loading, setLoading] = useState(true);

  // Auth 监听
  useEffect(() => {
    // Canvas 环境下的特殊处理：如果有初始 Token，优先使用
    const initAuth = async () => {
       if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
         try {
           await signInWithCustomToken(auth, __initial_auth_token);
         } catch(e) {
           console.error("Token auth failed", e);
         }
       }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 数据同步监听
  useEffect(() => {
    if (!user) return;

    // 监听项目
    const projectsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    const unsubProjects = onSnapshot(query(projectsRef), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(list);
    }, (err) => console.error("Projects sync error:", err));

    // 监听日志
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs');
    const unsubLogs = onSnapshot(query(logsRef), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate()
      }));
      list.sort((a, b) => b.startTime - a.startTime);
      setLogs(list);

      const running = list.find(log => !log.endTime);
      setActiveLog(running || null);
      if (running && !selectedProjectId) setSelectedProjectId(running.projectId);
    }, (err) => console.error("Logs sync error:", err));

    return () => {
      unsubProjects();
      unsubLogs();
    };
  }, [user]);

  // --- 业务逻辑 ---
  const handleStartTimer = async () => {
    if (!user || !selectedProjectId || activeLog) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), {
        projectId: selectedProjectId,
        startTime: serverTimestamp(),
        endTime: null,
      });
    } catch (e) {
      console.error("开始失败:", e);
      alert("操作失败：" + e.message);
    }
  };

  const handleStopTimer = async () => {
    if (!user || !activeLog) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), {
        endTime: serverTimestamp()
      });
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleImportFromNotion = async () => {
    if (!user) return;
    try {
      // 检查是否是生产环境 (这里简单判断 hostname，如果在 Vercel 上则不包含 'local' 或 'canvas')
      // 注意：在 Canvas 预览中，我们强制进入“模拟模式”以防报错，因为没有真实后端
      const isPreview = typeof __firebase_config !== 'undefined';
      
      if (!isPreview) {
         // --- 真实环境逻辑 ---
         try {
           const response = await fetch('/api/notion');
           if (!response.ok) throw new Error("无法连接 Notion API (Vercel Backend)");
           const { projects: notionProjects } = await response.json();
           await syncProjectsToFirebase(notionProjects);
           alert("Notion 同步成功！");
         } catch(e) {
           // 如果真实 API 失败，询问是否用模拟数据（方便调试）
           if(confirm("连接 Notion 失败 (" + e.message + ")。是否写入模拟数据进行测试？")) {
             await useMockData();
           }
         }
      } else {
        // --- 预览/本地开发环境逻辑 ---
        if(confirm("当前为预览/开发环境，无法连接真实 Notion API。是否写入模拟数据进行测试？")) {
           await useMockData();
        }
      }
    } catch (e) {
      alert("操作出错: " + e.message);
    }
  };
  
  const useMockData = async () => {
     const mockProjects = [
       { name: 'Project A: 压缩机组设计', notionId: 'n-123' },
       { name: 'Project B: 燃气轮机维护', notionId: 'n-456' },
       { name: 'Project C: 现场安全巡检', notionId: 'n-789' },
     ];
     await syncProjectsToFirebase(mockProjects);
  };

  const syncProjectsToFirebase = async (newProjects) => {
    let count = 0;
    for (const p of newProjects) {
      const exists = projects.find(existing => existing.name === p.name);
      if (!exists) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
          ...p, 
          createdAt: serverTimestamp()
        });
        count++;
      }
    }
    if (count > 0) alert(`成功导入 ${count} 个新项目！`);
  };

  // --- 辅助 ---
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
    return <span className="font-mono text-4xl font-bold text-slate-800">{elapsed}</span>;
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">连接云端...</div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-0 md:pl-64">
      {/* 导航栏 */}
      <nav className="fixed bottom-0 md:top-0 left-0 w-full md:w-64 bg-white border-t md:border-r border-slate-200 z-50 md:h-full flex md:flex-col justify-around md:justify-start md:p-6 shadow-lg md:shadow-none">
        <div className="hidden md:block mb-8 mt-2">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</h1>
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">当前暗号</p>
            <p className="text-sm text-slate-700 truncate font-medium font-mono tracking-tight">
              {user.email ? user.email.split('@')[0] : 'Anonymous'}
            </p>
          </div>
        </div>
        
        <div className="flex md:flex-col justify-around w-full md:space-y-2">
          <button onClick={() => setView('timer')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'timer' ? 'text-blue-600 bg-blue-50 md:translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Clock size={24} /> <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">计时器</span>
          </button>
          <button onClick={() => setView('dashboard')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'dashboard' ? 'text-blue-600 bg-blue-50 md:translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}>
            <PieChart size={24} /> <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">报表</span>
          </button>
          <button onClick={() => setView('projects')} className={`p-2 md:p-3 rounded-xl flex flex-col md:flex-row md:space-x-3 items-center transition-all ${view === 'projects' ? 'text-blue-600 bg-blue-50 md:translate-x-1' : 'text-slate-400 hover:bg-slate-50'}`}>
            <List size={24} /> <span className="text-[10px] md:text-sm font-medium mt-1 md:mt-0">项目</span>
          </button>
        </div>
        
        <div className="hidden md:block md:mt-auto">
          <button onClick={handleLogout} className="p-3 rounded-xl flex md:space-x-3 items-center text-red-500 hover:bg-red-50 w-full transition-colors">
            <LogOut size={20} /> <span className="font-medium">退出</span>
          </button>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-2xl mx-auto p-4 md:p-8 min-h-screen">
        <header className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-40">
          <div className="flex flex-col">
            <span className="font-bold flex gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</span>
            <span className="text-xs text-slate-400 font-mono">Code: {user.email ? user.email.split('@')[0] : '...'}</span>
          </div>
          <button onClick={handleLogout} className="p-2 bg-slate-100 rounded-full text-slate-500"><LogOut size={18} /></button>
        </header>

        {view === 'timer' && (
          <div className="flex flex-col items-center space-y-6 mt-4">
            <div className="w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center border border-slate-100 relative overflow-hidden">
               {activeLog && <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse-slow"></div>}
               
               <div className="mb-8 flex justify-center">
                 <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${activeLog ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-opacity-20' : 'bg-slate-100 text-slate-500'}`}>
                   {activeLog ? '正在计时' : '空闲'}
                 </span>
               </div>
               
               <div className="mb-10">
                 {activeLog ? <LiveTimer startTime={activeLog.startTime}/> : <span className="text-5xl font-mono font-bold text-slate-200">00:00:00</span>}
               </div>
               
               <select 
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium transition-shadow appearance-none cursor-pointer"
                 value={selectedProjectId}
                 onChange={(e) => setSelectedProjectId(e.target.value)}
                 disabled={!!activeLog}
               >
                 <option value="">-- 选择任务项目 --</option>
                 {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
               
               {activeLog ? (
                 <button onClick={handleStopTimer} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2">
                   <Square size={20} fill="currentColor"/> 结束
                 </button>
               ) : (
                 <button onClick={handleStartTimer} disabled={!selectedProjectId} className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 ${!selectedProjectId ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
                   <Play size={20} fill="currentColor"/> 开始
                 </button>
               )}
            </div>
            
            <div className="w-full">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1 tracking-wider">最近记录</h3>
              <div className="space-y-2">
                {logs.slice(0,3).map(l => (
                  <div key={l.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between text-sm shadow-sm hover:shadow-md transition-shadow">
                    <span className="font-medium text-slate-700">{projects.find(p=>p.id===l.projectId)?.name || '未知项目'}</span>
                    <span className="font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">{formatDuration(l.startTime, l.endTime)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChart className="text-blue-500"/> 工时报表</h2>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-xl shadow-blue-200 mb-6">
              <div className="text-blue-100 text-sm font-medium mb-1">总工时</div>
              <div className="text-5xl font-bold tracking-tight">
                {(logs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0) / 3600000).toFixed(1)} 
                <span className="text-lg font-normal opacity-80 ml-2">hr</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="space-y-4">
                  {projects.map(p => {
                    const projectLogs = logs.filter(l => l.projectId === p.id && l.endTime);
                    const totalMs = projectLogs.reduce((acc, l) => acc + (l.endTime - l.startTime), 0);
                    const hours = (totalMs / 3600000).toFixed(1);
                    const totalAll = logs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0);
                    const percent = totalAll > 0 ? (totalMs / totalAll) * 100 : 0;
                    if (hours === "0.0") return null;
                    return (
                      <div key={p.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700 font-medium">{p.name}</span>
                          <span className="text-slate-500">{hours} hr</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{width: `${percent}%`}}></div>
                        </div>
                      </div>
                    )
                  })}
                  {logs.length === 0 && <p className="text-slate-400 text-center py-4 text-sm">暂无数据</p>}
                </div>
            </div>
          </div>
        )}

        {view === 'projects' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><List className="text-blue-500"/> 项目列表</h2>
              <button onClick={handleImportFromNotion} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors shadow-lg shadow-slate-200"><Database size={16}/> 同步 Notion</button>
            </div>
            
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm mb-6 flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0"/>
              <div>
                <p className="font-bold">数据同步</p>
                <p>在所有设备输入暗号：<span className="font-mono bg-amber-200 px-1 rounded">{user.email ? user.email.split('@')[0] : '...'}</span> 即可连接。</p>
              </div>
            </div>

            <div className="space-y-3">
              {projects.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group">
                  <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                    <Briefcase size={20} className="text-slate-400 group-hover:text-blue-500"/>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-700">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">ID: {p.notionId}</div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                 <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400">暂无项目，请点击上方按钮同步</p>
                 </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}