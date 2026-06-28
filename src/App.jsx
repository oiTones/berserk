import { useState, useEffect, useCallback } from "react";
import { Check, Trophy, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Award, Utensils, Loader2, Sparkles } from "lucide-react";

const WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const WD_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const DEFAULT_TEMPLATE = {
  1: [
    { id:"t1", time:"04:30", title:"Acordar + banho", points:5 },
    { id:"t2", time:"05:00", title:"Revisão leve (espera da van)", points:10 },
    { id:"t3", time:"07:00", title:"Colégio", points:5 },
    { id:"t4", time:"15:00", title:"Bloco 1 — Matemática/Física", points:20 },
    { id:"t5", time:"17:15", title:"Treino", points:15 },
    { id:"t6", time:"18:00", title:"Bloco 2 — Estudo + Caderno de Erros", points:20 },
    { id:"t7", time:"21:30", title:"Dormir (7h de sono)", points:10 },
  ],
  6: [
    { id:"s1", time:"09:00", title:"Simulado completo", points:30 },
    { id:"s2", time:"13:00", title:"Correção do simulado", points:20 },
    { id:"s3", time:"17:00", title:"Caminhada / descanso ativo", points:10 },
  ],
  0: [
    { id:"d1", time:"10:00", title:"Revisão espaçada da semana", points:20 },
    { id:"d2", time:"18:00", title:"Planejamento da próxima semana", points:10 },
  ],
};
for (let i=2;i<=5;i++) DEFAULT_TEMPLATE[i] = DEFAULT_TEMPLATE[1];

const TROPHIES = [
  { id:"bronze", label:"Bronze", threshold:100, color:"#b87333" },
  { id:"prata", label:"Prata", threshold:500, color:"#c0c0c8" },
  { id:"ouro", label:"Ouro", threshold:1500, color:"#d4af37" },
  { id:"platina", label:"Platina", threshold:3000, color:"#5fb8c9" },
  { id:"diamante", label:"Diamante", threshold:6000, color:"#a855f7" },
];

const DEFAULT_TARGETS = { kcal: 2000, protein: 120, carb: 220, fat: 60 };

function pad(n){ return n.toString().padStart(2,"0"); }
function toDateStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromDateStr(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function uid(){ return Math.random().toString(36).slice(2,9); }

const STORAGE_KEY = "berserk-app-state";

// IMPORTANTE: a chamada de IA abaixo usa a rota /api/calc-nutricao,
// que você precisa criar como uma "serverless function" no seu provedor
// de hospedagem (Vercel/Netlify) para esconder sua chave da API.
// Veja as instruções que vou te passar depois de testar localmente.

export default function BerserkApp(){
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
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  const persist = useCallback((t, l, n) => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: t, log: l, nutrition: n }));
    } catch (e) { console.error(e); }
    setSaving(false);
  }, []);

  useEffect(() => { if (loaded) persist(template, log, nutrition); }, [template, log, nutrition, loaded, persist]);

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
    let pts = tasks.filter(t => done.includes(t.id)).reduce((s,t)=>s+t.points,0);
    if (tasks.length > 0 && done.length === tasks.length) pts += 20;
    return pts;
  };

  const totalPoints = Object.keys(log).reduce((sum, d) => sum + dayPoints(d), 0);

  const streak = () => {
    let count = 0;
    let cursor = new Date();
    while (true) {
      const ds = toDateStr(cursor);
      const tasks = tasksFor(cursor.getDay());
      const done = (log[ds]?.done) || [];
      if (tasks.length > 0 && done.length === tasks.length) { count++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
    return count;
  };

  const nextTrophy = TROPHIES.find(t => totalPoints < t.threshold);

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
    try {
      const response = await fetch("/api/calc-nutricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food: draft.food, grams: draft.grams })
      });
      const parsed = await response.json();
      setDraft(prev => ({
        ...prev,
        kcal: Math.round(parsed.kcal),
        protein: Math.round(parsed.protein_g),
        carb: Math.round(parsed.carb_g),
        fat: Math.round(parsed.fat_g),
        vitamins: parsed.vitamins || ""
      }));
    } catch (e) {
      setCalcError("Não consegui calcular automaticamente. Preencha os valores manualmente abaixo.");
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

  if (!loaded) {
    return <div className="flex items-center justify-center h-96 text-zinc-500 text-sm bg-zinc-950">Carregando...</div>;
  }

  const wd = weekdayOf(selectedDate);
  const tasks = tasksFor(wd);
  const done = (log[selectedDate]?.done) || [];
  const completion = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const isToday = selectedDate === toDateStr(new Date());

  const Bar = ({ value, max, color }) => (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div className="h-2 transition-all" style={{ width: `${Math.min(100,(value/(max||1))*100)}%`, backgroundColor: color }} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-zinc-950 min-h-[600px] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-zinc-800" style={{fontFamily:"system-ui, -apple-system, sans-serif"}}>

      <div className="bg-black px-5 py-4 flex items-center justify-between border-b border-red-900/40">
        <div>
          <h1 className="text-lg font-bold text-red-500 tracking-wide" style={{fontFamily:"Georgia, serif", letterSpacing:"1px"}}>BERSERK</h1>
          <p className="text-zinc-500 text-xs">{saving ? "Salvando..." : "Tudo salvo"}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-red-900/50 rounded-full px-3 py-1.5">
          <Trophy size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-zinc-200">{totalPoints} pts</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {view === "hoje" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-full bg-zinc-900 border border-zinc-800 shadow text-zinc-300 active:scale-95">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold text-zinc-100">
                  {WEEKDAYS[wd]} {isToday && <span className="text-red-500">(hoje)</span>}
                </div>
                <div className="text-xs text-zinc-500">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
              </div>
              <button onClick={() => shiftDate(1)} className="p-2 rounded-full bg-zinc-900 border border-zinc-800 shadow text-zinc-300 active:scale-95">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-zinc-500">Progresso do dia</span>
                <span className="text-xs font-semibold text-zinc-300">{done.length}/{tasks.length} · {dayPoints(selectedDate)} pts</span>
              </div>
              <Bar value={done.length} max={tasks.length} color="#dc2626" />
            </div>

            <div className="space-y-2">
              {tasks.length === 0 && (
                <p className="text-center text-sm text-zinc-500 py-8">Nenhuma tarefa para este dia. Adicione em "Editar".</p>
              )}
              {tasks.map(task => {
                const checked = done.includes(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(selectedDate, task.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl shadow-sm text-left transition-all active:scale-[0.98] border ${checked ? "bg-red-950/30 border-red-900/50" : "bg-zinc-900 border-zinc-800"}`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 ${checked ? "bg-red-600 border-red-600" : "border-zinc-600"}`}>
                      {checked && <Check size={14} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${checked ? "text-red-300 line-through" : "text-zinc-200"}`}>{task.title}</div>
                      <div className="text-xs text-zinc-500">{task.time}</div>
                    </div>
                    <div className={`text-xs font-semibold ${checked ? "text-red-400" : "text-zinc-500"}`}>+{task.points}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "dieta" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95">
                <ChevronLeft size={18} />
              </button>
              <div className="text-xs text-zinc-400 font-medium">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
              <button onClick={() => shiftDate(1)} className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm mb-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">Meta diária</p>
              <div className="grid grid-cols-4 gap-2">
                {[["kcal","Kcal"],["protein","Prot(g)"],["carb","Carb(g)"],["fat","Gord(g)"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] text-zinc-500">{label}</label>
                    <input type="number" value={targets[key]} onChange={e=>updateTarget(key, e.target.value)}
                      className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm mb-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500">Consumido hoje</p>
              {[
                ["Kcal", totals.kcal, targets.kcal, "#dc2626"],
                ["Proteína", totals.protein, targets.protein, "#22c55e"],
                ["Carboidrato", totals.carb, targets.carb, "#f59e0b"],
                ["Gordura", totals.fat, targets.fat, "#3b82f6"],
              ].map(([label, val, max, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                    <span>{label}</span><span>{Math.round(val)} / {max}</span>
                  </div>
                  <Bar value={val} max={max} color={color} />
                </div>
              ))}
              {vitaminsList.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] text-zinc-500 mb-1">Vitaminas/minerais do dia:</p>
                  <p className="text-[11px] text-zinc-300">{vitaminsList.join(" · ")}</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4 mb-4">
              <p className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5"><Utensils size={13}/> Adicionar alimento</p>
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Alimento (ex: arroz branco)" value={draft.food}
                  onChange={e=>setDraft({...draft, food:e.target.value})}
                  className="flex-1 min-w-0 text-sm bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200" />
                <input type="number" placeholder="g" value={draft.grams}
                  onChange={e=>setDraft({...draft, grams:e.target.value})}
                  className="w-16 text-sm bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200" />
              </div>
              <button onClick={calcWithAI} disabled={calculating}
                className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 mb-2">
                {calculating ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
                {calculating ? "Calculando..." : "Calcular com IA"}
              </button>
              {calcError && <p className="text-[11px] text-red-400 mb-2">{calcError}</p>}

              <div className="grid grid-cols-4 gap-2 mb-2">
                {[["kcal","Kcal"],["protein","Prot"],["carb","Carb"],["fat","Gord"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] text-zinc-500">{label}</label>
                    <input type="number" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}
                      className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200 mt-0.5" />
                  </div>
                ))}
              </div>
              <input type="text" placeholder="Vitaminas/minerais (opcional)" value={draft.vitamins}
                onChange={e=>setDraft({...draft, vitamins:e.target.value})}
                className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 mb-2" />

              <button onClick={addMeal} className="w-full bg-zinc-100 text-zinc-900 rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95">
                <Plus size={15}/> Adicionar à refeição
              </button>
            </div>

            <div className="space-y-2">
              {mealsToday.map(m => (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-200">{m.food} <span className="text-zinc-500 text-xs">({m.grams}g)</span></div>
                    <div className="text-[11px] text-zinc-500">{m.kcal}kcal · P{m.protein}g · C{m.carb}g · G{m.fat}g</div>
                  </div>
                  <button onClick={()=>deleteMeal(m.id)} className="text-red-500 p-1"><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "editar" && (
          <div>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
              {WD_SHORT.map((label, idx) => (
                <button key={idx} onClick={() => setEditWeekday(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${editWeekday===idx ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-4">
              {(template[editWeekday]||[]).map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-2">
                  <input type="time" value={task.time} onChange={e => updateTaskField(task.id, "time", e.target.value)}
                    className="text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 w-20 text-zinc-200" />
                  <input type="text" value={task.title} onChange={e => updateTaskField(task.id, "title", e.target.value)}
                    className="text-sm bg-zinc-950 border border-zinc-700 rounded px-2 py-1 flex-1 min-w-0 text-zinc-200" />
                  <input type="number" value={task.points} onChange={e => updateTaskField(task.id, "points", e.target.value)}
                    className="text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 w-12 text-zinc-200" />
                  <button onClick={() => deleteTaskFromWeekday(task.id)} className="text-red-500 p-1"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 rounded-xl p-3 shadow-sm border border-dashed border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 mb-2">Nova tarefa — {WEEKDAYS[editWeekday]}</p>
              <div className="flex gap-2 mb-2">
                <input type="time" value={newTask.time} onChange={e=>setNewTask({...newTask, time:e.target.value})}
                  className="text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 w-20 text-zinc-200" />
                <input type="text" placeholder="Título da tarefa" value={newTask.title} onChange={e=>setNewTask({...newTask, title:e.target.value})}
                  className="text-sm bg-zinc-950 border border-zinc-700 rounded px-2 py-1 flex-1 min-w-0 text-zinc-200" />
                <input type="number" placeholder="pts" value={newTask.points} onChange={e=>setNewTask({...newTask, points:e.target.value})}
                  className="text-xs bg-zinc-950 border border-zinc-700 rounded px-1.5 py-1 w-12 text-zinc-200" />
              </div>
              <button onClick={addTaskToWeekday} className="w-full bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95">
                <Plus size={15} /> Adicionar tarefa
              </button>
            </div>
          </div>
        )}

        {view === "trofeus" && (
          <div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm mb-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{totalPoints}</div>
              <div className="text-xs text-zinc-500 mb-3">pontos totais</div>
              <div className="flex items-center justify-center gap-1.5 text-orange-500">
                <Flame size={16} />
                <span className="text-sm font-semibold">{streak()} dias de sequência completa</span>
              </div>
              {nextTrophy && (
                <p className="text-xs text-zinc-500 mt-3">Faltam {nextTrophy.threshold - totalPoints} pts para o troféu {nextTrophy.label}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {TROPHIES.map(t => {
                const unlocked = totalPoints >= t.threshold;
                return (
                  <div key={t.id} className={`rounded-xl p-4 text-center shadow-sm border ${unlocked ? "bg-zinc-900 border-zinc-700" : "bg-zinc-950 border-zinc-900 opacity-50"}`}>
                    <Award size={32} style={{ color: unlocked ? t.color : "#3f3f46", margin:"0 auto" }} />
                    <div className="text-sm font-semibold mt-2 text-zinc-200">{t.label}</div>
                    <div className="text-xs text-zinc-500">{t.threshold} pts</div>
                    {unlocked && <div className="text-[10px] text-red-400 font-medium mt-1">Conquistado ✓</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex border-t border-zinc-800 bg-black">
        {[
          { id:"hoje", label:"Hoje", icon: Check },
          { id:"dieta", label:"Dieta", icon: Utensils },
          { id:"editar", label:"Editar", icon: Pencil },
          { id:"trofeus", label:"Troféus", icon: Trophy },
        ].map(tab => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button key={tab.id} onClick={() => setView(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${active ? "text-red-500" : "text-zinc-500"}`}>
              <Icon size={18} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}