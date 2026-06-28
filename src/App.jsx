import { useState, useEffect, useCallback } from "react";
import { Check, Trophy, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Award, Utensils, Loader2, Sparkles, ShieldAlert, Lock, User, LogIn, Users, Search, Image, Shield, Swords, Zap, Crown } from "lucide-react";

const WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WD_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const DEFAULT_TEMPLATE = {}; 
const DEFAULT_TARGETS = { kcal: 0, protein: 0, carb: 0, fat: 0 };

// NOVO SISTEMA DE PATENTES (Progressão Complexa e Estilizada)
const RANKS = [
  { id: "bronze", label: "Bronze", minPts: 0, maxPts: 300, color: "#cd7f32", icon: Shield },
  { id: "prata", label: "Prata", minPts: 301, maxPts: 1000, color: "#94a3b8", icon: Shield },
  { id: "ouro", label: "Ouro", minPts: 1001, maxPts: 2500, color: "#fbbf24", icon: Swords },
  { id: "platina", label: "Platina", minPts: 2501, maxPts: 5000, color: "#38bdf8", icon: Swords },
  { id: "ametista", label: "Ametista", minPts: 5001, maxPts: 8500, color: "#c084fc", icon: Zap },
  { id: "esmeralda", label: "Esmeralda", minPts: 8501, maxPts: 13000, color: "#34d399", icon: Flame },
  { id: "elite", label: "Elite Global", minPts: 13001, maxPts: 999999, color: "#f43f5e", icon: Crown }
];

// BANCO DE DADOS DE OUTROS USUÁRIOS ONLINE (Para alimentar a comunidade e Leaderboard)
const COMMUNITY_USERS = [
  { id: "u1", name: "GUTS_99", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", points: 14200, template: { 1: [{ time: "05:00", title: "Cardio em Jejum" }, { time: "06:30", title: "Simulado IME/ITA" }] } },
  { id: "u2", name: "MIYAMOTO_MUSASHI", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", points: 9450, template: { 1: [{ time: "04:30", title: "Meditação e Espada" }] } },
  { id: "u3", name: "SHADOW_WALKER", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150", points: 4200, template: { 1: [{ time: "07:00", title: "Treino de Força" }] } },
  { id: "u4", name: "CASCA_REBEL", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", points: 1850, template: { 1: [{ time: "06:00", title: "Estudo de Álgebra Avançada" }] } },
  { id: "u5", name: "RECRUTA_ZERO", avatar: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150", points: 120, template: { 1: [] } }
];

const NUTRITION_DATABASE = {
  arroz: { kcal: 1.3, protein: 0.025, carb: 0.28, fat: 0.002, vitamins: "Vitamina B1, B3, Ferro" },
  feijao: { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio, Magnésio" },
  frango: { kcal: 1.65, protein: 0.31, carb: 0, fat: 0.036, vitamins: "Vitamina B6, B12, Zinco" },
  ovo: { kcal: 1.55, protein: 0.13, carb: 0.01, fat: 0.11, vitamins: "Vitamina A, D, B12, Colina" },
  patinho: { kcal: 1.85, protein: 0.30, carb: 0, fat: 0.07, vitamins: "Ferro Heme, Vitamina B12" },
  whey: { kcal: 4.0, protein: 0.80, carb: 0.05, fat: 0.06, vitamins: "BCAA, Cálcio" }
};

function pad(n){ return n.toString().padStart(2,"0"); }
function toDateStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromDateStr(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function uid(){ return Math.random().toString(36).slice(2,9); }

const STORAGE_KEY = "berserk-app-state-v3";

export default function BerserkApp(){
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [log, setLog] = useState({});
  const [nutrition, setNutrition] = useState({ targets: DEFAULT_TARGETS, meals: {} });
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [view, setView] = useState("hoje");
  const [editWeekday, setEditWeekday] = useState(new Date().getDay());
  const [newTask, setNewTask] = useState({ time:"", title:"", points:10 });

  const [draft, setDraft] = useState({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  // Estados novos: Perfil e Comunidade
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.template) setTemplate(parsed.template);
        if (parsed.log) setLog(parsed.log);
        if (parsed.nutrition) setNutrition(parsed.nutrition);
        if (parsed.user) {
          setUser(parsed.user);
          setProfileName(parsed.user.name || "");
          setProfileAvatar(parsed.user.avatar || "");
        }
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  const persist = useCallback((t, l, n, u) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: t, log: l, nutrition: n, user: u }));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (loaded) persist(template, log, nutrition, user); }, [template, log, nutrition, user, loaded, persist]);

  const handleAuth = (e) => {
    e.preventDefault();
    setAuthError("");
    if (!authForm.username.trim() || !authForm.password) {
      setAuthError("Preencha todos os campos.");
      return;
    }
    const finalUser = { name: authForm.username.trim().toUpperCase(), avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" };
    setUser(finalUser);
    setProfileName(finalUser.name);
    setProfileAvatar(finalUser.avatar);
  };

  const handleLogout = () => { setUser(null); setView("hoje"); };

  const weekdayOf = (dateStr) => fromDateStr(dateStr).getDay();
  const tasksFor = (weekday) => template[weekday] || [];

  const toggleTask = (dateStr, taskId) => {
    setLog(prev => {
      const day = prev[dateStr] || { done: [] };
      const done = day.done.includes(taskId) ? day.done.filter(id => id !== taskId) : [...day.done, taskId];
      return { ...prev, [dateStr]: { done } };
    });
  };

  const dayPoints = (dateStr) => {
    const tasks = tasksFor(weekdayOf(dateStr));
    const done = (log[dateStr]?.done) || [];
    if (tasks.length === 0) return 0;
    let pts = tasks.filter(t => done.includes(t.id)).reduce((s,t)=>s+t.points,0);
    if (done.length === tasks.length) pts += 20;
    return pts;
  };

  const totalPoints = Object.keys(log).reduce((sum, d) => sum + dayPoints(d), 0);

  const getRank = (pts) => {
    const idx = RANKS.findIndex(r => pts >= r.minPts && pts <= r.maxPts);
    return RANKS[idx !== -1 ? idx : 0];
  };

  const currentRank = getRank(totalPoints);

  // Geração da Leaderboard dinâmica (Você + Comunidade Fake Online)
  const fullLeaderboard = [
    { id: "me", name: profileName || user?.name || "VOCÊ", avatar: profileAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150", points: totalPoints, isMe: true, template },
    ...COMMUNITY_USERS
  ].sort((a, b) => b.points - a.points);

  const filteredLeaderboard = fullLeaderboard.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const updateProfile = () => {
    if (!profileName.trim()) return;
    setUser(prev => ({ ...prev, name: profileName.trim().toUpperCase(), avatar: profileAvatar.trim() }));
  };

  const shiftDate = (delta) => {
    const d = fromDateStr(selectedDate); d.setDate(d.getDate() + delta); setSelectedDate(toDateStr(d));
  };

  const addTaskToWeekday = () => {
    if (!newTask.title.trim()) return;
    const task = { id: uid(), time: newTask.time || "00:00", title: newTask.title.trim(), points: Number(newTask.points) || 10 };
    setTemplate(prev => ({ ...prev, [editWeekday]: [...(prev[editWeekday] || []), task].sort((a,b)=>a.time.localeCompare(b.time)) }));
    setNewTask({ time:"", title:"", points:10 });
  };

  const deleteTaskFromWeekday = (taskId) => {
    setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].filter(t => t.id !== taskId) }));
  };

  const updateTaskField = (taskId, field, value) => {
    setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].map(t => t.id === taskId ? { ...t, [field]: field === "points" ? Number(value)||0 : value } : t) }));
  };

  const updateTarget = (field, value) => {
    setNutrition(prev => ({ ...prev, targets: { ...prev.targets, [field]: Number(value) || 0 } }));
  };

  const calcWithAI = async () => {
    if (!draft.food.trim() || !draft.grams) { setCalcError("Preencha campos."); return; }
    setCalculating(true); setCalcError("");
    const inputFood = draft.food.toLowerCase().trim();
    const inputGrams = Number(draft.grams) || 0;
    try {
      const response = await fetch("/api/calc-nutricao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ food: draft.food, grams: draft.grams }) });
      if (!response.ok) throw new Error();
      const parsed = await response.json();
      setDraft(prev => ({ ...prev, kcal: Math.round(parsed.kcal), protein: Math.round(parsed.protein_g), carb: Math.round(parsed.carb_g), fat: Math.round(parsed.fat_g), vitamins: parsed.vitamins || "Complexo B" }));
    } catch (e) {
      setDraft(prev => ({ ...prev, kcal: Math.round(1.2 * inputGrams), protein: Math.round(0.06 * inputGrams), carb: Math.round(0.22 * inputGrams), fat: Math.round(0.01 * inputGrams), vitamins: "Análise Estimada" }));
    }
    setCalculating(false);
  };

  const addMeal = () => {
    if (!draft.food.trim() || draft.kcal === "") return;
    const meal = { id: uid(), food: draft.food.trim(), grams: Number(draft.grams) || 0, kcal: Number(draft.kcal) || 0, protein: Number(draft.protein) || 0, carb: Number(draft.carb) || 0, fat: Number(draft.fat) || 0, vitamins: draft.vitamins || "" };
    setNutrition(prev => ({ ...prev, meals: { ...prev.meals, [selectedDate]: [...(prev.meals[selectedDate]||[]), meal] } }));
    setDraft({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
  };

  const mealsToday = nutrition.meals[selectedDate] || [];
  const totals = mealsToday.reduce((acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carb: acc.carb + m.carb, fat: acc.fat + m.fat }), { kcal:0, protein:0, carb:0, fat:0 });
  const targets = nutrition.targets || DEFAULT_TARGETS;

  if (!loaded) return <div className="flex items-center justify-center h-screen text-zinc-500 text-sm bg-zinc-950">Iniciando Servidores...</div>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col justify-center px-6 py-12 text-zinc-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-red-600 tracking-widest" style={{fontFamily:"Impact, sans-serif"}}>BERSERK</h1>
          <p className="text-zinc-500 text-xs font-mono uppercase mt-2">NETWORK SYNC v3.0</p>
        </div>
        <form onSubmit={handleAuth} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
          <input type="text" placeholder="CODINOME" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none" />
          <input type="password" placeholder="CHAVE DE ACESSO" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none" />
          <button type="submit" className="w-full bg-red-700 text-white font-black py-3 rounded-xl uppercase text-sm tracking-widest">Conectar ao Hub</button>
        </form>
      </div>
    );
  }

  const wd = weekdayOf(selectedDate);
  const tasks = tasksFor(wd);
  const done = (log[selectedDate]?.done) || [];
  const isToday = selectedDate === toDateStr(new Date());

  const Bar = ({ value, max, color }) => (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden border border-zinc-900">
      <div className="h-1.5 transition-all rounded-full" style={{ width: `${Math.min(100,(value/(max||1))*100)}%`, backgroundColor: color }} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col border-x border-zinc-900 text-zinc-100 selection:bg-red-500/20" style={{fontFamily:"system-ui, sans-serif"}}>
      
      {/* HEADER GLOBAL */}
      <div className="bg-black px-5 py-4 flex items-center justify-between border-b border-zinc-900 shadow-md">
        <div className="flex items-center gap-3">
          <img src={profileAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} alt="Avatar" className="w-9 h-9 rounded-xl object-cover border border-zinc-800 shadow-md" />
          <div>
            <h1 className="text-md font-black text-red-600 tracking-wider" style={{fontFamily:"Impact, sans-serif"}}>BERSERK</h1>
            <p className="text-zinc-400 text-[10px] font-mono font-bold tracking-tight uppercase" style={{ color: currentRank.color }}>{currentRank.label}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 flex items-center gap-1">
          <Trophy size={13} className="text-red-500" />
          <span className="font-mono font-bold text-xs text-zinc-300">{totalPoints}P</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* ABA 1: HOJE */}
        {view === "hoje" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-zinc-900/40 p-2 rounded-xl border border-zinc-900">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400"><ChevronLeft size={16} /></button>
              <div className="text-center">
                <div className="text-xs font-bold text-zinc-200 uppercase tracking-wide">{WEEKDAYS[wd]}</div>
                <div className="text-[10px] font-mono text-zinc-500">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
              </div>
              <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400"><ChevronRight size={16} /></button>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Diretrizes Concluídas</span>
                <span className="text-xs font-mono font-bold text-red-400">{done.length}/{tasks.length}</span>
              </div>
              <Bar value={done.length} max={tasks.length} color="#b91c1c" />
            </div>

            <div className="space-y-2">
              {tasks.length === 0 && <p className="text-center text-xs text-zinc-600 py-12 font-mono">NENHUMA DIRETRIZ CONFIGURADA HOJE.</p>}
              {tasks.map(task => {
                const checked = done.includes(task.id);
                return (
                  <button key={task.id} onClick={() => toggleTask(selectedDate, task.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border ${checked ? "bg-red-950/10 border-red-900/20" : "bg-zinc-900 border-zinc-800/80"}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${checked ? "bg-red-600 border-red-600" : "border-zinc-700 bg-zinc-950"}`}>{checked && <Check size={10} className="text-white stroke-[3]" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${checked ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{task.title}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{task.time}</div>
                    </div>
                    <div className="text-xs font-mono font-bold text-zinc-400">+{task.points}P</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 2: DIETA */}
        {view === "dieta" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Metas</p>
              <div className="grid grid-cols-4 gap-2">
                {[["kcal","Kcal"],["protein","Prot"],["carb","Carb"],["fat","Gord"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[9px] font-bold text-zinc-500 block uppercase">{label}</label>
                    <input type="number" value={targets[key] || ""} onChange={e=>updateTarget(key, e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-200 mt-1 focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              {/* Consumidos Bars */}
              {[["Kcal", totals.kcal, targets.kcal, "#b91c1c"], ["Proteína", totals.protein, targets.protein, "#16a34a"], ["Carboidrato", totals.carb, targets.carb, "#d97706"], ["Gordura", totals.fat, targets.fat, "#2563eb"]].map(([label, val, max, color]) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono"><span>{label}</span><span>{Math.round(val)}/{max||0}</span></div>
                  <Bar value={val} max={max||1} color={color} />
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-dashed border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex gap-2">
                <input type="text" placeholder="Alimento..." value={draft.food} onChange={e=>setDraft({...draft, food:e.target.value})} className="flex-1 text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none" />
                <input type="number" placeholder="g" value={draft.grams} onChange={e=>setDraft({...draft, grams:e.target.value})} className="w-14 text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center focus:outline-none" />
              </div>
              <button onClick={calcWithAI} className="w-full bg-red-900/40 border border-red-800 text-red-400 rounded-lg py-1.5 text-xs font-bold" disabled={calculating}>CALCULAR COM IA</button>
              <button onClick={addMeal} className="w-full bg-zinc-200 text-zinc-950 rounded-lg py-1.5 text-xs font-bold">INSERIR NA DIETA</button>
            </div>
          </div>
        )}

        {/* ABA 3: EDITAR ROTINA */}
        {view === "editar" && (
          <div className="space-y-4">
            <div className="flex gap-1 overflow-x-auto pb-1.5">
              {WD_SHORT.map((label, idx) => (
                <button key={idx} onClick={() => setEditWeekday(idx)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editWeekday===idx ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-500"}`}>{label}</button>
              ))}
            </div>
            <div className="space-y-2">
              {(template[editWeekday]||[]).map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center gap-2">
                  <input type="time" value={task.time} onChange={e => updateTaskField(task.id, "time", e.target.value)} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1 text-zinc-200" />
                  <input type="text" value={task.title} onChange={e => updateTaskField(task.id, "title", e.target.value)} className="text-xs bg-zinc-950 border border-zinc-800 rounded p-1 flex-1 text-zinc-200" />
                  <input type="number" value={task.points} onChange={e => updateTaskField(task.id, "points", e.target.value)} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1 w-10 text-center" />
                  <button onClick={() => deleteTaskFromWeekday(task.id)} className="text-zinc-500 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-dashed border-zinc-800 space-y-2">
              <div className="flex gap-2">
                <input type="time" value={newTask.time} onChange={e=>setNewTask({...newTask, time:e.target.value})} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1" />
                <input type="text" placeholder="Nova diretriz..." value={newTask.title} onChange={e=>setNewTask({...newTask, title:e.target.value})} className="text-xs bg-zinc-950 border border-zinc-800 rounded p-1 flex-1" />
                <input type="number" placeholder="pts" value={newTask.points} onChange={e=>setNewTask({...newTask, points:e.target.value})} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1 w-10 text-center" />
              </div>
              <button onClick={addTaskToWeekday} className="w-full bg-red-700 text-white rounded-lg py-1 text-xs font-bold uppercase">Anexar à Grade</button>
            </div>
          </div>
        )}

        {/* ABA 4: COMUNIDADE (Leaderboard + Inspeção Online) */}
        {view === "comunidade" && (
          <div className="space-y-4">
            {/* Campo de Busca */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="Buscar operador ou clã..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700" />
            </div>

            {/* Modal/Visualização de Perfil Inspecionado */}
            {selectedUser && (
              <div className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-4 space-y-3 relative">
                <button onClick={() => setSelectedUser(null)} className="absolute top-2 right-3 text-zinc-500 hover:text-zinc-200 font-mono text-xs font-bold">[FECHAR]</button>
                <div className="flex items-center gap-3">
                  <img src={selectedUser.avatar} className="w-12 h-12 rounded-xl object-cover border border-zinc-700" alt="" />
                  <div>
                    <h3 className="text-sm font-black text-zinc-100 tracking-wide">{selectedUser.name}</h3>
                    <div className="text-[10px] font-mono font-bold uppercase" style={{ color: getRank(selectedUser.points).color }}>
                      {getRank(selectedUser.points).label} · {selectedUser.points} PTS
                    </div>
                  </div>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-900">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Rotina Base Herdadada (Segunda-Feira)</p>
                  <div className="space-y-1.5">
                    {((selectedUser.template && selectedUser.template[1]) || []).length === 0 ? (
                      <p className="text-[10px] text-zinc-600 font-mono">Nenhuma tarefa pública encontrada.</p>
                    ) : (
                      selectedUser.template[1].map((t, i) => (
                        <div key={i} className="text-xs flex justify-between font-mono text-zinc-400 bg-zinc-900/40 px-2 py-1 rounded">
                          <span>{t.title}</span><span className="text-zinc-600">{t.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Placar / Rank Leaderboard */}
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-2 space-y-1">
              <div className="text-[10px] font-black text-zinc-500 px-3 py-1.5 uppercase tracking-widest">LEADERBOARD GLOBAL TERMINAL</div>
              {filteredLeaderboard.map((u, idx) => {
                const rankInfo = getRank(u.points);
                const RankIcon = rankInfo.icon;
                return (
                  <div key={u.id} onClick={() => setSelectedUser(u)} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${u.isMe ? "bg-red-950/10 border-red-900/30 shadow-sm" : "bg-zinc-900/40 border-zinc-900/60 hover:bg-zinc-900"}`}>
                    <div className="w-5 text-center font-mono text-xs font-bold text-zinc-600">#{idx + 1}</div>
                    <img src={u.avatar} className="w-8 h-8 rounded-lg object-cover border border-zinc-800" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5">
                        {u.name} {u.isMe && <span className="text-[8px] bg-red-600 text-white font-black px-1 rounded">VOCÊ</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-mono font-bold mt-0.5" style={{ color: rankInfo.color }}>
                        <RankIcon size={10} /> {rankInfo.label}
                      </div>
                    </div>
                    <div className="text-xs font-mono font-black text-zinc-400">{u.points}P</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 5: PERFIL (Configurações do Operador) */}
        {view === "perfil" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center space-y-3 shadow-lg">
              <div className="relative w-20 h-20 mx-auto">
                <img src={profileAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-800 shadow-xl" alt="Sua Foto" />
                <div className="absolute -bottom-1 -right-1 p-1 bg-red-700 rounded-md border border-zinc-950 text-white"><User size={12}/></div>
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-100 tracking-wide uppercase">{profileName || "CONFIGURAR CODINOME"}</h2>
                <div className="inline-flex items-center gap-1 text-[10px] font-mono font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 mt-1" style={{ color: currentRank.color }}>
                  {currentRank.label}
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-900 rounded-2xl p-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alterar Configurações Básicas</p>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1"><User size={11}/> Novo Codinome / Nome</label>
                <input type="text" value={profileName} onChange={e=>setProfileName(e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none" placeholder="Ex: PROTOCOLO_ALPHA" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1"><Image size={11}/> URL da Foto de Perfil</label>
                <input type="text" value={profileAvatar} onChange={e=>setProfileAvatar(e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-200 focus:outline-none" placeholder="Link da imagem (Unsplash, Imgur, etc.)" />
              </div>

              <button onClick={updateProfile} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl py-2.5 text-xs uppercase tracking-wider transition-all">Sincronizar Novo Registro</button>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Requisitos Globais de Elo</p>
              <div className="space-y-1.5">
                {RANKS.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-xs font-mono px-2 py-1 rounded bg-zinc-950/40 border border-zinc-900/60">
                    <span style={{ color: r.color }} className="font-bold">{r.label}</span>
                    <span className="text-zinc-500">{r.minPts}+ PTS</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER NAVBAR EXPANDIDO */}
      <div className="flex border-t border-zinc-900 bg-black/95 sticky bottom-0 z-40">
        {[
          { id:"hoje", label:"Hoje", icon: Check },
          { id:"dieta", label:"Dieta", icon: Utensils },
          { id:"editar", label:"Grade", icon: Pencil },
          { id:"comunidade", label:"Rede", icon: Users },
          { id:"perfil", label:"Perfil", icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-red-500 bg-red-950/5" : "text-zinc-600"}`}>
              <Icon size={15} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}