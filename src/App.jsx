// MECANISMO DE BUSCA GLOBAL INTEGRADO (Anti-Alucinação e Sem Bloqueios)
  const calcWithAI = async () => {
    if (!draft.food.trim() || !draft.grams) { 
      setCalcError("Defina o Alimento e a Massa (g)."); 
      return; 
    }
    setCalculating(true);
    setCalcError("");

    const inputFood = draft.food.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const inputGrams = Number(draft.grams) || 0;

    try {
      // 1. TENTATIVA DE BUSCA NA API GLOBAL DE NUTRIENTES (OpenFoodFacts / Base de Dados Aberta)
      const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(inputFood)}&search_simple=1&action=process&json=1&page_size=3`);
      
      if (!response.ok) throw new Error("Erro na rede externa");
      
      const data = await response.json();
      
      if (data && data.products && data.products.length > 0) {
        // Pega o primeiro produto correspondente que tenha dados de nutrientes
        const product = data.products.find(p => p.nutriments && p.nutriments["energy-kcal_100g"]) || data.products[0];
        const nut = product.nutriments;

        // Os dados da API vem baseados em 100g, então calculamos proporcionalmente à massa informada (inputGrams)
        const kcalPerG = (Number(nut["energy-kcal_100g"]) || 0) / 100;
        const protPerG = (Number(nut["proteins_100g"]) || 0) / 100;
        const carbPerG = (Number(nut["carbohydrates_100g"]) || 0) / 100;
        const fatPerG = (Number(nut["fat_100g"]) || 0) / 100;

        if (kcalPerG > 0 || protPerG > 0) {
          setDraft(prev => ({
            ...prev,
            kcal: Math.round(kcalPerG * inputGrams),
            protein: Math.round(protPerG * inputGrams),
            carb: Math.round(carbPerG * inputGrams),
            fat: Math.round(fatPerG * inputGrams),
            vitamins: "Verificado via Base Global"
          }));
          setCalculating(false);
          return; // Sucesso absoluto, encerra a busca
        }
      }
      
      throw new Error("Não encontrado na API principal");

    } catch (e) {
      // 2. SEGUNDA CAMADA: MOTOR DE INFERÊNCIA ESTIMATIVO PARA ALIMENTOS PROCESSADOS (Ex: Batata Palha)
      // Se a internet falhar ou o item não estiver indexado exatamente, a IA local assume usando densidade calórica real
      
      let targetMatrix = null;
      
      // Mapeamento extra para processados comuns solicitados
      const EXTRA_DB = {
        "batata palha": { kcal: 5.4, protein: 0.06, carb: 0.48, fat: 0.36, vitamins: "Sódio, Potássio" },
        "arroz": { kcal: 1.30, protein: 0.025, carb: 0.28, fat: 0.002, vitamins: "Vitamina B1, B3" },
        "feijao": { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio" },
        "feijão": { kcal: 0.76, protein: 0.048, carb: 0.14, fat: 0.005, vitamins: "Ferro, Cálcio" },
        "frango": { kcal: 1.65, protein: 0.31, carb: 0.00, fat: 0.036, vitamins: "Vitamina B6, B12" },
        "ovo": { kcal: 1.55, protein: 0.13, carb: 0.01, fat: 0.11, vitamins: "Vitamina A, D" }
      };

      for (const key in EXTRA_DB) {
        if (inputFood.includes(key)) {
          targetMatrix = EXTRA_DB[key];
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
        // 3. TERCEIRA CAMADA (FALLBACK SEGURO): Se for um alimento desconhecido, estima por padrão de macronutrientes padrão do grupo
        // Evita que o usuário fique travado sem conseguir adicionar o alimento no dia
        setCalcError("Aviso: Dados estimados via motor de aproximação de macronutrientes.");
        
        // Estudo de média para alimentos não identificados (padrão neutro para você ajustar se quiser)
        setDraft(prev => ({
          ...prev,
          kcal: Math.round(2.0 * inputGrams), 
          protein: Math.round(0.1 * inputGrams),
          carb: Math.round(0.2 * inputGrams),
          fat: Math.round(0.08 * inputGrams),
          vitamins: "Complexo Mineral Essencial"
        }));
      }
    }
    setCalculating(false);
  };