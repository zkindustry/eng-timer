
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AnalysisView from './components/AnalysisView';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import ActiveTimer from './components/ActiveTimer';
import { firebaseConfig as localConfig, appId as localAppId } from './config';
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
  getDoc,
  setDoc
} from 'firebase/firestore';
import {
  Play,
  Square,
  Clock,
  Database,
  List,
  Briefcase,
  LogOut,
  Zap,
  Plus,
  Calendar as CalendarIcon,
  BarChart3,
  ChevronRight,
  Trash2,
  Settings,
  X,
  GripVertical,
  Check,
  Search,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Columns,
  TrendingUp,
  Activity,
  MoreHorizontal,
  CalendarDays,
  Pencil,
  Save,
  Link,
  Tag
} from 'lucide-react';

// --- 1. Firebase Config ---
let firebaseConfig;
let appId;

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} else {
  firebaseConfig = localConfig;
  appId = localAppId;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const defaultNotionConfig = {
  isRealMode: true,
  writeBackProp: 'TimeSpent',
  defaultUnassignedProjectName: 'Other',
  projectDatabases: [
    { id: '', name: 'Project DB 1', titleProp: 'Title', statusProp: 'Status', categoryProp: 'Category' }
  ],
  taskDatabases: [
    { id: '', name: 'Task DB 1', titleProp: 'Title', statusProp: 'Status', projectProp: 'Project' }
  ]
};

const normalizeNotionId = (input) => {
  if (!input) return '';
  const match = input.match(/[0-9a-f]{32}/i);
  if (match) {
    const raw = match[0].toLowerCase();
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return input.trim();
};

const getBeijingNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));

const normalizeStatus = (status = '') => {
  const map = {
    '进行中': 'In Progress',
    '正在进行': 'In Progress',
    '暂停': 'Paused',
    '挂起': 'Paused',
    '完成': 'Done',
    '已完成': 'Done',
    '规划中': 'Planned',
    '计划中': 'Planned'
  };
  if (!status) return 'To Do';
  return map[status] || status;
};

const notionColors = {
  default: '#94a3b8', // slate-400
  gray: '#64748b', // slate-500
  brown: '#92400e', // amber-800
  orange: '#f97316', // orange-500
  yellow: '#eab308', // yellow-500
  green: '#22c55e', // green-500
  blue: '#3b82f6', // blue-500
  purple: '#a855f7', // purple-500
  pink: '#ec4899', // pink-500
  red: '#ef4444', // red-500
};

const statusOptions = ['To Do', 'In Progress', 'Paused', 'Planned', 'Done'];

// --- 2. Auth Screen ---
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
        <div className="flex justify-center mb-6 text-blue-600"><Zap size={32} fill="currentColor" /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">EngTimer Pro</h1>
        <p className="text-sm text-slate-500 mb-8">工程项目与时间管理中心</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" required placeholder="邮箱 (Email)" className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" required placeholder="密码 (Password)" className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={e => setPassword(e.target.value)} />
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

// --- 3. Main App ---
export default function TimeTrackerApp() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeLog, setActiveLog] = useState(null);
  const [view, setView] = useState('projects'); // 'projects', 'tasks', 'calendar', 'dashboard'
  const [searchQuery, setSearchQuery] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  // Tagging State
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagForm, setTagForm] = useState({ id: null, tags: [], notes: '' });

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [notionConfig, setNotionConfig] = useState(defaultNotionConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [importLog, setImportLog] = useState('');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ id: null, name: '', status: 'To Do', category: 'General', notionId: null, notionDatabaseId: '', targetDbId: '', isOtherBucket: false });
  const [taskForm, setTaskForm] = useState({ id: null, title: '', status: 'To Do', projectId: '', projectIds: [], projectName: '', projectNotionId: null, notionId: null, notionDatabaseId: '', targetDbId: '' });


  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [dragTask, setDragTask] = useState(null);

  // 1. Auth & Data Listeners
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) { console.error(e); }
      }
    };
    initAuth();
    const sub = onAuthStateChanged(auth, u => setUser(u));
    return () => sub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const qP = query(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'));
    const subP = onSnapshot(qP, s => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qT = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'));
    const subT = onSnapshot(qT, s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qL = query(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'));
    const subL = onSnapshot(qL, s => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data(), startTime: d.data().startTime?.toDate(), endTime: d.data().endTime?.toDate() }));
      setLogs(list.sort((a, b) => b.startTime - a.startTime));
      setActiveLog(list.find(l => !l.endTime) || null);
    });
    return () => { subP(); subT(); subL(); };
  }, [user]);

  // Load saved Notion configuration
  useEffect(() => {
    if (!user) return;
    const loadConfig = async () => {
      try {
        const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'notion');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setNotionConfig({ ...defaultNotionConfig, ...snap.data() });
        }
      } catch (e) {
        console.error('Load config failed', e);
      }
    };
    loadConfig();
  }, [user]);

  // 保证只有一个“其他”项目存在
  useEffect(() => {
    if (!user) return;
    const others = projects.filter(p => p.isOtherBucket);
    if (others.length > 1) {
      others.slice(1).forEach(extra => {
        deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', extra.id)).catch(() => { });
      });
    }
  }, [projects, user]);

  // --- Helpers ---
  const showToast = (msg, type = 'info') => {
    const el = document.createElement('div');
    const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-slate-800';
    el.className = `fixed bottom-4 right-4 ${color} text-white px-4 py-3 rounded-lg shadow-xl z-[999] animate-fade-in text-sm font-bold flex items-center gap-2`;
    el.innerHTML = type === 'loading' ? `<span class="animate-spin">⏳</span> ${msg}` : msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  const enhancedProjects = useMemo(() => projects.map(p => ({
    ...p,
    statusNormalized: normalizeStatus(p.status || 'To Do')
  })), [projects]);

  const enhancedTasks = useMemo(() => tasks.map(t => ({
    ...t,
    statusNormalized: normalizeStatus(t.status || 'To Do'),
    projectIds: t.projectIds && t.projectIds.length ? t.projectIds : (t.projectId ? [t.projectId] : [])
  })), [tasks]);

  const filteredProjects = useMemo(() => {
    return enhancedProjects.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [enhancedProjects, searchQuery]);

  const filteredTasks = useMemo(() => {
    return enhancedTasks
      .filter(t => (t.title || '').toLowerCase().includes(taskSearch.toLowerCase()))
      .filter(t => taskStatusFilter === 'all' ? true : (t.statusNormalized || '').toLowerCase() === taskStatusFilter.toLowerCase());
  }, [enhancedTasks, taskSearch, taskStatusFilter]);

  const toggleSelectProject = (id) => {
    setSelectedProjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectTask = (id) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectLog = (id) => {
    setSelectedLogIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const cycleStatus = (current) => {
    const normalized = normalizeStatus(current);
    const idx = statusOptions.findIndex(s => s.toLowerCase() === normalized.toLowerCase());
    const next = idx >= 0 ? statusOptions[(idx + 1) % statusOptions.length] : statusOptions[0];
    return next;
  };

  const pushProjectToNotion = async (project, dataPatch) => {
    if (!notionConfig.isRealMode || !project.notionId) return;
    const dbConf = notionConfig.projectDatabases.find(d => d.id === project.notionDatabaseId) || notionConfig.projectDatabases.find(d => d.id);
    if (!dbConf) return;
    const properties = {};
    if (dataPatch.name !== undefined) properties[dbConf.titleProp] = { title: [{ text: { content: dataPatch.name } }] };
    if (dataPatch.status !== undefined) properties[dbConf.statusProp] = { select: { name: dataPatch.status } };
    if (dataPatch.category !== undefined) properties[dbConf.categoryProp] = { select: { name: dataPatch.category } };
    if (Object.keys(properties).length === 0) return;
    await fetch('/.netlify/functions/notion-page-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: project.notionId, properties })
    });
  };

  const pushTaskToNotion = async (task, dataPatch, projectIdsForRelation = null) => {
    if (!notionConfig.isRealMode || !task.notionId) return;
    const dbConf = notionConfig.taskDatabases.find(d => d.id === task.notionDatabaseId) || notionConfig.taskDatabases.find(d => d.id);
    if (!dbConf) return;
    const properties = {};
    if (dataPatch.title !== undefined) properties[dbConf.titleProp] = { title: [{ text: { content: dataPatch.title } }] };
    if (dataPatch.status !== undefined) properties[dbConf.statusProp] = { select: { name: dataPatch.status } };
    if (projectIdsForRelation) {
      const relations = projectIdsForRelation
        .map(pid => projects.find(p => p.id === pid)?.notionId)
        .filter(Boolean)
        .map(id => ({ id }));
      properties[dbConf.projectProp] = { relation: relations };
    }
    if (Object.keys(properties).length === 0) return;
    await fetch('/.netlify/functions/notion-page-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: task.notionId, properties })
    });
  };

  const updateProjectInline = async (project, patch) => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', project.id), { ...patch, updatedAt: serverTimestamp() });
    await pushProjectToNotion(project, patch);
  };

  const updateTaskInline = async (task, patch, relationIds) => {
    const updatePayload = { ...patch, updatedAt: serverTimestamp() };
    if (relationIds && relationIds.length) {
      const primary = projects.find(p => p.id === relationIds[0]);
      updatePayload.projectIds = relationIds;
      if (primary) {
        updatePayload.projectId = primary.id;
        updatePayload.projectName = primary.name;
        updatePayload.projectNotionId = primary.notionId || null;
      }
    }
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), updatePayload);
    await pushTaskToNotion(task, patch, relationIds || task.projectIds || [task.projectId]);
  };

  const clearAllTasks = async () => {
    if (!window.confirm('清空所有任务？此操作不可恢复')) return;
    await Promise.all(tasks.map(t => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id))));
    setSelectedTaskIds([]);
  };

  const clearAllProjects = async () => {
    if (!window.confirm('清空所有项目（保留一个其他）？')) return;
    const others = projects.filter(p => p.isOtherBucket);
    const keep = others[0];
    const deletable = projects.filter(p => !p.isOtherBucket);
    await Promise.all(deletable.map(p => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', p.id))));
    const other = keep || await ensureOtherProject();
    await Promise.all(tasks.map(t => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id), {
      projectId: other.id,
      projectIds: [other.id],
      projectName: other.name,
      projectNotionId: other.notionId || null
    })));
    setSelectedProjectIds([]);
  };

  const clearAllLogs = async () => {
    if (!window.confirm('清空所有记录？此操作不可恢复')) return;
    await Promise.all(logs.map(l => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', l.id))));
    setSelectedLogIds([]);
  };

  const deleteSelectedProjects = async () => {
    if (!selectedProjectIds.length) return;
    if (!window.confirm('删除选中的项目？')) return;
    for (const id of selectedProjectIds) {
      const proj = projects.find(p => p.id === id);
      if (proj?.isOtherBucket) continue;
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', id));
      const other = await ensureOtherProject();
      const related = tasks.filter(t => (t.projectIds || [t.projectId]).includes(id));
      await Promise.all(related.map(t => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id), {
        projectId: other.id,
        projectIds: [other.id],
        projectName: other.name,
        projectNotionId: other.notionId || null
      })));
    }
    setSelectedProjectIds([]);
  };

  const deleteSelectedTasks = async () => {
    if (!selectedTaskIds.length) return;
    if (!window.confirm('删除选中的任务？')) return;
    for (const id of selectedTaskIds) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', id));
    }
    setSelectedTaskIds([]);
  };

  const deleteSelectedLogs = async () => {
    if (!selectedLogIds.length) return;
    if (!window.confirm('删除选中的记录？')) return;
    for (const id of selectedLogIds) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', id));
    }
    setSelectedLogIds([]);
  };

  const ensureOtherProject = async () => {
    const existing = projects.find(p => p.isOtherBucket);
    if (existing) return existing;
    const payload = {
      name: notionConfig.defaultUnassignedProjectName || 'Other',
      status: 'To Do',
      category: 'General',
      isOtherBucket: true,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), payload);
    return { id: ref.id, ...payload };
  };

  // --- Timer Logic ---
  const toggleTimer = async (target, type = 'project') => {
    if (activeLog) {
      // Check if we are toggling the SAME active item
      const isSame = type === 'project'
        ? activeLog.projectId === target.id
        : activeLog.taskId === target.id;

      if (isSame) {
        await stopTimer();
      } else {
        await stopTimer();
        await startTimer(target, type);
      }
    } else {
      await startTimer(target, type);
    }
  };

  const startTimer = async (target, type = 'project') => {
    try {
      let payload = {
        startTime: serverTimestamp(),
        endTime: null,
        tags: []
      };

      if (type === 'project') {
        payload = {
          ...payload,
          projectId: target.id,
          projectName: target.name,
          category: target.category || 'Uncategorized',
          color: target.color || '#cbd5e1'
        };
      } else {
        // Task Based
        const project = projects.find(p => p.id === target.projectId) || (target.projectIds?.length ? projects.find(p => p.id === target.projectIds[0]) : null);
        const fallbackColor = '#cbd5e1';

        payload = {
          ...payload,
          taskId: target.id,
          taskTitle: target.title,
          projectId: project?.id || null,
          projectName: project?.name || 'Unknown Project',
          category: project?.category || 'Uncategorized',
          color: project?.color || fallbackColor,
          // Store raw Relation IDs if needed for Sync
          projectNotionId: project?.notionId || null
        };
      }

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), payload);
    } catch (e) { alert(e.message); }
  };

  const stopTimer = async () => {
    if (!activeLog) return;
    const endTime = new Date();
    // Calculate duration in minutes
    const start = activeLog.startTime?.toDate ? activeLog.startTime.toDate() : new Date(activeLog.startTime);
    const durationMin = ((endTime - start) / 1000 / 60);

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', activeLog.id), { endTime });

      // Sync to Notion (Project Level)
      if (activeLog.projectId) {
        const project = projects.find(p => p.id === activeLog.projectId);
        if (project?.notionId) {
          await syncToNotion(project.notionId, durationMin, project.name);
        }
      }

      // Sync to Notion (Task Level - Optional, if Task has its own sync logic?)
      // Currently the user requirement "Task-based timing" implies we should probably sync to the task too if it has a property?
      // For now, adhering to existing "Project WriteBack".

    } catch (e) { console.error(e); }
  };

  const syncToNotion = async (pageId, durationAdd, name) => {
    if (!notionConfig.isRealMode) {
      showToast(`[模拟] ${name}: +${durationAdd.toFixed(1)}min`);
      return;
    }
    const propertyName = notionConfig.writeBackProp || 'TimeSpent';
    showToast(`正在同步 ${name}...`, 'loading');
    const endpoint = '/.netlify/functions/notion-update';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, property: propertyName, value: durationAdd })
      });
      if (!res.ok) throw new Error("API Error");
      showToast(`同步成功!`, 'success');
    } catch (e) {
      // Don't show error toast for sync failure to avoid spamming if frequent, 
      // or show mild error. User asked for "Debug", so let's show it.
      showToast(`同步失败: ${e.message}`, 'error');
    }
  };

  // --- Project CRUD ---
  const openProjectModal = (project = null) => {
    const defaultDb = project?.notionDatabaseId || notionConfig.projectDatabases.find(d => d.id)?.id || '';
    setProjectForm({
      id: project?.id || null,
      name: project?.name || '',
      status: project?.status || 'To Do',
      category: project?.category || 'General',
      notionId: project?.notionId || null,
      notionDatabaseId: project?.notionDatabaseId || '',
      targetDbId: defaultDb,
      color: project?.color || '#3b82f6', // Default blue-500
      isOtherBucket: !!project?.isOtherBucket
    });
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e?.preventDefault();
    if (!projectForm.name.trim()) return;
    const targetDb = notionConfig.projectDatabases.find(d => d.id === projectForm.targetDbId);

    const payload = {
      name: projectForm.name.trim(),
      status: normalizeStatus(projectForm.status || 'To Do'),
      category: projectForm.category || 'General',
      color: projectForm.color || '#3b82f6',
      notionId: projectForm.notionId || null,
      notionDatabaseId: projectForm.notionDatabaseId || projectForm.targetDbId || '',
      isOtherBucket: !!projectForm.isOtherBucket,
      updatedAt: serverTimestamp()
    };

    try {
      let docId = projectForm.id;
      if (projectForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', projectForm.id), payload);
      } else {
        const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { ...payload, createdAt: serverTimestamp() });
        docId = ref.id;
      }

      if (notionConfig.isRealMode && targetDb?.id) {
        const properties = {
          [targetDb.titleProp]: { title: [{ text: { content: payload.name } }] },
          [targetDb.statusProp]: { select: { name: payload.status } },
          [targetDb.categoryProp]: { select: { name: payload.category } }
        };

        if (payload.notionId) {
          await fetch('/.netlify/functions/notion-page-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: payload.notionId, properties })
          });
        } else {
          const res = await fetch('/.netlify/functions/notion-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ databaseId: targetDb.id, properties })
          });
          if (res.ok) {
            const data = await res.json();
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', docId), {
              notionId: data.id,
              notionDatabaseId: targetDb.id
            });
          }
        }
      }

      showToast(projectForm.id ? '已更新项目' : '已创建项目', 'success');
      setProjectModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProject = async (project) => {
    if (project.isOtherBucket) {
      showToast('默认收纳项目不可删除', 'error');
      return;
    }
    if (!window.confirm(`删除项目 "${project.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', project.id));
      const other = await ensureOtherProject();
      const related = tasks.filter(t => t.projectId === project.id);
      await Promise.all(related.map(t => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', t.id), {
        projectId: other.id,
        projectIds: [other.id],
        projectName: other.name,
        projectNotionId: other.notionId || null
      })));
      showToast('项目已删除', 'success');
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    }
  };

  // --- Task CRUD ---
  const openTaskModal = async (task = null, defaultProjectId = '') => {
    let projectTarget = defaultProjectId;
    if (!projectTarget) projectTarget = task?.projectId || projects[0]?.id || '';
    const chosenProj = projects.find(p => p.id === projectTarget) || await ensureOtherProject();
    const defaultDb = task?.notionDatabaseId || notionConfig.taskDatabases.find(d => d.id)?.id || '';
    setTaskForm({
      id: task?.id || null,
      title: task?.title || '',
      status: task?.status || 'To Do',
      priority: task?.priority || 'Medium',
      projectId: chosenProj?.id || '',
      projectIds: task?.projectIds && task.projectIds.length ? task.projectIds : (projectTarget ? [projectTarget] : []),
      projectName: chosenProj?.name || '',
      projectNotionId: chosenProj?.notionId || null,
      notionId: task?.notionId || null,
      notionDatabaseId: task?.notionDatabaseId || '',
      targetDbId: defaultDb
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e) => {
    e?.preventDefault();
    if (!taskForm.title.trim()) return;
    const targetDb = notionConfig.taskDatabases.find(d => d.id === taskForm.targetDbId);
    const selectedIds = taskForm.projectIds && taskForm.projectIds.length ? taskForm.projectIds : (taskForm.projectId ? [taskForm.projectId] : []);
    let projectList = projects.filter(p => selectedIds.includes(p.id));
    if (!projectList.length) {
      const fallback = await ensureOtherProject();
      projectList = [fallback];
    }
    const primary = projectList[0];

    const payload = {
      title: taskForm.title.trim(),
      status: normalizeStatus(taskForm.status || 'To Do'),
      priority: taskForm.priority || 'Medium',
      projectId: primary.id,
      projectIds: projectList.map(p => p.id),
      projectName: primary.name,
      projectNotionId: primary.notionId || null,
      notionId: taskForm.notionId || null,
      notionDatabaseId: taskForm.notionDatabaseId || taskForm.targetDbId || '',
      updatedAt: serverTimestamp()
    };

    try {
      let docId = taskForm.id;
      if (taskForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskForm.id), payload);
      } else {
        const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { ...payload, createdAt: serverTimestamp() });
        docId = ref.id;
      }

      if (notionConfig.isRealMode && targetDb?.id) {
        const properties = {
          [targetDb.titleProp]: { title: [{ text: { content: payload.title } }] },
          [targetDb.statusProp]: { select: { name: payload.status } },
          [targetDb.priorityProp || 'Priority']: { select: { name: payload.priority } },
          [targetDb.projectProp]: { relation: projectList.map(p => p.notionId).filter(Boolean).map(id => ({ id })) }
        };

        if (payload.notionId) {
          await fetch('/.netlify/functions/notion-page-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: payload.notionId, properties })
          });
        } else {
          const res = await fetch('/.netlify/functions/notion-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ databaseId: targetDb.id, properties })
          });
          if (res.ok) {
            const data = await res.json();
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', docId), {
              notionId: data.id,
              notionDatabaseId: targetDb.id
            });
          }
        }
      }

      showToast(taskForm.id ? '已更新任务' : '已创建任务', 'success');
      setTaskModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`删除任务 "${task.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id));
      showToast('任务已删除', 'success');
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    }
  };

  const openTagModal = (log) => {
    setTagForm({
      id: log.id,
      tags: log.tags || [],
      notes: log.notes || ''
    });
    setTagModalOpen(true);
  };

  const handleSaveTags = async (e) => {
    e?.preventDefault();
    if (!tagForm.id) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'timelogs', tagForm.id), {
        tags: tagForm.tags,
        notes: tagForm.notes
      });
      showToast('Tags updated', 'success');
      setTagModalOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTaskDrop = async (project, virtual = false) => {
    if (!dragTask) return;
    const targetProject = virtual ? await ensureOtherProject() : project;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', dragTask.id), {
        projectId: targetProject.id,
        projectIds: [targetProject.id],
        projectName: targetProject.name,
        projectNotionId: targetProject.notionId || null,
        updatedAt: serverTimestamp()
      });

      if (notionConfig.isRealMode && dragTask.notionId) {
        const dbConf = notionConfig.taskDatabases.find(d => d.id === dragTask.notionDatabaseId) || notionConfig.taskDatabases.find(d => d.id);
        if (dbConf?.projectProp) {
          await fetch('/.netlify/functions/notion-page-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pageId: dragTask.notionId,
              properties: { [dbConf.projectProp]: { relation: targetProject.notionId ? [{ id: targetProject.notionId }] : [] } }
            })
          });
        }
      }
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    } finally {
      setDragTask(null);
    }
  };

  // --- Notion Sync / Import ---
  const saveNotionConfig = async () => {
    if (!user) return;
    setConfigSaving(true);
    try {
      const normalized = {
        ...notionConfig,
        projectDatabases: notionConfig.projectDatabases.map(d => ({ ...d, id: normalizeNotionId(d.id) })),
        taskDatabases: notionConfig.taskDatabases.map(d => ({ ...d, id: normalizeNotionId(d.id) }))
      };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'notion'), normalized, { merge: true });
      setNotionConfig(normalized);
      showToast('配置已保存', 'success');
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const importProjectsFromNotion = async () => {
    let added = 0; let updated = 0;
    for (const dbConf of notionConfig.projectDatabases.filter(d => d.id)) {
      const res = await fetch('/.netlify/functions/notion', {
        method: 'POST',
        body: JSON.stringify({ databaseId: dbConf.id })
      });
      if (!res.ok) throw new Error('项目库连接失败');
      const data = await res.json();

      for (const page of (data.results || [])) {
        const props = page.properties || {};
        const title = props[dbConf.titleProp]?.title?.[0]?.plain_text || 'Untitled';
        const rawStatus = props[dbConf.statusProp]?.select?.name || props[dbConf.statusProp]?.status?.name || 'To Do';
        const status = normalizeStatus(rawStatus);
        if (status === 'Done') continue; // skip completed
        const category = props[dbConf.categoryProp]?.select?.name || props[dbConf.categoryProp]?.multi_select?.[0]?.name || 'General';

        // Attempt to extract color from Notion Select property
        const notionColorName = props[dbConf.categoryProp]?.select?.color || props[dbConf.statusProp]?.select?.color || 'default';
        const color = notionColors[notionColorName] || notionColors.default;

        const existing = projects.find(p => p.notionId === page.id);
        const payload = {
          name: title,
          status,
          category,
          color,
          notionId: page.id,
          notionDatabaseId: dbConf.id
        };
        if (existing) {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', existing.id), payload);
          updated++;
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), { ...payload, createdAt: serverTimestamp() });
          added++;
        }
      }
    }
    return { added, updated };
  };

  const importTasksFromNotion = async () => {
    let added = 0; let updated = 0;
    const otherProject = await ensureOtherProject();

    for (const dbConf of notionConfig.taskDatabases.filter(d => d.id)) {
      const res = await fetch('/.netlify/functions/notion', {
        method: 'POST',
        body: JSON.stringify({ databaseId: dbConf.id })
      });
      if (!res.ok) throw new Error('任务库连接失败');
      const data = await res.json();

      for (const page of (data.results || [])) {
        const props = page.properties || {};
        const title = props[dbConf.titleProp]?.title?.[0]?.plain_text || 'Untitled';
        const rawStatus = props[dbConf.statusProp]?.select?.name || props[dbConf.statusProp]?.status?.name || 'To Do';
        const status = normalizeStatus(rawStatus);
        if (['Done', 'Completed'].includes(status)) continue; // Optional: skip done

        // Priority Mapping
        const priority = props[dbConf.priorityProp || 'Priority']?.select?.name || 'Medium';

        // Project Linking
        let targetProjectId = otherProject.id;
        let targetProjectName = otherProject.name;
        let targetProjectNotionId = null;
        let projectIds = [otherProject.id];

        const relationId = props[dbConf.projectProp]?.relation?.[0]?.id;
        if (relationId) {
          const foundP = projects.find(p => p.notionId === relationId);
          if (foundP) {
            targetProjectId = foundP.id;
            targetProjectName = foundP.name;
            targetProjectNotionId = foundP.notionId;
            projectIds = [foundP.id];
          }
        }

        const existing = tasks.find(t => t.notionId === page.id);
        const payload = {
          title,
          status,
          priority,
          projectId: targetProjectId,
          projectIds,
          projectName: targetProjectName,
          projectNotionId: targetProjectNotionId,
          notionId: page.id,
          notionDatabaseId: dbConf.id
        };

        if (existing) {
          // Only update if changed (simple check optional, here we just overwrite)
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', existing.id), payload);
          updated++;
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { ...payload, createdAt: serverTimestamp() });
          added++;
        }
      }
    }
    return { added, updated };
  };

  const handleManualAddLog = async (logData) => {
    // logData: { startTime, endTime, projectId, ... }
    try {
      if (!logData.projectId && !logData.taskId) throw new Error("Project or Task required");
      const project = projects.find(p => p.id === logData.projectId) || await ensureOtherProject();

      const payload = {
        startTime: logData.startTime,
        endTime: logData.endTime,
        projectId: project.id,
        projectName: project.name,
        category: project.category || 'General',
        color: project.color || '#cbd5e1',
        tags: logData.tags || [],
        notes: logData.notes || '',
        taskId: logData.taskId || null,
        taskTitle: logData.taskTitle || null
      };

      const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'timelogs'), payload);

      // Sync
      const durationMin = (logData.endTime - logData.startTime) / 1000 / 60;
      // Sync to Project Notion
      if (project.notionId) {
        await syncToNotion(project.notionId, durationMin, project.name);
      }

      showToast('Log added & synced', 'success');
      return ref.id;
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    }
  };



  const handleImport = async () => {
    setImportLog('连接中...');
    try {
      const projResult = await importProjectsFromNotion();
      const taskResult = await importTasksFromNotion();
      setImportLog(`项目: +${projResult.added} / 更新 ${projResult.updated}；任务: +${taskResult.added} / 更新 ${taskResult.updated}`);
      showToast('Notion 同步完成', 'success');
      setTimeout(() => setConfigModalOpen(false), 1200);
    } catch (e) {
      console.error(e);
      setImportLog(`错误: ${e.message}`);
      showToast(e.message, 'error');
    }
  };

  // --- UI Components ---




  const AdvancedDashboard = () => {
    const totalTime = logs.reduce((acc, l) => acc + (l.endTime ? l.endTime - l.startTime : 0), 0);
    const totalHours = (totalTime / 3600000).toFixed(1);
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
            <div className="text-purple-200 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Zap size={12} /> Deep Work</div>
            <div className="text-3xl font-bold">{deepWorkHours} <span className="text-sm font-normal">hr</span></div>
            <div className="text-[10px] mt-1 opacity-80">Sessions {'>'} 45m</div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl">
            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Projects Active</div>
            <div className="text-3xl font-bold text-slate-700">{projects.length}</div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl">
            <div className="text-slate-400 text-xs font-bold uppercase mb-1">Avg Session</div>
            <div className="text-3xl font-bold text-slate-700">{logs.length ? (totalHours / logs.length).toFixed(1) : 0} <span className="text-sm font-normal text-slate-400">hr</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><List size={18} /> 最近工作明细</h3>
          <div className="space-y-3">
            {logs.slice(0, 8).map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedLogIds.includes(l.id)} onChange={() => toggleSelectLog(l.id)} />
                    <div className="font-bold text-slate-700">{l.projectName}</div>
                  </div>
                  <div className="text-xs text-slate-400 flex gap-2">
                    <span>{l.startTime?.toLocaleDateString()}</span>
                    <span>{l.startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {l.endTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Now'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-600">
                    {l.endTime ? ((l.endTime - l.startTime) / 1000 / 60).toFixed(0) + ' min' : 'Running'}
                  </div>
                  {l.endTime && (l.endTime - l.startTime) > 45 * 60 * 1000 && (
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

  const LiveTimer = ({ startTime }) => {
    const [ms, setMs] = useState(0);
    useEffect(() => {
      const i = setInterval(() => setMs(new Date() - startTime), 1000);
      return () => clearInterval(i);
    }, [startTime]);
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return <span className="font-mono text-xl font-bold">{hh}:{mm}:{ss}</span>;
  };

  if (!user) return <AuthScreen />;
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 md:pl-64">

      {/* 顶部搜索栏 */}
      <div className="fixed top-0 left-0 md:left-64 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 z-40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-xl flex-1 max-w-lg transition-all focus-within:ring-2 focus-within:ring-blue-200">
          <Search size={18} className="text-slate-400" />
          <input
            className="bg-transparent outline-none w-full text-sm font-medium"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 活动计时器 */}
        {activeLog && (
          <div className="hidden md:flex items-center gap-4 bg-white border px-4 py-2 rounded-xl animate-fade-in shadow-sm" style={{ borderColor: activeLog.color || '#22c55e', backgroundColor: (activeLog.color || '#22c55e') + '10' }}>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: activeLog.color || '#22c55e' }}><Activity size={10} /> Focusing</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{activeLog.projectName}</span>
                {activeLog.tags && activeLog.tags.map(t => <span key={t} className="text-[9px] bg-slate-800 text-white px-1 rounded">{t}</span>)}
              </div>
            </div>
            <LiveTimer startTime={activeLog.startTime} />
            <button onClick={() => openTagModal(activeLog)} className="text-slate-500 hover:text-blue-600 p-1.5"><Tag size={16} /></button>
            <button onClick={stopTimer} className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-sm transition"><Square size={14} fill="currentColor" /></button>
          </div>
        )}
      </div>

      {/* Notion 配置弹窗 */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex gap-2"><Settings size={18} /> 同步配置中心</h3>
              <button onClick={() => setConfigModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100">
                <p>1. 支持多个 Project / Task 库，输入 Notion 链接即可自动提取 ID。</p>
                <p>2. 保存配置后即可同步更新，导入的 Task 会按 Project 关系归类，未指定的进入“其他”。</p>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer" onClick={() => setNotionConfig(c => ({ ...c, isRealMode: !c.isRealMode }))}>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${notionConfig.isRealMode ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${notionConfig.isRealMode ? 'translate-x-4' : ''}`}></div>
                </div>
                <span>{notionConfig.isRealMode ? '真实 API 模式' : '模拟演示模式'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><Briefcase size={16} /> Project 数据库</h4>
                    <button onClick={() => setNotionConfig(c => ({ ...c, projectDatabases: [...c.projectDatabases, { id: '', name: `Project DB ${c.projectDatabases.length + 1}`, titleProp: 'Title', statusProp: 'Status', categoryProp: 'Category' }] }))} className="text-xs px-2 py-1 bg-slate-900 text-white rounded-lg flex items-center gap-1"><Plus size={12} /> 新增</button>
                  </div>
                  {notionConfig.projectDatabases.map((dbConf, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input className="input-std" value={dbConf.name} onChange={e => {
                          const list = [...notionConfig.projectDatabases];
                          list[idx] = { ...list[idx], name: e.target.value };
                          setNotionConfig(c => ({ ...c, projectDatabases: list }));
                        }} placeholder="名称 (仅供区分)" />
                        <button onClick={() => {
                          const list = notionConfig.projectDatabases.filter((_, i) => i !== idx);
                          setNotionConfig(c => ({ ...c, projectDatabases: list.length ? list : [{ id: '', name: 'Project DB 1', titleProp: 'Title', statusProp: 'Status', categoryProp: 'Category' }] }));
                        }} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={14} /></button>
                      </div>
                      <input className="input-std" value={dbConf.id} onChange={e => {
                        const list = [...notionConfig.projectDatabases];
                        list[idx] = { ...list[idx], id: normalizeNotionId(e.target.value) };
                        setNotionConfig(c => ({ ...c, projectDatabases: list }));
                      }} placeholder="Notion 数据库链接或 ID" />
                      <div className="grid grid-cols-3 gap-2">
                        <input className="input-std" value={dbConf.titleProp} onChange={e => {
                          const list = [...notionConfig.projectDatabases]; list[idx] = { ...list[idx], titleProp: e.target.value }; setNotionConfig(c => ({ ...c, projectDatabases: list }));
                        }} placeholder="Title 列" />
                        <input className="input-std" value={dbConf.statusProp} onChange={e => {
                          const list = [...notionConfig.projectDatabases]; list[idx] = { ...list[idx], statusProp: e.target.value }; setNotionConfig(c => ({ ...c, projectDatabases: list }));
                        }} placeholder="Status 列" />
                        <input className="input-std" value={dbConf.categoryProp} onChange={e => {
                          const list = [...notionConfig.projectDatabases]; list[idx] = { ...list[idx], categoryProp: e.target.value }; setNotionConfig(c => ({ ...c, projectDatabases: list }));
                        }} placeholder="Category 列" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><List size={16} /> Task 数据库</h4>
                    <button onClick={() => setNotionConfig(c => ({ ...c, taskDatabases: [...c.taskDatabases, { id: '', name: `Task DB ${c.taskDatabases.length + 1}`, titleProp: 'Title', statusProp: 'Status', projectProp: 'Project' }] }))} className="text-xs px-2 py-1 bg-slate-900 text-white rounded-lg flex items-center gap-1"><Plus size={12} /> 新增</button>
                  </div>
                  {notionConfig.taskDatabases.map((dbConf, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input className="input-std" value={dbConf.name} onChange={e => {
                          const list = [...notionConfig.taskDatabases];
                          list[idx] = { ...list[idx], name: e.target.value };
                          setNotionConfig(c => ({ ...c, taskDatabases: list }));
                        }} placeholder="名称 (仅供区分)" />
                        <button onClick={() => {
                          const list = notionConfig.taskDatabases.filter((_, i) => i !== idx);
                          setNotionConfig(c => ({ ...c, taskDatabases: list.length ? list : [{ id: '', name: 'Task DB 1', titleProp: 'Title', statusProp: 'Status', projectProp: 'Project', priorityProp: 'Priority' }] }));
                        }} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={14} /></button>
                      </div>
                      <input className="input-std" value={dbConf.id} onChange={e => {
                        const list = [...notionConfig.taskDatabases];
                        list[idx] = { ...list[idx], id: normalizeNotionId(e.target.value) };
                        setNotionConfig(c => ({ ...c, taskDatabases: list }));
                      }} placeholder="Notion 数据库链接或 ID" />
                      <div className="grid grid-cols-3 gap-2">
                        <input className="input-std" value={dbConf.titleProp} onChange={e => {
                          const list = [...notionConfig.taskDatabases]; list[idx] = { ...list[idx], titleProp: e.target.value }; setNotionConfig(c => ({ ...c, taskDatabases: list }));
                        }} placeholder="Title 列" />
                        <input className="input-std" value={dbConf.statusProp} onChange={e => {
                          const list = [...notionConfig.taskDatabases]; list[idx] = { ...list[idx], statusProp: e.target.value }; setNotionConfig(c => ({ ...c, taskDatabases: list }));
                        }} placeholder="Status 列" />
                        <input className="input-std" value={dbConf.projectProp} onChange={e => {
                          const list = [...notionConfig.taskDatabases]; list[idx] = { ...list[idx], projectProp: e.target.value }; setNotionConfig(c => ({ ...c, taskDatabases: list }));
                        }} placeholder="Project 关联列" />
                        <input className="input-std" value={dbConf.priorityProp || ''} onChange={e => {
                          const list = [...notionConfig.taskDatabases]; list[idx] = { ...list[idx], priorityProp: e.target.value }; setNotionConfig(c => ({ ...c, taskDatabases: list }));
                        }} placeholder="Priority (Selection)" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-purple-600 uppercase">反写时间列 (Number)</label>
                  <input className="input-std border-purple-200 bg-purple-50" value={notionConfig.writeBackProp} onChange={e => setNotionConfig(c => ({ ...c, writeBackProp: e.target.value }))} placeholder="TimeSpent" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">无 Project 归档名称</label>
                  <input className="input-std" value={notionConfig.defaultUnassignedProjectName} onChange={e => setNotionConfig(c => ({ ...c, defaultUnassignedProjectName: e.target.value }))} placeholder="Other" />
                </div>
              </div>

              {importLog && <div className="text-xs font-mono bg-slate-900 text-green-400 p-2 rounded max-h-24 overflow-auto">{importLog}</div>}

              <div className="flex flex-col md:flex-row gap-3">
                <button onClick={saveNotionConfig} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition flex justify-center gap-2 disabled:opacity-50" disabled={configSaving}>
                  <Save size={18} /> {configSaving ? '保存中...' : '保存配置'}
                </button>
                <button onClick={handleImport} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition flex justify-center gap-2">
                  <RefreshCw size={18} /> 立即同步 (Pull)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <nav className="fixed bottom-0 md:top-0 left-0 w-full md:w-64 bg-white border-t md:border-r border-slate-200 z-50 md:h-full flex md:flex-col p-4 shadow-2xl md:shadow-none">
        <div className="hidden md:block mb-8">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Clock className="text-blue-600" /> EngTimer Pro</h1>
        </div>

        <div className="flex md:flex-col justify-around w-full gap-2">
          <div className="md:mb-4">
            <div className="hidden md:block text-xs font-bold text-slate-400 uppercase mb-2 px-3">Workspace</div>
          </div>
          <nav className="space-y-2">
            <NavBtn icon={<LayoutGrid size={20} />} label="Projects" active={view === 'projects'} onClick={() => setView('projects')} />
            <NavBtn icon={<Check size={20} />} label="Tasks" active={view === 'tasks'} onClick={() => setView('tasks')} />

            <NavBtn icon={<BarChart3 size={20} />} label="Analytics" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          </nav>

          <div className="md:mb-4">
            <div className="hidden md:block text-xs font-bold text-slate-400 uppercase mb-2 px-3">Integration</div>
            <NavBtn icon={<RefreshCw />} label="Notion Sync" onClick={() => setConfigModalOpen(true)} />
          </div>
        </div>

        <div className="hidden md:block mt-auto">
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-red-500 hover:bg-red-50 w-full p-3 rounded-xl transition"><LogOut size={18} /> Sign Out</button>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="pt-24 px-4 md:px-8 pb-8 max-w-6xl mx-auto">
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 capitalize flex items-center gap-2">
            {view === 'projects' && <><LayoutGrid className="text-blue-600" /> Projects</>}
            {view === 'tasks' && <><Check className="text-blue-600" /> Tasks</>}
            {view === 'calendar' && <><CalendarIcon className="text-blue-600" /> Schedule</>}
            {view === 'dashboard' && <><BarChart3 className="text-blue-600" /> Insights</>}
          </h1>
          <div className="flex gap-2">
            {view === 'projects' && (
              <button onClick={() => openProjectModal()} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"><Plus size={16} /> New Project</button>
            )}
            {view === 'tasks' && (
              <button onClick={() => openTaskModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"><Plus size={16} /> New Task</button>
            )}
          </div>
        </div>

        {view === 'projects' && (
          <ProjectList
            projects={filteredProjects}
            activeLog={activeLog}
            onStartTimer={toggleTimer}
            onStopTimer={stopTimer}
            onEditProject={openProjectModal}
            onDeleteProject={handleDeleteProject}
            onUpdateProject={updateProjectInline}
          />
        )}

        {view === 'tasks' && (
          <TaskList
            tasks={filteredTasks}
            projects={projects}
            onUpdateTask={updateTaskInline}
            onDeleteTask={handleDeleteTask}
            onEditTask={openTaskModal}
            activeLog={activeLog}
            onStartTimer={task => toggleTimer(task, 'task')}
            onStopTimer={stopTimer}
          />
        )}



        {view === 'dashboard' && (
          <div className="animate-fade-in">
            <AnalysisView logs={logs} projects={projects} tasks={enhancedTasks} onManualAddLog={handleManualAddLog} />
          </div>
        )}
      </main>

      <ActiveTimer
        activeLog={activeLog}
        projects={projects}
        onStop={stopTimer}
        onAddTag={() => { setTagForm({ id: activeLog.id, tags: activeLog.tags || [], notes: activeLog.notes || '' }); setTagModalOpen(true); }}
        onAddNote={() => { setTagForm({ id: activeLog.id, tags: activeLog.tags || [], notes: activeLog.notes || '' }); setTagModalOpen(true); }}
      />
      {/* 项目编辑弹窗 */}
      {
        projectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{projectForm.id ? '编辑项目' : '新建项目'}</h3>
                <button onClick={() => setProjectModalOpen(false)}><X size={20} /></button>
              </div>
              <form className="space-y-3" onSubmit={handleSaveProject}>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">标题</label>
                  <input className="input-std" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="Project title" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">状态</label>
                    <input className="input-std" value={projectForm.status} onChange={e => setProjectForm(f => ({ ...f, status: e.target.value }))} placeholder="To Do / In Progress / Done" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">分类</label>
                    <input className="input-std" value={projectForm.category} onChange={e => setProjectForm(f => ({ ...f, category: e.target.value }))} placeholder="Category" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">主题色</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="color" value={projectForm.color} onChange={e => setProjectForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-16 p-0 border-0 rounded cursor-pointer" />
                    <div className="flex gap-1 flex-1 overflow-x-auto pb-1">
                      {Object.values(notionColors).map(c => (
                        <button type="button" key={c} onClick={() => setProjectForm(f => ({ ...f, color: c }))} className={`w-6 h-6 rounded-full border border-slate-200 shrink-0 ${projectForm.color === c ? 'ring-2 ring-slate-800' : ''}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Notion 数据库</label>
                  <select className="input-std" value={projectForm.targetDbId} onChange={e => setProjectForm(f => ({ ...f, targetDbId: e.target.value }))}>
                    <option value="">仅本地</option>
                    {notionConfig.projectDatabases.filter(d => d.id).map(dbConf => (
                      <option key={dbConf.id} value={dbConf.id}>{dbConf.name || dbConf.id}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={projectForm.isOtherBucket} onChange={e => setProjectForm(f => ({ ...f, isOtherBucket: e.target.checked }))} />
                    <span>设为“其他”收纳项目</span>
                  </div>
                  {projectForm.notionId && <span className="text-xs text-purple-600 flex items-center gap-1"><Link size={14} /> 已关联 Notion</span>}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setProjectModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-2"><Check size={16} /> 保存</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* 任务编辑弹窗 */}
      {
        taskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{taskForm.id ? '编辑任务' : '新建任务'}</h3>
                <button onClick={() => setTaskModalOpen(false)}><X size={20} /></button>
              </div>
              <form className="space-y-3" onSubmit={handleSaveTask}>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">标题</label>
                  <input className="input-std" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">状态</label>
                    <input className="input-std" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} placeholder="To Do / In Progress / Done" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">优先级</label>
                    <select className="input-std" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">所属项目</label>
                    <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
                      {projects.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={taskForm.projectIds?.includes(p.id)}
                            onChange={() => {
                              const exists = taskForm.projectIds?.includes(p.id);
                              const next = exists ? taskForm.projectIds.filter(id => id !== p.id) : [...(taskForm.projectIds || []), p.id];
                              setTaskForm(f => ({ ...f, projectIds: next, projectId: next[0] || '', projectName: (projects.find(px => px.id === (next[0] || ''))?.name) || '' }));
                            }}
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Notion 数据库</label>
                  <select className="input-std" value={taskForm.targetDbId} onChange={e => setTaskForm(f => ({ ...f, targetDbId: e.target.value }))}>
                    <option value="">仅本地</option>
                    {notionConfig.taskDatabases.filter(d => d.id).map(dbConf => (
                      <option key={dbConf.id} value={dbConf.id}>{dbConf.name || dbConf.id}</option>
                    ))}
                  </select>
                </div>
                {taskForm.notionId && <div className="text-xs text-purple-600 flex items-center gap-1"><Link size={14} /> 已关联 Notion</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setTaskModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-2"><Check size={16} /> 保存</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Tag Popup */}
      {
        tagModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Session Details</h3>
                <button onClick={() => setTagModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveTags} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tagForm.tags.map(t => (
                      <span key={t} className="bg-slate-800 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        {t} <button type="button" onClick={() => setTagForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="input-std"
                    placeholder="Add tag + Enter"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.target.value.trim();
                        if (val && !tagForm.tags.includes(val)) {
                          setTagForm(f => ({ ...f, tags: [...f.tags, val] }));
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {['Deep Work', 'Meeting', 'Reading', 'Coding', 'Design'].map(s => (
                      <button type="button" key={s} onClick={() => {
                        if (!tagForm.tags.includes(s)) setTagForm(f => ({ ...f, tags: [...f.tags, s] }));
                      }} className="text-[10px] bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
                  <textarea className="input-std h-20 resize-none" value={tagForm.notes} onChange={e => setTagForm(f => ({ ...f, notes: e.target.value }))} placeholder="Session notes..."></textarea>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm">Save</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      <style>{`
        .input-std { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background-color: #f8fafc; border: 1px solid #e2e8f0; outline: none; font-size: 0.875rem; }
        .input-std:focus { ring: 2px; ring-color: #3b82f6; }
      `}</style>
    </div >
  );
}

const NavBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left ${active ? 'bg-slate-900 text-white font-bold shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}>
    {icon} <span className="hidden md:inline text-sm">{label}</span>
  </button>
);

