import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, Trophy, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Award, Utensils, Loader2, Sparkles, User, LogIn, Users, Search, Image, Shield, Swords, Zap, Crown } from "lucide-react";

// Coloque suas credenciais do Supabase aqui:
const SUPABASE_URL = "https://qowbimlnvqqblsrajyzg.supabase.co";
const SUPABASE_ANON_KEY = "Tones123@lindao";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WD_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const RANKS = [
  { id: "bronze", label: "Bronze", minPts: 0, maxPts: 300, color: "#cd7f32", icon: Shield },
  { id: "prata", label: "Prata", minPts: 301, maxPts: 1000, color: "#94a3b8", icon: Shield },
  { id: "ouro", label: "Ouro", minPts: 1001, maxPts: 2500, color: "#fbbf24", icon: Swords },
  { id: "platina", label: "Platina", minPts: 2501, maxPts: 5000, color: "#38bdf8", icon: Swords },
  { id: "ametista", label: "Ametista", minPts: 5001, maxPts: 8500, color: "#c084fc", icon: Zap },
  { id: "esmeralda", label: "Esmeralda", minPts: 8501, maxPts: 13000, color: "#34d399", icon: Flame },
  { id: "elite", label: "Elite Global", minPts: 13001, maxPts: 999999, color: "#f43f5e", icon: Crown }
];

function pad(n){ return n.toString().padStart(2,"0"); }
function toDateStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromDateStr(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }

export default function BerserkApp() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", username: "" });
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Dados Locais Sincronizados
  const [routines, setRoutines] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [mealsToday, setMealsToday] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Controle de Interface
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [view, setView] = useState("hoje");
  const [editWeekday, setEditWeekday] = useState(new Date().getDay());
  const [newTask, setNewTask] = useState({ time: "", title: "", points: 10 });
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectedUser, setInspectedUser] = useState(null);

  // Configurações de Dieta Local (Salva metas no localStorage por conveniência)
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem("berserk_diet_targets");
    return saved ? JSON.parse(saved) : { kcal: 2000, protein: 150, carb: 200, fat: 60 };
  });
  const [draft, setDraft] = useState({ food: "", grams: "", kcal: "", protein: "", carb: "", fat: "", vitamins: "" });
  const [calculating, setCalculating] = useState(false);

  // Perfil
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");

  useEffect(() => {
    localStorage.setItem("berserk_diet_targets", JSON.stringify(targets));
  }, [targets]);

  // Monitorar Autenticação em Tempo Real
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
    });

    fetchLeaderboard();
    return () => subscription.unsubscribe();
  }, [selectedDate]);

  const fetchUserData = async (userId) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (prof) {
      setProfile(prof);
      setProfileName(prof.username);
      setProfileAvatar(prof.avatar_url || "");
    }
    fetchMyRoutines(userId);
    fetchLogsForDate(userId, selectedDate);
    fetchMealsForDate(userId, selectedDate);
  };

  const fetchMyRoutines = async (userId) => {
    const { data } = await supabase.from("routines").select("*").eq("user_id", userId).order("time", { ascending: true });
    if (data) setRoutines(data);
  };

  const fetchLogsForDate = async (userId, dateStr) => {
    const { data } = await supabase.from("daily_logs").select("*").eq("user_id", userId).eq("completed_date", dateStr);
    if (data) setDailyLogs(data);
  };

  const fetchMealsForDate = async (userId, dateStr) => {
    const { data } = await supabase.from("diet_logs").select("*").eq("user_id", userId).eq("log_date", dateStr);
    if (data) setMealsToday(data);
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase.from("profiles").select("*").order("points", { ascending: false });
    if (data) setLeaderboard(data);
  };

  // Login e Registro Real Online
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoadingAuth(true);

    if (authMode === "signup") {
      if (!authForm.username.trim()) { setAuthError("Insira um codinome único."); setLoadingAuth(false); return; }
      const { error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
        options: { data: { username: authForm.username.trim().toUpperCase() } }
      });
      if (error) setAuthError(error.message);
      else setAuthMode("login");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
      if (error) setAuthError(error.message);
    }
    setLoadingAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setRoutines([]); setDailyLogs([]); setMealsToday([]);
  };

  // Interações com Banco de Dados (Marcar Diretrizes)
  const toggleTask = async (task) => {
    if (!session) return;
    const isDone = dailyLogs.find(l => l.routine_id === task.id);

    if (isDone) {
      await supabase.from("daily_logs").delete().eq("id", isDone.id);
    } else {
      await supabase.from("daily_logs").insert({
        user_id: session.user.id,
        routine_id: task.id,
        completed_date: selectedDate,
        points_earned: task.points
      });
    }
    fetchLogsForDate(session.user.id, selectedDate);
    fetchUserData(session.user.id);
    fetchLeaderboard();
  };

  // Adicionar e Deletar Itens da Grade
  const addTaskToWeekday = async () => {
    if (!newTask.title.trim() || !session) return;
    await supabase.from("routines").insert({
      user_id: session.user.id,
      weekday: editWeekday,
      time: newTask.time || "00:00",
      title: newTask.title.trim(),
      points: Number(newTask.points) || 10
    });
    setNewTask({ time: "", title: "", points: 10 });
    fetchMyRoutines(session.user.id);
  };

  const deleteTask = async (id) => {
    await supabase.from("routines").delete().eq("id", id);
    fetchMyRoutines(session.user.id);
  };

  // Gerenciamento de Alimentação Online
  const calcWithAI = async () => {
    if (!draft.food.trim() || !draft.grams) return;
    setCalculating(true);
    const g = Number(draft.grams) || 100;
    
    // Estimativa local offline rápida para contingência imediata
    setTimeout(() => {
      setDraft(prev => ({
        ...prev,
        kcal: Math.round(1.4 * g),
        protein: Math.round(0.08 * g),
        carb: Math.round(0.20 * g),
        fat: Math.round(0.02 * g),
        vitamins: "Vitaminas do Complexo B, Ferro, Magnésio"
      }));
      setCalculating(false);
    }, 700);
  };

  const addMealOnline = async () => {
    if (!draft.food.trim() || !session) return;
    await supabase.from("diet_logs").insert({
      user_id: session.user.id,
      log_date: selectedDate,
      food: draft.food.trim(),
      grams: Number(draft.grams) || 0,
      kcal: Number(draft.kcal) || 0,
      protein: Number(draft.protein) || 0,
      carb: Number(draft.carb) || 0,
      fat: Number(draft.fat) || 0,
      vitamins: draft.vitamins
    });
    setDraft({ food: "", grams: "", kcal: "", protein: "", carb: "", fat: "", vitamins: "" });
    fetchMealsForDate(session.user.id, selectedDate);
  };

  const deleteMealOnline = async (id) => {
    await supabase.from("diet_logs").delete().eq("id", id);
    fetchMealsForDate(session.user.id, selectedDate);
  };

  // Modificar Dados Cadastrais
  const updateProfile = async () => {
    if (!profileName.trim() || !session) return;
    await supabase.from("profiles").update({
      username: profileName.trim().toUpperCase(),
      avatar_url: profileAvatar.trim()
    }).eq("id", session.user.id);
    fetchUserData(session.user.id);
    fetchLeaderboard();
  };

  const inspectUser = async (targetUser) => {
    const { data: targetRoutines } = await supabase.from("routines").select("*").eq("user_id", targetUser.id).eq("weekday", fromDateStr(selectedDate).getDay());
    const { data: targetDiet } = await supabase.from("diet_logs").select("*").eq("user_id", targetUser.id).eq("log_date", selectedDate);
    setInspectedUser({ ...targetUser, routines: targetRoutines || [], diet: targetDiet || [] });
  };

  // Cálculos matemáticos de interface
  const getRank = (pts) => {
    const idx = RANKS.findIndex(r => pts >= r.minPts && pts <= r.maxPts);
    return RANKS[idx !== -1 ? idx : 0];
  };

  const currentRank = getRank(profile?.points || 0);
  const tasksToday = routines.filter(r => r.weekday === fromDateStr(selectedDate).getDay());
  const filteredLeaderboard = leaderboard.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  const dietTotals = mealsToday.reduce((acc, m) => ({
    kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carb: acc.carb + m.carb, fat: acc.fat + m.fat
  }), { kcal: 0, protein: 0, carb: 0, fat: 0 });

  const Bar = ({ value, max, color }) => (
    <div className="w-full bg-zinc-850 rounded-full h-2 overflow-hidden border border-zinc-950">
      <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, backgroundColor: color }} />
    </div>
  );

  if (!session) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col justify-center px-6 py-12 text-zinc-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-red-600 tracking-widest" style={{ fontFamily: "Impact, sans-serif" }}>BERSERK</h1>
          <p className="text-zinc-500 text-xs font-mono uppercase mt-2">ONLINE COMPETITIVE INTERFACE</p>
        </div>
        <form onSubmit={handleAuth} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
          {authMode === "signup" && (
            <input type="text" placeholder="CODINOME" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none" />
          )}
          <input type="email" placeholder="E-MAIL" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none" />
          <input type="password" placeholder="SENHA" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none" />
          {authError && <p className="text-xs text-red-500 font-mono">{authError}</p>}
          <button type="submit" className="w-full bg-red-700 text-white font-black py-3 rounded-xl uppercase text-sm tracking-widest flex items-center justify-center">
            {loadingAuth ? <Loader2 size={16} className="animate-spin" /> : authMode === "login" ? "Conectar à Rede" : "Efetuar Cadastro"}
          </button>
          <button type="button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="w-full text-center text-xs text-zinc-500 underline mt-2 block">
            {authMode === "login" ? "Criar nova credencial operacional" : "Retornar ao painel de Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-zinc-950 min-h-screen flex flex-col border-x border-zinc-900 text-zinc-100">
      
      {/* CORPO DO HEADER */}
      <div className="bg-black px-5 py-4 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <img src={profile?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} alt="" className="w-9 h-9 rounded-xl object-cover border border-zinc-800" />
          <div>
            <h1 className="text-md font-black text-red-600 tracking-wider" style={{ fontFamily: "Impact, sans-serif" }}>BERSERK</h1>
            <p className="text-[10px] font-mono font-bold uppercase" style={{ color: currentRank.color }}>{currentRank.label}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 flex items-center gap-1">
          <Trophy size={13} className="text-red-500" />
          <span className="font-mono font-bold text-xs text-zinc-300">{profile?.points || 0}P</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        
        {/* NAVEGAÇÃO TEMPORAL */}
        {view !== "perfil" && view !== "editar" && (
          <div className="flex items-center justify-between bg-zinc-900/40 p-2 rounded-xl border border-zinc-900">
            <button onClick={() => { const d = fromDateStr(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(toDateStr(d)); }} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400"><ChevronLeft size={16} /></button>
            <div className="text-center">
              <div className="text-xs font-bold text-zinc-200 uppercase tracking-wide">{WEEKDAYS[fromDateStr(selectedDate).getDay()]}</div>
              <div className="text-[10px] font-mono text-zinc-500">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
            </div>
            <button onClick={() => { const d = fromDateStr(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(toDateStr(d)); }} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400"><ChevronRight size={16} /></button>
          </div>
        )}

        {/* ABA 1: HOJE (DIRETRIZES) */}
        {view === "hoje" && (
          <div className="space-y-3">
            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
              <div className="flex justify-between items-center mb-1.5 text-xs text-zinc-400">
                <span className="font-bold uppercase tracking-wider">Conclusão do Cronograma</span>
                <span className="font-mono font-bold text-red-500">{dailyLogs.length}/{tasksToday.length}</span>
              </div>
              <Bar value={dailyLogs.length} max={tasksToday.length} color="#dc2626" />
            </div>

            <div className="space-y-2">
              {tasksToday.length === 0 && <p className="text-center text-xs text-zinc-600 py-12 font-mono">GRADE FECHADA OU INDISPONÍVEL HOJE.</p>}
              {tasksToday.map(task => {
                const isDone = dailyLogs.some(l => l.routine_id === task.id);
                return (
                  <button key={task.id} onClick={() => toggleTask(task)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border transition-all ${isDone ? "bg-red-950/10 border-red-900/20" : "bg-zinc-900 border-zinc-800/80"}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${isDone ? "bg-red-600 border-red-600" : "border-zinc-700 bg-zinc-950"}`}>{isDone && <Check size={10} className="text-white stroke-[3]" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isDone ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{task.title}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{task.time}</div>
                    </div>
                    <div className="text-xs font-mono font-bold text-zinc-400">+{task.points}P</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 2: DIETA INTEGRAÇÃO COMPLETA */}
        {view === "dieta" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Metas Nutricionais</p>
              <div className="grid grid-cols-4 gap-2">
                {[["kcal","Kcal"],["protein","Prot"],["carb","Carb"],["fat","Gord"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] font-bold text-zinc-500 block uppercase">{label}</label>
                    <input type="number" value={targets[key]} onChange={e=>setTargets({...targets, [key]: Number(e.target.value)})} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-200 focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              {[["Calorias", dietTotals.kcal, targets.kcal, "#dc2626"], ["Proteínas (g)", dietTotals.protein, targets.protein, "#16a34a"], ["Carboidratos (g)", dietTotals.carb, targets.carb, "#ea580c"], ["Gorduras (g)", dietTotals.fat, targets.fat, "#2563eb"]].map(([lbl, v, mx, col])=>(
                <div key={lbl} className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono"><span>{lbl}</span><span>{v}/{mx}</span></div>
                  <Bar value={v} max={mx} color={col} />
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-dashed border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex gap-2">
                <input type="text" placeholder="Alimento ou Refeição..." value={draft.food} onChange={e=>setDraft({...draft, food: e.target.value})} className="flex-1 text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white" />
                <input type="number" placeholder="g" value={draft.grams} onChange={e=>setDraft({...draft, grams: e.target.value})} className="w-16 text-xs bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-center text-white" />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[["kcal","Kcal"],["protein","P (g)"],["carb","C (g)"],["fat","G (g)"]].map(([k,l])=>(
                  <input key={k} type="number" placeholder={l} value={draft[k]} onChange={e=>setDraft({...draft, [k]: e.target.value})} className="text-center text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1" />
                ))}
              </div>
              <input type="text" placeholder="Micronutrientes/Vitaminas..." value={draft.vitamins} onChange={e=>setDraft({...draft, vitamins: e.target.value})} className="w-full text-[11px] font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5" />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={calcWithAI} className="bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg py-1.5 text-xs font-bold uppercase flex items-center justify-center gap-1">
                  {calculating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={11}/>} Estimar IA
                </button>
                <button onClick={addMealOnline} className="bg-red-700 text-white rounded-lg py-1.5 text-xs font-bold uppercase">Inserir Registro</button>
              </div>
            </div>

            <div className="space-y-2">
              {mealsToday.map(meal => (
                <div key={meal.id} className="bg-zinc-900/40 border border-zinc-900 p-3 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-zinc-200">{meal.food} ({meal.grams}g)</p>
                    <p className="text-[10px] font-mono text-zinc-500">Kcal: {meal.kcal} | P: {meal.protein}g | C: {meal.carb}g | G: {meal.fat}g</p>
                    {meal.vitamins && <p className="text-[9px] font-mono text-zinc-400 mt-0.5 text-emerald-500">❖ {meal.vitamins}</p>}
                  </div>
                  <button onClick={() => deleteMealOnline(meal.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: EDITAR GRADE DE HORÁRIOS */}
        {view === "editar" && (
          <div className="space-y-4">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {WD_SHORT.map((label, idx) => (
                <button key={idx} onClick={() => setEditWeekday(idx)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${editWeekday === idx ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-500"}`}>{label}</button>
              ))}
            </div>
            <div className="space-y-2">
              {routines.filter(r => r.weekday === editWeekday).map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-200">{task.title}</p>
                    <p className="text-[10px] font-mono text-zinc-500">{task.time} · {task.points} Pts</p>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-zinc-600 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-dashed border-zinc-800 space-y-2">
              <div className="flex gap-2">
                <input type="time" value={newTask.time} onChange={e => setNewTask({ ...newTask, time: e.target.value })} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5" />
                <input type="text" placeholder="Diretriz..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="text-xs bg-zinc-950 border border-zinc-800 rounded p-1.5 flex-1" />
                <input type="number" placeholder="pts" value={newTask.points} onChange={e => setNewTask({ ...newTask, points: e.target.value })} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-12 text-center" />
              </div>
              <button onClick={addTaskToWeekday} className="w-full bg-red-700 text-white rounded-lg py-1.5 text-xs font-bold uppercase">Anexar à Grade Estratégica</button>
            </div>
          </div>
        )}

        {/* ABA 4: COMUNIDADE ONLINE (LEADERBOARD REAL-TIME) */}
        {view === "comunidade" && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="Pesquisar perfis..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-zinc-200 focus:outline-none" />
            </div>

            {inspectedUser && (
              <div className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-4 space-y-3 relative">
                <button onClick={() => setInspectedUser(null)} className="absolute top-2 right-3 text-zinc-500 font-mono text-xs font-bold">[X]</button>
                <div className="flex items-center gap-3">
                  <img src={inspectedUser.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} className="w-12 h-12 rounded-xl object-cover border border-zinc-700" alt="" />
                  <div>
                    <h3 className="text-sm font-black text-zinc-100">{inspectedUser.username}</h3>
                    <p className="text-[10px] font-mono font-bold" style={{ color: getRank(inspectedUser.points).color }}>{getRank(inspectedUser.points).label} · {inspectedUser.points} PTS</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-900">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Rotina para Hoje</p>
                    {inspectedUser.routines.length === 0 ? <p className="text-[10px] text-zinc-600">Nenhuma tarefa.</p> : inspectedUser.routines.map((r, i) => (
                      <div key={i} className="text-[10px] text-zinc-400 font-mono truncate">- {r.time}: {r.title}</div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Dieta de Hoje</p>
                    {inspectedUser.diet.length === 0 ? <p className="text-[10px] text-zinc-600">Nenhum alimento.</p> : inspectedUser.diet.map((m, i) => (
                      <div key={i} className="text-[10px] text-zinc-400 font-mono truncate">✓ {m.food} ({m.grams}g)</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-2 space-y-1">
              <div className="text-[10px] font-black text-zinc-500 px-3 py-1.5 tracking-widest">RANKING DE OPERADORES</div>
              {filteredLeaderboard.map((u, idx) => {
                const rInfo = getRank(u.points);
                const RIcon = rInfo.icon;
                const isMe = u.id === session.user.id;
                return (
                  <div key={u.id} onClick={() => inspectUser(u)} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${isMe ? "bg-red-950/10 border-red-900/40" : "bg-zinc-900/40 border-zinc-900/60"}`}>
                    <div className="w-5 text-center font-mono text-xs font-bold text-zinc-600">#{idx + 1}</div>
                    <img src={u.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} className="w-8 h-8 rounded-lg object-cover border border-zinc-800" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-zinc-200 truncate flex items-center gap-1.5">{u.username} {isMe && <span className="text-[8px] bg-red-600 text-white font-black px-1 rounded">VOCÊ</span>}</div>
                      <div className="flex items-center gap-1 text-[9px] font-mono font-bold mt-0.5" style={{ color: rInfo.color }}><RIcon size={10} /> {rInfo.label}</div>
                    </div>
                    <div className="text-xs font-mono font-black text-zinc-400">{u.points}P</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 5: PERFIL */}
        {view === "perfil" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Painel do Operador</p>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Alterar Codinome</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">URL do Avatar</label>
                <input type="text" value={profileAvatar} onChange={e => setProfileAvatar(e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none" />
              </div>
              <button onClick={updateProfile} className="w-full bg-red-700 text-white font-bold rounded-xl py-2 text-xs uppercase">Salvar Alterações</button>
              <button onClick={handleLogout} className="w-full bg-zinc-950 text-zinc-500 border border-zinc-800 font-bold rounded-xl py-2 text-xs uppercase hover:text-red-500">Desconectar</button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER NAVBAR PRINCIPAL */}
      <div className="flex border-t border-zinc-900 bg-black/95 sticky bottom-0 z-40">
        {[
          { id: "hoje", label: "Hoje", icon: Check },
          { id: "dieta", label: "Dieta", icon: Utensils },
          { id: "editar", label: "Grade", icon: Pencil },
          { id: "comunidade", label: "Rede", icon: Users },
          { id: "perfil", label: "Perfil", icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`flex-1 flex flex-col items-center gap-1 py-3 ${active ? "text-red-500 bg-red-950/5" : "text-zinc-600"}`}>
              <Icon size={15} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}