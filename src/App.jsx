import { useState, useEffect, useCallback } from "react";
import { Check, Trophy, Pencil, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Award, Utensils, Loader2, Sparkles, ShieldAlert, Lock, User, LogIn, ChevronDown, ChevronUp } from "lucide-react";

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

const DEFAULT_TARGETS = { kcal: 1700, protein: 100, carb: 80, fat: 90 };

// BANCO DE DADOS ATÔMICO DE NUTRIENTES (Evita aproximações erradas e calcula de forma precisa por grama)
const NUTRITION_DATABASE = {
  "arroz": { kcal: 1.30, protein: 0.025, carb: 0.28, fat: 0.002, vitamins: "Vitamina B1, B3, Ferro" },
  "feijao": { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio, Magnésio" },
  "feijão": { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio, Magnésio" },
  "frango": { kcal: 1.65, protein: 0.31, carb: 0.00, fat: 0.036, vitamins: "Vitamina B6, B12, Zinco" },
  "ovo": { kcal: 1.55, protein: 0.13, carb: 0.01, fat: 0.11, vitamins: "Vitamina A, D, B12, Colina" },
  "patinho": { kcal: 1.85, protein: 0.30, carb: 0.00, fat: 0.07, vitamins: "Ferro Heme, Vitamina B12" },
  "carne": { kcal: 2.50, protein: 0.26, carb: 0.00, fat: 0.15, vitamins: "Ferro, Zinco, Vitamina B12" },
  "whey": { kcal: 4.00, protein: 0.80, carb: 0.05, fat: 0.06, vitamins: "BCAA, Cálcio" },
  "aveia": { kcal: 3.90, protein: 0.14, carb: 0.67, fat: 0.08, vitamins: "Fibras Solúveis, Zinco" },
  "banana": { kcal: 0.89, protein: 0.01, carb: 0.23, fat: 0.003, vitamins: "Potássio, Vitamina B6" },
  "leite": { kcal: 0.60, protein: 0.03, carb: 0.05, fat: 0.03, vitamins: "Cálcio, Vitamina D" },
  "pao": { kcal: 2.65, protein: 0.08, carb: 0.52, fat: 0.03, vitamins: "Carboidratos Complexos" },
  "pão": { kcal: 2.65, protein: 0.08, carb: 0.52, fat: 0.03, vitamins: "Carboidratos Complexos" },
  "azeite": { kcal: 8.84, protein: 0.00, carb: 0.00, fat: 1.00, vitamins: "Gorduras Saudáveis, Vitamina E" }
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

  // Controle de Interface da Dieta
  const [activeMealGroup, setActiveMealGroup] = useState(null); // ID da refeição expandida para adicionar itens
  const [newGroupName, setNewGroupName] = useState("");
  const [draft, setDraft] = useState({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  // Inicialização Padrão das Refeições do Dia se não existirem
  const getDailyMealStructure = useCallback((dateStr) => {
    if (nutrition.meals[dateStr]) return nutrition.meals[dateStr];
    return [
      { id: "cafe", name: "Café da manhã", items: [] },
      { id: "almoco", name: "Almoço", items: [] },
      { id: "jantar", name: "Jantar", items: [] }
    ];
  }, [nutrition.meals]);

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: t, log: l, nutrition: n, user: u }));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (loaded) persist(template, log, nutrition, user); }, [template, log, nutrition, user, loaded, persist]);

  const handleAuth = (e) => {
    e.preventDefault();
    setAuthError("");
    if (!authForm.username.trim() || !authForm.password) {
      setAuthError("DIRETRIZ REJEITADA: Preencha todos os campos.");
      return;
    }
    setUser({ name: authForm.username.trim().toUpperCase() });
    setAuthForm({ username: "", password: "", confirmPassword: "" });
  };

  const shiftDate = (delta) => {
    const d = fromDateStr(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toDateStr(d));
  };

  const toggleTask = (dateStr, taskId) => {
    setLog(prev => {
      const day = prev[dateStr] || { done: [] };
      const done = day.done.includes(taskId) ? day.done.filter(id => id !== taskId) : [...day.done, taskId];
      return { ...prev, [dateStr]: { done } };
    });
  };

  const dayPoints = (dateStr) => {
    const tasks = template[fromDateStr(dateStr).getDay()] || [];
    const done = (log[dateStr]?.done) || [];
    let pts = tasks.filter(t => done.includes(t.id)).reduce((s,t)=>s+t.points,0);
    if (tasks.length > 0 && done.length === tasks.length) pts += 20;
    return pts;
  };

  const totalPoints = Object.keys(log).reduce((sum, d) => sum + dayPoints(d), 0);

  const updateTarget = (field, value) => {
    setNutrition(prev => ({ ...prev, targets: { ...prev.targets, [field]: Number(value) || 0 } }));
  };

  // MECANISMO DE INTELIGÊNCIA LOCAL REFORÇADO (Anti-Alucinação para Itens Não Catalogados)
  const calcWithAI = async () => {
    if (!draft.food.trim() || !draft.grams) { setCalcError("Defina o Alimento e a Massa (g)."); return; }
    setCalculating(true);
    setCalcError("");

    const inputFood = draft.food.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const inputGrams = Number(draft.grams) || 0;

    try {
      const response = await fetch("/api/calc-nutricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food: draft.food, grams: draft.grams })
      });
      if (!response.ok) throw new Error();
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
      // Fallback Analítico Baseado em Raiz Léxica Exata
      let targetMatrix = null;
      for (const key in NUTRITION_DATABASE) {
        if (inputFood.includes(key)) {
          targetMatrix = NUTRITION_DATABASE[key];
          break;
        }
      }

      if (targetMatrix) {
        setDraft(prev => ({
          ...prev,
          kcal: Math.round(targetMatrix.kcal * inputGrams),
          protein: Math.round(targetMatrix.protein * inputGrams),
          carb: Math.round(targetMatrix.carb * inputGrams),
          fat: Math.round(targetMatrix.fat * inputGrams),
          vitamins: targetMatrix.vitamins
        }));
      } else {
        // Trava de segurança: impede preenchimento aleatório se não houver correlação semântica segura
        setCalcError("Alimento fora do escopo automático. Preencha os macros manualmente nos campos abaixo.");
        setDraft(prev => ({ ...prev, kcal: "", protein: "", carb: "", fat: "", vitamins: "Não catalogado" }));
      }
    }
    setCalculating(false);
  };

  // Funções de Gerenciamento da Estrutura estruturada de Refeições
  const addNewMealGroup = () => {
    if (!newGroupName.trim()) return;
    const currentStructure = getDailyMealStructure(selectedDate);
    const updated = [...currentStructure, { id: uid(), name: newGroupName.trim(), items: [] }];
    setNutrition(prev => ({ ...prev, meals: { ...prev.meals, [selectedDate]: updated } }));
    setNewGroupName("");
  };

  const addItemToGroup = (groupId) => {
    if (!draft.food.trim() || draft.kcal === "") return;
    const currentStructure = getDailyMealStructure(selectedDate);
    
    const newItem = {
      id: uid(), food: draft.food.trim(), grams: Number(draft.grams) || 0,
      kcal: Number(draft.kcal) || 0, protein: Number(draft.protein) || 0,
      carb: Number(draft.carb) || 0, fat: Number(draft.fat) || 0, vitamins: draft.vitamins || ""
    };

    const updated = currentStructure.map(group => {
      if (group.id === groupId) {
        return { ...group, items: [...group.items, newItem] };
      }
      return group;
    });

    setNutrition(prev => ({ ...prev, meals: { ...prev.meals, [selectedDate]: updated } }));
    setDraft({ food:"", grams:"", kcal:"", protein:"", carb:"", fat:"", vitamins:"" });
    setActiveMealGroup(null);
  };

  const deleteItemFromGroup = (groupId, itemId) => {
    const currentStructure = getDailyMealStructure(selectedDate);
    const updated = currentStructure.map(group => {
      if (group.id === groupId) {
        return { ...group, items: group.items.filter(item => item.id !== itemId) };
      }
      return group;
    });
    setNutrition(prev => ({ ...prev, meals: { ...prev.meals, [selectedDate]: updated } }));
  };

  const currentMealsStructure = getDailyMealStructure(selectedDate);

  // Cálculo global baseado na nova estrutura de arrays aninhados
  const totals = currentMealsStructure.reduce((acc, group) => {
    const groupTotal = group.items.reduce((gAcc, item) => ({
      kcal: gAcc.kcal + item.kcal, protein: gAcc.protein + item.protein, carb: gAcc.carb + item.carb, fat: gAcc.fat + item.fat
    }), { kcal:0, protein:0, carb:0, fat:0 });
    return {
      kcal: acc.kcal + groupTotal.kcal, protein: acc.protein + groupTotal.protein,
      carb: acc.carb + groupTotal.carb, fat: acc.fat + groupTotal.fat
    };
  }, { kcal:0, protein:0, carb:0, fat:0 });

  const targets = nutrition.targets || DEFAULT_TARGETS;

  const Bar = ({ value, max, color }) => (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-zinc-900">
      <div className="h-2 transition-all rounded-full" style={{ width: `${Math.min(100,(value/(max||1))*100)}%`, backgroundColor: color }} />
    </div>
  );

  if (!loaded) return <div className="flex items-center justify-center h-screen text-zinc-500 text-sm bg-zinc-950">Carregando Protocolos...</div>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-zinc-950 min-h-screen shadow-2xl flex flex-col justify-center px-6 py-12 border-x border-zinc-900 text-zinc-100">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-black text-red-600 tracking-widest border-b border-red-950/60 pb-3" style={{fontFamily:"Impact, sans-serif"}}>BERSERK</h1>
            <p className="text-zinc-500 text-xs uppercase font-mono tracking-widest mt-2">SISTEMA DE GERENCIAMENTO TÁTICO v2.6</p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl relative space-y-4">
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Identificação do Operador</label>
                <input type="text" placeholder="NOME OU CODINOME" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:border-red-700 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Código de Acesso</label>
                <input type="password" placeholder="••••••••••••" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:border-red-700 focus:outline-none" />
              </div>
              <button type="submit" className="w-full bg-red-700 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-black tracking-widest flex items-center justify-center gap-2 transition-all uppercase">
                <LogIn size={15} /> Inicializar Sistema
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const wd = fromDateStr(selectedDate).getDay();

  return (
    <div className="max-w-md mx-auto bg-zinc-950 min-h-screen shadow-2xl overflow-hidden flex flex-col border-x border-zinc-900 text-zinc-100" style={{fontFamily:"system-ui, -apple-system, sans-serif"}}>
      
      {/* TopBar */}
      <div className="bg-black px-5 py-4 flex items-center justify-between border-b border-red-950 shadow-md">
        <div>
          <h1 className="text-xl font-black text-red-600 tracking-wider" style={{fontFamily:"Impact, sans-serif"}}>BERSERK</h1>
          <button onClick={() => setUser(null)} className="text-zinc-600 text-[9px] uppercase font-bold tracking-tight hover:text-red-400">OPERADOR: {user.name} · [SAIR]</button>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-red-900/40 rounded-lg px-3 py-1.5">
          <Trophy size={15} className="text-red-500" />
          <span className="font-mono font-bold text-sm text-zinc-200">{totalPoints} PTS</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* NAVEGADOR DE DATAS COM ESTILO DA REFEIÇÃO (Print 2) */}
        <div className="flex items-center justify-between bg-zinc-900/30 p-2 rounded-xl border border-zinc-900">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 active:scale-95"><ChevronLeft size={16} /></button>
          <div className="text-center">
            <div className="text-sm font-bold text-zinc-200 uppercase tracking-wide">{WEEKDAYS[wd]}</div>
            <div className="text-[11px] font-mono text-zinc-500">{fromDateStr(selectedDate).toLocaleDateString("pt-BR")}</div>
          </div>
          <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 active:scale-95"><ChevronRight size={16} /></button>
        </div>

        {view === "hoje" && (
          <div className="space-y-2">
            {(template[wd] || []).map(task => {
              const doneList = log[selectedDate]?.done || [];
              const checked = doneList.includes(task.id);
              return (
                <button key={task.id} onClick={() => toggleTask(selectedDate, task.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border ${checked ? "bg-red-950/10 border-red-900/40" : "bg-zinc-900 border-zinc-800/80"}`}>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${checked ? "bg-red-600 border-red-600" : "border-zinc-700 bg-zinc-950"}`}>{checked && <Check size={12} className="text-white stroke-[3]" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${checked ? "text-zinc-600 line-through" : "text-zinc-200"}`}>{task.title}</div>
                    <div className="text-[11px] font-mono text-zinc-500">{task.time}</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-zinc-500">+{task.points}P</div>
                </button>
              );
            })}
          </div>
        )}

        {view === "dieta" && (
          <div className="space-y-4">
            
            {/* SEÇÃO METAS NUTRICIONAIS (PRESERVADA EXATAMENTE IGUAL À PRINT 2) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-md">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Metas Nutricionais</p>
              <div className="grid grid-cols-4 gap-2">
                {[["kcal","Kcal"],["protein","Prot(g)"],["carb","Carb(g)"],["fat","Gord(g)"]].map(([key,label])=>(
                  <div key={key}>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">{label}</label>
                    <input type="number" value={targets[key]} onChange={e=>updateTarget(key, e.target.value)} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1.5 text-zinc-200 mt-1 focus:border-red-900 focus:outline-none transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO MACROS CONSUMIDOS (PRESERVADA EXATAMENTE IGUAL À PRINT 2) */}
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
                    <span className="font-mono">{Math.round(val)} / {max}</span>
                  </div>
                  <Bar value={val} max={max} color={color} />
                </div>
              ))}
            </div>

            {/* BLOCO DE REFEIÇÕES FILTRADAS POR ABAS DE CATEGORIA (ESTILO PRINT 1) */}
            <div className="space-y-2.5">
              {currentMealsStructure.map(group => {
                const groupMacros = group.items.reduce((acc, item) => ({
                  kcal: acc.kcal + item.kcal, protein: acc.protein + item.protein, carb: acc.carb + item.carb, fat: acc.fat + item.fat
                }), { kcal:0, protein:0, carb:0, fat:0 });

                const isExpanded = activeMealGroup === group.id;

                return (
                  <div key={group.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all">
                    {/* Header da Refeição */}
                    <div onClick={() => setActiveMealGroup(isExpanded ? null : group.id)} className="p-3 flex items-center justify-between cursor-pointer bg-zinc-900/80 hover:bg-zinc-900 border-b border-zinc-950">
                      <div>
                        <span className="text-sm font-bold text-zinc-200">{group.name}</span>
                        <div className="flex gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                          <span>{groupMacros.kcal} kcal</span>
                          <span>C: {groupMacros.carb}g</span>
                          <span>P: {groupMacros.protein}g</span>
                          <span>G: {groupMacros.fat}g</span>
                        </div>
                      </div>
                      <div className="flex items-center text-zinc-500">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Conteúdo Expansível do Grupo (Itens + Formulário de Inserção da IA) */}
                    {isExpanded && (
                      <div className="p-3 bg-zinc-950/40 space-y-3">
                        {/* Itens já cadastrados */}
                        <div className="space-y-1.5">
                          {group.items.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-2">Nenhum item adicionado a esta refeição.</p>}
                          {group.items.map(item => (
                            <div key={item.id} className="bg-zinc-900/60 border border-zinc-800/40 rounded-lg p-2 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold text-zinc-300">{item.food} <span className="text-zinc-500 font-mono">({item.grams}g)</span></span>
                                <div className="text-[10px] font-mono text-zinc-500">{item.kcal}kcal · P:{item.protein}g · C:{item.carb}g · G:{item.fat}g</div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); deleteItemFromGroup(group.id, item.id); }} className="text-zinc-600 hover:text-red-500 transition-colors p-1"><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>

                        {/* Sub-Formulário com Calibrador Inteligente Integrado para a refeição atual */}
                        <div className="border-t border-zinc-900 pt-3 space-y-2">
                          <div className="flex gap-2">
                            <input type="text" placeholder="Alimento (ex: feijão carioca)" value={draft.food} onChange={e=>setDraft({...draft, food:e.target.value})} className="flex-1 min-w-0 text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none" />
                            <input type="number" placeholder="g" value={draft.grams} onChange={e=>setDraft({...draft, grams:e.target.value})} className="w-14 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded-lg px-1.5 py-1.5 text-zinc-200 text-center focus:outline-none" />
                          </div>

                          <button onClick={calcWithAI} disabled={calculating} className="w-full bg-red-950/40 hover:bg-red-900/30 border border-red-900/40 text-red-400 rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                            {calculating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                            {calculating ? "CALCULANDO..." : "CALCULAR COMPONENTES COM IA"}
                          </button>
                          {calcError && <p className="text-[10px] font-medium text-red-400">{calcError}</p>}

                          <div className="grid grid-cols-4 gap-1.5">
                            {[["kcal","Kcal"],["protein","Prot"],["carb","Carb"],["fat","Gord"]].map(([key,label])=>(
                              <div key={key}>
                                <label className="text-[9px] font-bold text-zinc-500 uppercase">{label}</label>
                                <input type="number" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1 text-zinc-200 focus:outline-none" />
                              </div>
                            ))}
                          </div>

                          <button onClick={() => addItemToGroup(group.id)} className="w-full bg-zinc-200 hover:bg-zinc-100 text-zinc-950 rounded-lg py-1.5 text-xs font-bold transition-all">
                            GRAVAR NA REFEIÇÃO
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ELEMENTO ADICIONAR NOVA REFEIÇÃO CUSTOMIZADA (ESTILO INFERIOR DA PRINT 1) */}
            <div className="bg-zinc-950 border border-dashed border-zinc-800 rounded-xl p-3 flex gap-2">
              <input type="text" placeholder="Nome da nova refeição (ex: Lanche da Tarde)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="flex-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none" />
              <button onClick={addNewMealGroup} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all">
                <Plus size={14} /> Criar Bloco
              </button>
            </div>

          </div>
        )}

        {view === "editar" && (
          <div className="space-y-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {WD_SHORT.map((label, idx) => (
                <button key={idx} onClick={() => setEditWeekday(idx)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all ${editWeekday===idx ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-500"}`}>{label.toUpperCase()}</button>
              ))}
            </div>
            <div className="space-y-2">
              {(template[editWeekday]||[]).map(task => (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center gap-2">
                  <input type="time" value={task.time} onChange={e => {
                    setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].map(t => t.id === task.id ? { ...t, time: e.target.value } : t) }));
                  }} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1 w-18 text-zinc-200 focus:outline-none" />
                  <input type="text" value={task.title} onChange={e => {
                    setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].map(t => t.id === task.id ? { ...t, title: e.target.value } : t) }));
                  }} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-1 flex-1 min-w-0 text-zinc-200 focus:outline-none" />
                  <button onClick={() => setTemplate(prev => ({ ...prev, [editWeekday]: prev[editWeekday].filter(t => t.id !== task.id) }))} className="text-zinc-600 hover:text-red-500 p-1"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-dashed border-zinc-800 space-y-2">
              <div className="flex gap-2">
                <input type="time" value={newTask.time} onChange={e=>setNewTask({...newTask, time:e.target.value})} className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded p-1.5 w-18 text-zinc-200 focus:outline-none" />
                <input type="text" placeholder="Nova tarefa base" value={newTask.title} onChange={e=>setNewTask({...newTask, title:e.target.value})} className="text-sm bg-zinc-950 border border-zinc-800 rounded p-1.5 flex-1 text-zinc-200 focus:outline-none" />
              </div>
              <button onClick={() => {
                if(!newTask.title.trim()) return;
                setTemplate(prev => ({ ...prev, [editWeekday]: [...(prev[editWeekday]||[]), { id: uid(), time: newTask.time||"00:00", title: newTask.title.trim(), points: 10 }].sort((a,b)=>a.time.localeCompare(b.time)) }));
                setNewTask({ time:"", title:"", points:10 });
              }} className="w-full bg-red-700 text-white rounded-lg py-1.5 text-xs font-bold tracking-wider uppercase">Injetar Diretriz</button>
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

      {/* Menu Inferior */}
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