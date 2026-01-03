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
  Play, Square, Clock, PieChart, Database, List, Briefcase, LogOut, KeyRound, AlertCircle, Zap, Plus, Calendar, BarChart3, ChevronRight, Trash2, FolderTree, FileText, ChevronDown, ChevronUp, Settings, X, GripVertical, AlertTriangle, Check
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
  const [tasks, setTasks] = useState([]); 
  const [logs, setLogs] = useState([]);
  
  // 计时器状态
  const [activeLog, setActiveLog] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(''); 
  const [newTaskName, setNewTaskName] = useState('');
  
  // 视图状态
  const [view, setView] = useState('timer'); 
  const [loading, setLoading] = useState(true);
  const [dashboardTab, setDashboardTab] = useState('week');
  const [expandedProjects, setExpandedProjects] = useState({}); 

  // --- Notion 配置状态 ---
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTarget, setImportTarget] = useState('projects'); // 'projects' | 'tasks'
  const [notionConfig, setNotionConfig] = useState({
    dbId: '',
    titleProp: 'Name', // 标题属性名 (Col Name)
    typeProp: 'Status',  // 类型/分类属性名 (Col Name)
    typePropType: 'select', // Notion 字段的数据类型 (select, status, relation)
    writeBackProp: 'TimeSpent', // 回写时用的属性名
    isRealMode: false // false=模拟模式, true=真实API模式
  });
  const [importLog, setImportLog] = useState(''); 

  // --- 拖拽状态 ---
  const [draggedTaskId, setDraggedTaskId] = useState(null);

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
    const unsubProjects = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'projects')), (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTasks = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks')), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubLogs = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs')), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data(), startTime: d.data().startTime?.toDate(), endTime: d.data().endTime?.toDate() }));
      list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
      setLogs(list);
      const running = list.find(log => !log.endTime);
      setActiveLog(running || null);
      if (running) {
        if (!selectedProjectId) setSelectedProjectId(running.projectId);
        if (!selectedTaskId) setSelectedTaskId(running.taskId || '');
      }
    });
    return () => { unsubProjects(); unsubTasks(); unsubLogs(); };
  }, [user]);

  // --- 计时逻辑 ---
  const handleStartTimer = async () => {
    if (!user || !selectedProjectId) return;
    if (activeLog) return; 

    try {
      let finalTaskId = selectedTaskId;
      let finalTaskName = '';
      if (!selectedTaskId && newTaskName.trim()) {
        const newTaskRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), {
          projectId: selectedProjectId,
          name: newTaskName.trim(),
          notionId: null, 
          createdAt: serverTimestamp()
        });
        finalTaskId = newTaskRef.id;
        finalTaskName = newTaskName.trim();
        setNewTaskName(''); 
      } 
      else if (selectedTaskId) {
        const t = tasks.find(t => t.id === selectedTaskId);
        finalTaskName = t ? t.name : '未知任务';
      } else {
        alert("请选择一个任务或输入新任务名称");
        return;
      }
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), {
        projectId: selectedProjectId,
        taskId: finalTaskId,
        taskName: finalTaskName, 
        startTime: serverTimestamp(),
        endTime: null,
      });
      setSelectedTaskId(finalTaskId); 
    } catch (e) {
      alert("开始失败：" + e.message);
    }
  };

  const handleStopTimer = async () => {
    if (!user || !activeLog) return;
    try {
      const endTime = new Date();
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), { endTime: endTime });
      
      const task = tasks.find(t => t.id === activeLog.taskId);
      const project = projects.find(p => p.id === activeLog.projectId);
      
      // 触发回写
      if (task?.notionId || project?.notionId) {
        const durationMin = ((endTime - activeLog.startTime) / 1000 / 60).toFixed(1);
        await syncBackToNotion(task, project, durationMin);
      }
    } catch (e) { console.error("停止失败:", e); }
  };

  const handleDeleteLog = async (logId) => { if(confirm("确定删除?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', logId)); };
  const handleDeleteProject = async (projId) => { if(confirm("警告：删除项目可能导致关联任务孤立，确定继续?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', projId)); };
  const handleDeleteTask = async (taskId) => { if(confirm("确定删除任务?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId)); };

  // --- 拖拽逻辑 (HTML5 DnD) ---
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e) => {
    e.preventDefault(); // 允许放置
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, targetProjectId) => {
    e.preventDefault();
    if (!draggedTaskId || !targetProjectId) return;
    try {
      const taskRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', draggedTaskId);
      await updateDoc(taskRef, { projectId: targetProjectId });
      setExpandedProjects(prev => ({ ...prev, [targetProjectId]: true }));
    } catch (err) {
      alert("移动失败");
    }
    setDraggedTaskId(null);
  };

  // --- 导入功能 ---
  const openImportModal = (target) => {
    setImportTarget(target);
    setImportLog('');
    // 默认配置建议
    setNotionConfig(prev => ({
      ...prev,
      titleProp: target === 'projects' ? 'Project Name' : 'Task Name',
      typeProp: target === 'projects' ? 'Status' : 'Project Relation',
      typePropType: target === 'projects' ? 'select' : 'relation', // 默认类型
    }));
    setImportModalOpen(true);
  };

  const executeImport = async (e) => {
    e.preventDefault();
    setImportLog('开始连接...');
    
    const { dbId, titleProp, typeProp, typePropType, isRealMode } = notionConfig;

    if (!isRealMode) {
      // --- 模拟模式 (演示用) ---
      setImportLog('模式: 模拟演示 (无需后端)');
      setTimeout(() => {
        if (importTarget === 'projects') {
          const mockProjects = [
            { [titleProp]: 'P-101: 压缩机组设计', [typeProp]: '进行中', id: 'mock-p-1' },
            { [titleProp]: 'T-204: 燃气轮机大修', [typeProp]: '计划中', id: 'mock-p-2' },
          ];
          processImportData(mockProjects, titleProp, typeProp, typePropType);
        } else {
          // 导入任务
          if (projects.length === 0) {
            setImportLog('错误: 请先导入项目');
            return;
          }
          const pid = projects[0].id;
          const mockTasks = [
            { [titleProp]: '绘制 PID 图', [typeProp]: '待办', id: 'mock-t-1', projectId: pid },
            { [titleProp]: '编写规格书', [typeProp]: '进行中', id: 'mock-t-2', projectId: pid },
          ];
          processImportData(mockTasks, titleProp, typeProp, typePropType);
        }
      }, 800);
      return;
    }

    // --- 真实模式 ---
    setImportLog(`正在请求 Netlify Function (${dbId})...`);
    try {
      // 自动适配 Netlify Function 路径
      // 本地开发通常是 /api/notion 或 /.netlify/functions/notion
      // 如果 404，说明 functions 没部署成功
      const functionUrl = window.location.hostname.includes('localhost') 
        ? '/.netlify/functions/notion' // 本地 vite 代理或 netlify dev
        : '/.netlify/functions/notion'; // 生产环境标准路径

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: dbId })
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("404: 找不到 Netlify Function。请确保 'netlify/functions/notion.js' 文件已部署。");
        if (res.status === 500) throw new Error("500: 服务器错误。请检查 Netlify 环境变量 NOTION_API_KEY 是否设置。");
        throw new Error(`HTTP 错误: ${res.status}`);
      }

      const data = await res.json();
      setImportLog(`连接成功! 获取到 ${data.results?.length || 0} 条数据，正在解析...`);
      
      const parsedData = data.results.map(page => {
        const props = page.properties;
        
        // 解析标题
        const titleObj = props[titleProp];
        const titleValue = titleObj?.title?.[0]?.plain_text || titleObj?.rich_text?.[0]?.plain_text || '未命名';
        
        // 解析类型/分类 (根据用户选择的 Notion 类型进行解析)
        let typeValue = '默认';
        const typeObj = props[typeProp];
        
        if (typeObj) {
           if (typePropType === 'select') typeValue = typeObj.select?.name;
           else if (typePropType === 'status') typeValue = typeObj.status?.name;
           else if (typePropType === 'multi_select') typeValue = typeObj.multi_select?.[0]?.name;
           else if (typePropType === 'relation') typeValue = typeObj.relation?.[0]?.id; // 暂时只取 ID
        }

        return {
          [titleProp]: titleValue,
          [typeProp]: typeValue || '无',
          id: page.id
        };
      });

      processImportData(parsedData, titleProp, typeProp, typePropType);

    } catch (err) {
      setImportLog(`同步失败: ${err.message}`);
      console.error(err);
    }
  };

  const processImportData = async (dataList, titleKey, typeKey, typePropType) => {
    let count = 0;
    try {
      if (importTarget === 'projects') {
        for (const item of dataList) {
          const name = item[titleKey];
          const type = item[typeKey]; 
          if (name && !projects.find(p => p.notionId === item.id)) {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { 
              name, 
              tags: type ? [type] : [],
              notionId: item.id, 
              createdAt: serverTimestamp() 
            });
            count++;
          }
        }
      } else {
        // 导入任务逻辑
        // 如果用户选择了 'relation' 类型，说明 Notion 里的任务已经关联了项目
        // 这是一个高级功能：尝试通过 Relation ID 匹配本地项目
        
        // 默认兜底项目
        let defaultProjId = projects[0]?.id;
        if (!defaultProjId) {
             const newP = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { name: '导入缓冲池', notionId: 'buffer', createdAt: serverTimestamp() });
             defaultProjId = newP.id;
        }

        for (const item of dataList) {
           const name = item[titleKey];
           let targetProjectId = defaultProjId;
           
           // 尝试匹配关联项目
           if (typePropType === 'relation') {
              const relationId = item[typeKey]; // 这里存的是 Notion Page ID
              const linkedProj = projects.find(p => p.notionId === relationId);
              if (linkedProj) targetProjectId = linkedProj.id;
           }

           if (name && !tasks.find(t => t.notionId === item.id)) {
             await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { 
               name, 
               notionId: item.id, 
               projectId: targetProjectId,
               createdAt: serverTimestamp() 
             });
             count++;
           }
        }
      }
      setImportLog(`同步完成! 成功导入 ${count} 条新数据。`);
    } catch (e) {
      setImportLog(`写入数据库出错: ${e.message}`);
    }
  };

  const syncBackToNotion = async (task, project, duration) => {
    // 模拟回写
    const targetName = task?.name || project?.name;
    const targetId = task?.notionId || project?.notionId;
    const propName = notionConfig.writeBackProp; 

    const msg = document.createElement('div');
    msg.innerHTML = `
      <div class="font-bold">[Notion Sync]</div>
      <div class="text-xs">目标: ${targetName}</div>
      <div class="text-xs">列名: ${propName}</div>
      <div class="text-xs">增加: +${duration} min</div>
      ${notionConfig.isRealMode ? '<div class="text-xs text-yellow-300 mt-1">调用 Function...</div>' : '<div class="text-xs text-slate-300 mt-1">(模拟模式)</div>'}
    `;
    msg.className = "fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl z-50 animate-fade-in border-l-4 border-purple-500";
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);

    if (notionConfig.isRealMode && targetId) {
        // 调用写回 Function
        try {
            await fetch('/.netlify/functions/notion-update', {
                method: 'POST',
                body: JSON.stringify({ pageId: targetId, property: propName, value: parseFloat(duration) })
            });
        } catch(e) { console.error("Writeback failed", e); }
    }
  };

  // --- 报表筛选 ---
  const getFilteredLogs = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoffDate = startOfDay;
    if (dashboardTab === 'week') {
      const day = now.getDay() || 7;
      if (day !== 1) cutoffDate.setHours(-24 * (day - 1));
    } else if (dashboardTab === 'month') cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (dashboardTab === 'year') cutoffDate = new Date(now.getFullYear(), 0, 1);
    return logs.filter(log => log.endTime && log.startTime >= cutoffDate);
  };

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
    useEffect(() => { const interval = setInterval(() => setElapsed(formatDuration(startTime)), 1000); return () => clearInterval(interval); }, [startTime]);
    return <span className="font-mono text-5xl font-bold text-slate-800 tracking-tight">{elapsed}</span>;
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">加载中...</div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-0 md:pl-64 relative">
      
      {/* --- Notion 导入配置 Modal (升级版) --- */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings size={20}/> 配置导入: {importTarget === 'projects' ? '项目库' : '任务库'}
              </h3>
              <button onClick={() => setImportModalOpen(false)} className="hover:bg-white/20 p-1 rounded transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg mb-6 text-sm text-amber-900 flex gap-3">
                 <AlertTriangle className="shrink-0 mt-0.5" size={18}/>
                 <div>
                   <p className="font-bold">部署提示 (Netlify)</p>
                   <p className="mt-1 text-xs">若报 404 错误，请检查项目根目录是否存在 <code>netlify/functions/notion.js</code> 文件，并确保 <code>NOTION_API_KEY</code> 环境变量已设置。</p>
                 </div>
              </div>

              <form onSubmit={executeImport} className="space-y-5">
                {/* 模式切换 */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                   <button type="button" onClick={() => setNotionConfig(c => ({...c, isRealMode: false}))} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!notionConfig.isRealMode ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>模拟演示模式</button>
                   <button type="button" onClick={() => setNotionConfig(c => ({...c, isRealMode: true}))} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${notionConfig.isRealMode ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}>真实 API 模式</button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notion Database ID</label>
                  <input 
                    type="text" 
                    placeholder="例如: a8aec43384f4..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    value={notionConfig.dbId}
                    onChange={(e) => setNotionConfig({...notionConfig, dbId: e.target.value})}
                  />
                </div>

                {/* 字段映射配置 */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase border-b border-slate-200 pb-2">字段映射 (Field Mapping)</h4>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">标题/名称 (Title)</label>
                    <input 
                      type="text" 
                      placeholder="例: Name, Task Name" 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={notionConfig.titleProp}
                      onChange={(e) => setNotionConfig({...notionConfig, titleProp: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">类型/状态列名</label>
                       <input 
                         type="text" 
                         placeholder="例: Status, Project" 
                         className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                         value={notionConfig.typeProp}
                         onChange={(e) => setNotionConfig({...notionConfig, typeProp: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notion 属性类型</label>
                       <select 
                         className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                         value={notionConfig.typePropType}
                         onChange={(e) => setNotionConfig({...notionConfig, typePropType: e.target.value})}
                       >
                         <option value="select">Select (单选)</option>
                         <option value="status">Status (状态)</option>
                         <option value="multi_select">Multi-Select (多选)</option>
                         <option value="relation">Relation (关联)</option>
                       </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-2">
                   <label className="block text-xs font-bold text-purple-600 uppercase mb-2">回写设置 (Write Back)</label>
                   <p className="text-xs text-slate-400 mb-2">请在 Notion 中手动创建一个 <b>Number</b> 类型的列，并填入其名称：</p>
                   <input 
                      type="text" 
                      placeholder="例: TimeSpent (单位:分钟)" 
                      className="w-full bg-purple-50 border border-purple-100 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                      value={notionConfig.writeBackProp}
                      onChange={(e) => setNotionConfig({...notionConfig, writeBackProp: e.target.value})}
                    />
                </div>

                {/* 运行日志区 */}
                <div className="bg-slate-900 text-green-400 font-mono text-xs p-3 rounded-lg h-24 overflow-y-auto whitespace-pre-wrap border border-slate-700">
                  {importLog || '> 等待指令...'}
                </div>

                <div className="flex gap-3">
                  <button type="submit" className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition ${notionConfig.isRealMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {notionConfig.isRealMode ? '连接真实数据库' : '运行模拟导入'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
            <FolderTree size={22} /> <span className="text-[10px] md:text-sm mt-1 md:mt-0">项目与任务</span>
          </button>
        </div>
        
        <div className="hidden md:block md:mt-auto">
          <button onClick={() => signOut(auth)} className="p-3 rounded-xl flex md:space-x-3 items-center text-red-500 hover:bg-red-50 w-full transition-colors">
            <LogOut size={20} /> <span className="font-medium">退出系统</span>
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-4 md:p-8 min-h-screen">
        <header className="md:hidden flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-40">
          <span className="font-bold flex gap-2 text-slate-800"><Clock className="text-blue-600"/> EngTimer</span>
          <button onClick={() => signOut(auth)} className="p-2 bg-slate-100 rounded-full text-slate-500"><LogOut size={18} /></button>
        </header>

        {view === 'timer' && (
          <div className="flex flex-col items-center space-y-6 mt-4 animate-fade-in">
            <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 text-center border border-slate-100 relative overflow-hidden">
               {activeLog && <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500 animate-pulse-slow"></div>}
               <div className="mb-6 flex justify-center">
                 <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${activeLog ? 'bg-green-100 text-green-700 ring-1 ring-green-500' : 'bg-slate-100 text-slate-500'}`}>
                   {activeLog ? <><span className="w-2 h-2 rounded-full bg-green-500 animate-ping"/> 进行中</> : '准备就绪'}
                 </span>
               </div>
               <div className="mb-8">{activeLog ? <LiveTimer startTime={activeLog.startTime}/> : <span className="text-6xl font-mono font-bold text-slate-200 tracking-tight">00:00:00</span>}</div>
               <div className="space-y-4 mb-8 text-left">
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Briefcase size={12}/> 选择项目 (Project)</label>
                   <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-bold transition-all" value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); setSelectedTaskId(''); }} disabled={!!activeLog}>
                     <option value="">-- 请先选择项目 --</option>
                     {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
                 <div className={`transition-opacity duration-300 ${selectedProjectId ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                   <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><FileText size={12}/> 选择或新建任务 (Task)</label>
                   <div className="flex gap-2">
                     <select className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium transition-all" value={selectedTaskId} onChange={(e) => { setSelectedTaskId(e.target.value); setNewTaskName(''); }} disabled={!!activeLog}>
                        <option value="">-- 新建/选择任务 --</option>
                        {tasks.filter(t => t.projectId === selectedProjectId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                     </select>
                   </div>
                   {!selectedTaskId && <input type="text" className="w-full mt-2 p-3 bg-white border-2 border-dashed border-slate-200 rounded-xl outline-none focus:border-blue-400 text-slate-700 text-sm transition-all placeholder:text-slate-400" placeholder="输入新任务名称..." value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} disabled={!!activeLog}/>}
                 </div>
               </div>
               {activeLog ? (
                 <button onClick={handleStopTimer} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-lg"><Square size={24} fill="currentColor"/> 结束并存档</button>
               ) : (
                 <button onClick={handleStartTimer} disabled={!selectedProjectId || (!selectedTaskId && !newTaskName)} className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 text-lg ${(!selectedProjectId || (!selectedTaskId && !newTaskName)) ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}><Play size={24} fill="currentColor"/> 开始计时</button>
               )}
            </div>
            <div className="w-full">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 ml-1 tracking-wider">今日动态</h3>
              <div className="space-y-2">
                {logs.slice(0,5).map(l => (
                  <div key={l.id} className="bg-white p-3 pr-2 rounded-xl border border-slate-100 flex justify-between items-center text-sm shadow-sm hover:shadow-md transition-shadow group">
                    <div>
                      <div className="font-bold text-slate-700 flex items-center gap-2">{projects.find(p=>p.id===l.projectId)?.name || '未知项目'}</div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><FileText size={10}/> {l.taskName || '无描述'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="font-mono text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">{formatDuration(l.startTime, l.endTime)}</div>
                       {!l.endTime ? <span className="text-[10px] text-green-500 font-bold uppercase block">Running</span> : <button onClick={() => handleDeleteLog(l.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={16}/></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChart className="text-blue-600"/> 统计看板</h2>
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
              {['day', 'week', 'month', 'year'].map(tab => (
                <button key={tab} onClick={() => setDashboardTab(tab)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize ${dashboardTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'day' ? '今日' : tab === 'week' ? '本周' : tab === 'month' ? '本月' : '全年'}</button>
              ))}
            </div>
            {(() => {
              const filteredLogs = getFilteredLogs();
              const totalMs = filteredLogs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0);
              const stats = {};
              filteredLogs.forEach(l => { if(!l.endTime) return; const pid = l.projectId; if(!stats[pid]) stats[pid] = 0; stats[pid] += (l.endTime - l.startTime); });
              return (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-6 rounded-2xl shadow-xl shadow-blue-200 mb-6">
                    <div className="flex justify-between items-start">
                      <div><div className="text-blue-100 text-sm font-medium mb-1 capitalize">{dashboardTab} 总工时</div><div className="text-5xl font-bold tracking-tight">{(totalMs / 3600000).toFixed(1)} <span className="text-xl font-normal opacity-80">hr</span></div></div>
                      <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm"><Calendar size={24} className="text-white"/></div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                      <div className="space-y-5">
                        {Object.entries(stats).sort(([,a], [,b]) => b - a).map(([pid, ms]) => {
                          const pName = projects.find(p => p.id === pid)?.name || '未知项目';
                          const pct = totalMs > 0 ? (ms / totalMs) * 100 : 0;
                          return (
                            <div key={pid}>
                              <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-700 font-bold">{pName}</span><span className="text-slate-500 font-mono">{(ms / 3600000).toFixed(1)} hr</span></div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{width: `${pct}%`}}></div></div>
                            </div>
                          )
                        })}
                         {Object.keys(stats).length === 0 && <div className="py-8 text-center text-slate-400">暂无数据</div>}
                      </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {view === 'projects' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FolderTree className="text-blue-600"/> 项目与任务</h2>
            
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold flex items-center gap-2"><Database size={18}/> Notion 数据同步</span>
                <span className="text-[10px] bg-slate-700 px-2 py-1 rounded">Mapping Config</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openImportModal('projects')} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10">1. 配置并导入项目</button>
                <button onClick={() => openImportModal('tasks')} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10">2. 配置并导入任务</button>
              </div>
            </div>

            <form onSubmit={async (e) => { e.preventDefault(); const name = e.target.pname.value; if(!name) return; await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { name, notionId: null, createdAt: serverTimestamp() }); e.target.reset(); }} className="flex gap-2 mb-6">
               <input name="pname" type="text" placeholder="新建本地项目..." className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"/>
               <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Plus/></button>
            </form>

            <div className="space-y-4">
              {projects.map(p => {
                const isExpanded = expandedProjects[p.id];
                const pTasks = tasks.filter(t => t.projectId === p.id);
                
                // 处理拖拽放入
                const isDropTarget = draggedTaskId && draggedTaskId !== p.id; // 简单判断，这里只要有拖拽就开始监听

                return (
                  <div 
                    key={p.id} 
                    className={`bg-white rounded-xl border transition-colors shadow-sm overflow-hidden ${isDropTarget ? 'border-dashed border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, p.id)}
                  >
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedProjects(prev => ({...prev, [p.id]: !prev[p.id]}))}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={18} className="text-slate-400"/> : <ChevronRight size={18} className="text-slate-400"/>}
                        <div className={`p-2 rounded-lg ${p.notionId ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}><Briefcase size={18}/></div>
                        <div>
                           <div className="font-bold text-slate-700 flex items-center gap-2">
                             {p.name}
                             {p.tags && p.tags.map(tag => <span key={tag} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-normal">{tag}</span>)}
                           </div>
                           <div className="text-xs text-slate-400 flex items-center gap-2">{p.notionId ? 'Notion Linked' : 'Local Project'} • {pTasks.length} 个任务</div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                    </div>
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100 p-4 pl-12 space-y-2">
                         {pTasks.map(t => (
                           <div 
                             key={t.id} 
                             className="flex justify-between items-center text-sm group p-2 rounded hover:bg-white cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 transition-all"
                             draggable
                             onDragStart={(e) => handleDragStart(e, t.id)}
                           >
                             <div className="flex items-center gap-2">
                               <GripVertical size={14} className="text-slate-300"/>
                               <FileText size={14} className="text-slate-400"/>
                               <span className="text-slate-600">{t.name}</span>
                               {t.notionId && <Zap size={10} className="text-green-500"/>}
                             </div>
                             <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                           </div>
                         ))}
                         {pTasks.length === 0 && <div className="text-xs text-slate-400 italic pl-6 py-2">暂无任务，拖拽任务至此或新建</div>}
                         <button onClick={() => { const n = prompt("输入新任务名称:"); if(n) addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { projectId: p.id, name: n, notionId: null, createdAt: serverTimestamp() }); }} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-2 font-bold pl-1"><Plus size={12}/> 新建任务</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}