import { useState, useEffect, useCallback } from "react";
import { Check, Trophy, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Award, Utensils, Loader2, Sparkles, ShieldAlert, Lock, User, LogIn } from "lucide-react";

const WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WD_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ESTRUTURAS ZERADAS PARA O PRIMEIRO ACESSO (Folha em branco para o usuário configurar)
const DEFAULT_TEMPLATE = {}; 
const DEFAULT_TARGETS = { kcal: 0, protein: 0, carb: 0, fat: 0 };

const TROPHIES = [
  { id:"bronze", label:"Bronze", threshold:100, color:"#b87333" },
  { id:"prata", label:"Prata", threshold:500, color:"#c0c0c8" },
  { id:"ouro", label:"Ouro", threshold:1500, color:"#d4af37" },
  { id:"platina", label:"Platina", threshold:3000, color:"#5fb8c9" },
  { id:"diamante", label:"Diamante", threshold:6000, color:"#a855f7" },
];

// Banco de dados analítico local para fallback instantâneo da IA se a API falhar
const NUTRITION_DATABASE = {
  arroz: { kcal: 1.3, protein: 0.025, carb: 0.28, fat: 0.002, vitamins: "Vitamina B1, B3, Ferro" },
  feijao: { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio, Magnésio" },
  frango: { kcal: 1.65, protein: 0.31, carb: 0, fat: 0.036, vitamins: "Vitamina B6, B12, Zinco" },
  ovo: { kcal: 1.55, protein: 0.13, carb: 0.01, fat: 0.11, vitamins: "Vitamina A, D, B12, Colina" },
  patinho: { kcal: 1.85, protein: 0.30, carb: 0, fat: 0.07, vitamins: "Ferro Heme, Vitamina B12" },
  whey: { kcal: 4.0, protein: 0.80, carb: 0.05, fat: 0.06, vitamins: "BCAA, Cálcio" },
  aveia: { kcal: 3.9, protein: 0.14, carb: 0.67, fat: 0.08, vitamins: "Fibras Solúveis, Zinco" },
  banana: { kcal: 0.89, protein: 0.01, carb: 0.23, fat: 0.003, vitamins: "Potássio, Vitamina B6" },
  leite: { kcal: 0.60, protein: 0.03, carb: 0.05, fat: 0.03, vitamins: "Cálcio, Vitamina D" }
};

function pad(n){ return n.toString().padStart(2,"0"); }
function toDateStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromDateStr(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function uid(){ return Math.random().toString(36).slice(2,9); }

const STORAGE_KEY = "berserk-app-state";

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
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.template) setTemplate(parsed.template);
        if (parsed.log) setLog(parsed.log);
        if (parsed.nutrition) setNutrition(parsed.nutrition);
        if (parsed.user) setUser(parsed.user);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  const persist = useCallback((t, l, n, u) => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: t, log: l, nutrition: n, user: u }));
    } catch (e) { console.error(e); }
    setSaving(false);
  }, []);

  useEffect(() => { if (loaded) persist(template, log, nutrition, user); }, [template, log, nutrition, user, loaded, persist]);

  const handleAuth = (e) => {
    e.preventDefault();
    setAuthError("");

    if (!authForm.username.trim() || !authForm.password) {
      setAuthError("DIRETRIZ REJEITADA: Preencha todos os campos.");
      return;
    }

    if (authMode === "signup") {
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError("FALHA DE SINCRONIZAÇÃO: As senhas não conferem.");
        return;
      }
      setUser({ name: authForm.username.trim().toUpperCase() });
    } else {
      setUser({ name: authForm.username.trim().toUpperCase() });
    }
    setAuthForm({ username: "", password: "", confirmPassword: "" });
  };

  const handleLogout = () => {
    setUser(null);
    setView("hoje");
  };

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

  const shiftDate = (delta) => {
    const d = fromDateStr(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toDateStr(d));
  };

  const addTaskToWeekday = () => {
    if (!newTask.title.trim()) return;
    const task = { id: uid(), time: newTask.time || "00:00", title: newTask.title.trim(), points: Number(newTask.points) || 10 };
    setTemplate(prev => {
      const list = [...(prev[editWeekday] || []), task].sort((a,b)=>a.time.localeCompare(b.time));
      return { ...prev, [editWeekday]: list };
    });
    setNewTask({ time:"", title:"", points:10 });
  };

  const deleteTaskFromWeekday = (taskId) => {
    setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].filter(t => t.id !== taskId) }));
  };

  const updateTaskField = (taskId, field, value) => {
    setTemplate(prev => ({
      ...prev,
      [editWeekday]: prev[editWeekday].map(t => t.id === taskId ? { ...t, [field]: field === "points" ? Number(value)||0 : value } : t)
    }));
  };

  const updateTarget = (field, value) => {
    setNutrition(prev => ({ ...prev, targets: { ...prev.targets, [field]: Number(value) || 0 } }));
  };

  const calcWithAI = async () => {
    if (!draft.food.trim() || !draft.grams) { setCalcError("Preencha o alimento e o peso em gramas."); return; }
    setCalculating(true);
    setCalcError("");

    const inputFood = draft.food.toLowerCase().trim();
    const inputGrams = Number(draft.grams) || 0;

    try {
      const response = await fetch("/api/calc-nutricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food: draft.food, grams: draft.grams })
      });
      if (!response.ok) throw new Error("API Offline");
      const parsed = await response.json();
      
      setDraft(prev => ({
        ...prev,
        kcal: Math.round(parsed.kcal),
        protein: Math.round(parsed.protein_g),
        carb: Math.round(parsed.carb_g),
        fat: Math.round(parsed.fat_g),
        vitamins: parsed.vitamins || "Complexo B"
      }));
    } catch (e) {
      let found = null;
      for (const key in NUTRITION_DATABASE) {
        if (inputFood.includes(key)) {
          found = NUTRITION_DATABASE[key];
          break;
        }
      }

      if (found) {
        setDraft(prev => ({
          ...prev,
          kcal: Math.round(found.kcal * inputGrams),
          protein: Math.round(found.protein * inputGrams),
          carb: Math.round(found.carb * inputGrams),
          fat: Math.round(found.fat * inputGrams),
          vitamins: found.vitamins
        }));
      } else {
        setDraft(prev => ({
          ...prev,
          kcal: Math.round(1.2 * inputGrams),
          protein: Math.round(0.05 * inputGrams),
          carb: Math.round(0.20 * inputGrams),
          fat: Math.round(0.02 * inputGrams),
          vitamins: "Minerais variados (Estimativa Analítica)"
        }));
      }
    }
    setCalculating(false);
  };

  const addMeal = () => {
    if (!draft.food.trim() || draft.kcal === "") return;
    const meal = {
      id: uid(), food: draft.food.trim(), grams: Number(draft.grams) || 0,
      kcal: Number(draft.kcal) || 0, protein: Number(draft.protein) || 0,
      carb: Number(draft.carb) || 0, fat: Number(draft.fat) || 0, vitamins: draft.vitamins || ""
    };
    setNutrition(prev => ({
      ...prev,
      meals: { ...prev.meals, [selectedDate]: [...(prev.meals[selectedDate]||[]), meal] }
    }));
    setDraft({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
    setCalcError("");
  };

  const deleteMeal = (mealId) => {
    setNutrition(prev => ({
      ...prev,
      meals: { ...prev.meals, [selectedDate]: (prev.meals[selectedDate]||[]).filter(m => m.id !== mealId) }
    }));
  };

  const mealsToday = nutrition.meals[selectedDate] || [];
  const totals = mealsToday.reduce((acc, m) => ({
    kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carb: acc.carb + m.carb, fat: acc.fat + m.fat
  }), { kcal:0, protein:0, carb:0, fat:0 });
  const targets = nutrition.targets || DEFAULT_TARGETS;
  const vitaminsList = [...new Set(mealsToday.map(m => m.vitamins).filter(Boolean))];

  if (!loaded) return <div className="flex items-center justify-center h-screen text-zinc-500 text-sm bg-zinc-950">Carregando Protocolos...</div>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 min-h-screen shadow-2xl overflow-hidden flex flex-col justify-center px-6 py-12 border-x border-zinc-900 text-zinc-100 selection:bg-red-500/20 selection:text-red-400" style={{fontFamily:"system-ui, -apple-system, sans-serif"}}>
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-red-600 tracking-widest border-b border-red-950/60 pb-3" style={{fontFamily:"Impact, sans-serif", letterSpacing:"3px"}}>BERSERK</h1>
            <p className="text-zinc-500 text-xs uppercase font-mono tracking-widest mt-2">SISTEMA DE GERENCIAMENTO TÁTICO v2.6</p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl shadow-xl space-y-6 relative">
            <div className="absolute top-0 right-4 transform -translate-y-1/2 bg-red-600 text-[9px] text-black font-black tracking-widest px-2 py-0.5 rounded uppercase">
              {authMode === "login" ? "Acesso Seguro" : "Novo Registro"}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Identificação do Operador</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-600" />
                  <input type="text" placeholder="NOME OU CODINOME" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-200 placeholder-zinc-700 focus:border-red-700 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Código de Acesso</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-600" />
                  <input type="password" placeholder="••••••••••••" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-200 placeholder-zinc-700 focus:border-red-700 focus:outline-none" />
                </div>
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Confirmar Código</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-600" />
                    <input type="password" placeholder="••••••••••••" value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})} className="w-full text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-200 placeholder-zinc-700 focus:border-red-700 focus:outline-none" />
                  </div>
                </div>
              )}

              {authError && (
                <div className="bg-red-950/20 border border-red-900/40 text-red-400 p-3 rounded-lg text-xs font-mono flex items-center gap-2">
                  <ShieldAlert size={14} />
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" className="w-full bg-red-700 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-black tracking-widest flex items-center justify-center gap-2 transition-all uppercase">
                <LogIn size={15} /> {authMode === "login" ? "Inicializar Sistema" : "Registrar Nova Diretriz"}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-zinc-800/40">
              <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }} className="text-xs text-zinc-500 hover:text-zinc-300 font-mono tracking-wide">
                {authMode === "login" ? "NÃO POSSUI MATRÍCULA? REGISTRE-SE" : "JÁ POSSUI IDENTIFICAÇÃO? ENTRAR"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const wd = weekdayOf(selectedDate);
  const tasks = tasksFor(wd);
  const done = (log[selectedDate]?.done) || [];
  const isToday = selectedDate === toDateStr(new Date());

  const Bar = ({ value, max, color }) => (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-zinc-900">
      <div className="h-2 transition-all rounded-full" style={{ width: `${Math.min(100,(value/(max||1))*100)}%`, backgroundColor: color }} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col border-x border-zinc-900 text-zinc-100 selection:bg-red-500/20 selection:text-red-400" style={{fontFamily:"system-ui, -apple-system, sans-serif"}}>
      
      <div className="bg-black px-5 py-4 flex items-center justify-between border-b border-red-950 shadow-md">
        <div>
          <h1 className="text-xl font-black text-red-600 tracking-wider" style={{fontFamily:"Impact, sans-serif", letterSpacing:"1.5px"}}>BERSERK</h1>
          <button onClick={handleLogout} className="text-zinc-600 text-[9px] uppercase font-bold tracking-tight hover:text-red-400">OPERADOR: {user.name} · [SAIR]</button>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-red-900/40 rounded-lg px-3 py-1.5">
          <Trophy size={15} className="text-red-500" />
          <span className="font-mono font-bold text-sm text-zinc-200">{totalPoints} PTS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {view === "hoje" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-zinc-900/30 p-2 rounded-xl border border-zinc-900">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-500 active:scale-95"><ChevronLeft size={16} /></button>
              <div className="text-center">
                <div className="text-sm font-bold text-zinc-200 tracking-wide uppercase">{WEEKDAYS[wd]} {isToday && <span className="text-red-500 font-black animate-pulse">●</span>}</div>
                <div className="text-[11px] font-mono text-zinc-500">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
              </div>
              <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-500 active:scale-95"><ChevronRight size={16} /></button>
            </div>

            <div className="bg-gradient-to-b from-zinc-900 to-zinc-900/70 border border-zinc-800 rounded-xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Progresso do dia</span>
                <span className="text-xs font-mono font-bold text-red-400">{done.length}/{tasks.length} · {dayPoints(selectedDate)} PTS</span>
              </div>
              <Bar value={done.length} max={tasks.length} color="#b91c1c" />
            </div>

            <div className="space-y-2">
              {tasks.length === 0 && (
                <p className="text-center text-xs text-zinc-600 py-12 font-mono">NENHUMA DIRETRIZ CONFIGURADA. VÁ ATÉ A ABA "EDITAR" PARA ADICIONAR TAREFAS.</p>
              )}
              {tasks.map(task => {
                const checked = done.includes(task.id);
                return (
                  <button key={task.id} onClick={() => toggleTask(selectedDate, task.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border ${checked ? "bg-red-950/10 border-red-900/40" : "bg-zinc-900 border-zinc-800/80"}`}>
                    <div className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${checked ? "bg-red-600 border-red-600" : "border-zinc-700 bg-zinc-950"}`}>{checked && <Check size={12} className="text-white stroke-[3]" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold tracking-wide truncate ${checked ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{task.title}</div>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{task.time}</div>
                    </div>
                    <div className={`text-xs font-mono font-bold ${checked ? "text-red-500" : "text-zinc-500"}`}>+{task.points}P</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "dieta" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-md">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Metas Nutricionais</p>
              <div className="grid grid-cols-4 gap-2">
                {[["kcal","Kcal"],["protein","Prot(g)"],["carb","Carb(g)"],["fat","Gord(g)"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">{label}</label>
                    <input type="number" placeholder="0" value={targets[key] || ""} onChange={e=>updateTarget(key, e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1.5 text-zinc-200 mt-1 focus:outline-none focus:border-red-900" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-md space-y-3.5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Macros Consumidos</p>
              {[
                ["Kcal", totals.kcal, targets.kcal, "#b91c1c"],
                ["Proteína", totals.protein, targets.protein, "#16a34a"],
                ["Carboidrato", totals.carb, targets.carb, "#d97706"],
                ["Gordura", totals.fat, targets.fat, "#2563eb"],
              ].map(([label, val, max, color]) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-zinc-400">
                    <span className="tracking-wide">{label}</span>
                    <span className="font-mono">{Math.round(val)} / {max || "Definir"}</span>
                  </div>
                  <Bar value={val} max={max || 1} color={color} />
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-dashed border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5"><Utensils size={13} className="text-red-500"/> Registro de Refeição</p>
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Alimento (ex: arroz branco)" value={draft.food} onChange={e=>setDraft({...draft, food:e.target.value})} className="flex-1 min-w-0 text-sm bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none" />
                <input type="number" placeholder="g" value={draft.grams} onChange={e=>setDraft({...draft, grams:e.target.value})} className="w-16 text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-zinc-200 text-center focus:outline-none" />
              </div>
              <button onClick={calcWithAI} disabled={calculating} className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1.5 mb-3 transition-all">
                {calculating ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                {calculating ? "CALCULANDO..." : "CALCULAR COM IA"}
              </button>
              {calcError && <p className="text-[11px] font-medium text-red-400 mb-3">{calcError}</p>}

              <div className="grid grid-cols-4 gap-2 mb-3">
                {[["kcal","Kcal"],["protein","Prot"],["carb","Carb"],["fat","Gord"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">{label}</label>
                    <input type="number" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1.5 text-zinc-200 mt-1 focus:outline-none" />
                  </div>
                ))}
              </div>
              <input type="text" placeholder="Vitaminas/minerais (opcional)" value={draft.vitamins} onChange={e=>setDraft({...draft, vitamins:e.target.value})} className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 mb-3 focus:outline-none" />

              <button onClick={addMeal} className="w-full bg-zinc-200 hover:bg-zinc-100 text-zinc-950 rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                <Plus size={14} className="stroke-[3]"/> ADICIONAR À DIETA
              </button>
            </div>

            <div className="space-y-2">
              {mealsToday.map(m => (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-200 truncate">{m.food} <span className="text-zinc-500 font-mono text-xs">({m.grams}g)</span></div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{m.kcal}kcal · P:{m.protein}g · C:{m.carb}g · G:{m.fat}g</div>
                  </div>
                  <button onClick={()=>deleteMeal(m.id)} className="text-zinc-600 hover:text-red-500 p-1.5"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "editar" && (
          <div className="space-y-4">
            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1.5 scrollbar-none">
              {WD_SHORT.map((label, idx) => (
                <button key={idx} onClick={() => setEditWeekday(idx)} className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider flex-shrink-0 transition-all ${editWeekday===idx ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-500 border border-zinc-800"}`}>
                  {label.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {(!template[editWeekday] || template[editWeekday].length === 0) && (
                <p className="text-xs text-zinc-600 text-center py-6 font-mono">Nenhuma tarefa herdada para este dia. Use o painel abaixo.</p>
              )}
              {(template[editWeekday]||[]).map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex items-center gap-2">
                  <input type="time" value={task.time} onChange={e => updateTaskField(task.id, "time", e.target.value)} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-18 text-zinc-200 focus:outline-none" />
                  <input type="text" value={task.title} onChange={e => updateTaskField(task.id, "title", e.target.value)} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-1.5 flex-1 min-w-0 text-zinc-200 focus:outline-none" />
                  <input type="number" value={task.points} onChange={e => updateTaskField(task.id, "points", e.target.value)} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-12 text-zinc-200 text-center focus:outline-none" />
                  <button onClick={() => deleteTaskFromWeekday(task.id)} className="text-zinc-600 hover:text-red-500 p-1"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 rounded-xl p-3 border border-dashed border-zinc-800">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Grade Base — {WEEKDAYS[editWeekday]}</p>
              <div className="flex gap-2 mb-2">
                <input type="time" value={newTask.time} onChange={e=>setNewTask({...newTask, time:e.target.value})} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-18 text-zinc-200 focus:outline-none" />
                <input type="text" placeholder="Nova tarefa" value={newTask.title} onChange={e=>setNewTask({...newTask, title:e.target.value})} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-1.5 flex-1 min-w-0 text-zinc-200 placeholder-zinc-700 focus:outline-none" />
                <input type="number" placeholder="pts" value={newTask.points} onChange={e=>setNewTask({...newTask, points:e.target.value})} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-12 text-zinc-200 text-center focus:outline-none" />
              </div>
              <button onClick={addTaskToWeekday} className="w-full bg-red-700 text-white rounded-lg py-1.5 text-xs font-bold uppercase tracking-wider">Injetar Diretriz</button>
            </div>
          </div>
        )}

        {view === "trofeus" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <div className="text-4xl font-black text-red-500 font-mono">{totalPoints}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Pontuação Consolidada</div>
          </div>
        )}
      </div>

      <div className="flex border-t border-zinc-900 bg-black/90 sticky bottom-0">
        {[
          { id:"hoje", label:"Hoje", icon: Check },
          { id:"dieta", label:"Dieta", icon: Utensils },
          { id:"editar", label:"Editar", icon: Pencil },
          { id:"trofeus", label:"Patentes", icon: Trophy },
        ].map(tab => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`flex-1 flex flex-col items-center gap-1 py-3 ${active ? "text-red-500 bg-red-950/5" : "text-zinc-600"}`}>
              <Icon size={16} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}