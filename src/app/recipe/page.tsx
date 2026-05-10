"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Bookmark, Check, Utensils, Pin, Users, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CookingModeToggle } from "@/components/CookingModeToggle";
import NutritionChart from "@/components/NutritionChart";
import styles from "./Recipe.module.css";

type Ingredient = {
  id: number;
  name: string;
  is_pinned: boolean;
};

type RecipeItem = {
  name: string;
  amount: string;
};

type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Recipe = {
  title: string;
  time: string;
  genre?: string;
  ingredients: RecipeItem[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition?: NutritionData | null;
};

type CookingTip = {
  category: string;
  tip: string;
};

type HistoryRecipe = {
  id: number;
  title: string;
  saved_at: string;
  nutrition: NutritionData;
};

type AIModel = 'sikun-5.9' | 'lily-5.9' | 'lily-1.1';

const MODEL_OPTIONS: { id: AIModel; label: string; desc: string }[] = [
  { id: 'sikun-5.9', label: 'Sikun Cooking AI 5.9', desc: '在庫・カスタム指示ベース' },
  { id: 'lily-5.9', label: 'Lily Cooking AI 5.9', desc: '栄養バランス考慮+グラフ' },
  { id: 'lily-1.1', label: 'Lily Cooking AI + 1.1', desc: '履歴の栄養素からバランス調整' },
];

const CONDITION_OPTIONS = [
  { id: "low-cal", label: "低カロリー", icon: "🍃" },
  { id: "party", label: "パーティメニュー", icon: "🎉" },
  { id: "gentle", label: "🤒お腹にやさしい", icon: "" },
  { id: "protein", label: "💪ガッツリ高タンパク", icon: "" },
  { id: "fast", label: "⏳超時短 (10分以内)", icon: "" },
];

const SERVINGS_OPTIONS = [5, 4, 3, 2, 1];

const TIP_CATEGORY_COLORS: Record<string, string> = {
  '保存方法': '#20b2aa',
  '調理のコツ': '#ff7849',
  '栄養豆知識': '#8b5cf6',
};

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookingTips, setCookingTips] = useState<CookingTip[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [showConditions, setShowConditions] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>('sikun-5.9');
  const [showTips, setShowTips] = useState(false);

  // Lily 1.1: history recipes with nutrition for picker
  const [historyRecipes, setHistoryRecipes] = useState<HistoryRecipe[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set());
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchIngredients();
    try {
      const savedModel = localStorage.getItem("cooking_app_model") as AIModel | null;
      if (savedModel) setSelectedModel(savedModel);
      const saved = localStorage.getItem("cooking_app_last_recipes");
      if (saved) setRecipes(JSON.parse(saved));
      const savedTips = localStorage.getItem("cooking_app_last_tips");
      if (savedTips) setCookingTips(JSON.parse(savedTips));
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cooking_app_model", selectedModel);
    if (selectedModel === 'lily-1.1') {
      fetchHistoryWithNutrition();
    }
  }, [selectedModel]);

  const fetchIngredients = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (Array.isArray(data)) {
        const seen = new Set<string>();
        const deduplicated = data.filter((item: Ingredient) => {
          const normalized = item.name.trim().toLowerCase();
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        });
        setIngredients(deduplicated);
        if (deduplicated.length < data.length) {
          fetch("/api/inventory/deduplicate", { method: "POST" }).catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistoryWithNutrition = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/saved-recipes/with-nutrition");
      const data = await res.json();
      if (Array.isArray(data)) setHistoryRecipes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleCondition = (label: string) => {
    setSelectedConditions(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const toggleHistorySelection = (id: number) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    setExpandedIndex(-1);

    const ingredientNames = ingredients.map(i => i.name);
    const pinnedNames = ingredients.filter(i => i.is_pinned).map(i => i.name);

    const nutritionContext = selectedModel === 'lily-1.1'
      ? historyRecipes
          .filter(r => selectedHistoryIds.has(r.id))
          .map(r => ({ title: r.title, nutrition: r.nutrition }))
      : [];

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredientNames,
          pinnedIngredients: pinnedNames,
          conditions: selectedConditions,
          instruction,
          servings,
          model: selectedModel,
          nutritionContext,
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "生成に失敗しました");

      const newRecipes = data.recipes || [];
      const newTips: CookingTip[] = data.cooking_tips || [];
      setRecipes(newRecipes);
      setCookingTips(newTips);

      localStorage.setItem("cooking_app_last_recipes", JSON.stringify(newRecipes));
      localStorage.setItem("cooking_app_last_tips", JSON.stringify(newTips));

      setSavedSet(new Set());
      if (newTips.length > 0) setShowTips(true);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff7849', '#20b2aa', '#fbbf24']
      });
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getRecipeIcon = (recipe: Recipe) => {
    const timeStr = recipe.time || "";
    const match = timeStr.match(/(\d+)/);
    const minutes = match ? parseInt(match[0], 10) : 10;
    return minutes <= 9 ? "/sub.png" : "/main.png";
  };

  const handleSave = async (index: number) => {
    const recipe = recipes[index];
    if (!recipe || savedSet.has(index)) return;

    setSavingIndex(index);
    try {
      const res = await fetch("/api/saved-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          time: recipe.time ?? '',
          ingredients: recipe.ingredients ?? [],
          steps: recipe.steps ?? [],
          tips: recipe.tips ?? '',
          image_url: recipe.image_url || null,
          nutrition: recipe.nutrition ?? null,
          genre: recipe.genre ?? null,
        }),
      });

      if (res.ok) {
        setSavedSet(prev => new Set(prev).add(index));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "保存に失敗しました");
      }
    } catch (e: any) {
      console.error(e);
      alert("保存エラー: " + e.message);
    } finally {
      setSavingIndex(null);
    }
  };

  const activeConditionsText = selectedConditions.length > 0
    ? ` (${selectedConditions.length}件選択中)`
    : "";

  const isLilyModel = selectedModel === 'lily-5.9' || selectedModel === 'lily-1.1';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🍳 AIレシピ提案</h1>
        <CookingModeToggle />
      </div>

      {/* Model Selector */}
      <div className={styles.modelSelector}>
        {MODEL_OPTIONS.map(opt => (
          <button
            key={opt.id}
            className={`${styles.modelBtn} ${selectedModel === opt.id ? styles.modelBtnActive : ''}`}
            onClick={() => setSelectedModel(opt.id)}
          >
            <span className={styles.modelName}>{opt.label}</span>
            <span className={styles.modelDesc}>{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* Lily 1.1: nutrition context picker */}
      {selectedModel === 'lily-1.1' && (
        <div className={styles.nutritionPicker}>
          <p className={styles.nutritionPickerTitle}>
            🥗 栄養バランスの参考にするレシピを選択 <span className={styles.optional}>（任意）</span>
          </p>
          {loadingHistory ? (
            <div className={styles.nutritionPickerLoading}><Loader2 className="spinner" size={18} /> 読み込み中…</div>
          ) : historyRecipes.length === 0 ? (
            <p className={styles.nutritionPickerEmpty}>Lily Cooking AI 5.9以上で生成・保存したレシピがありません</p>
          ) : (
            <div className={styles.nutritionPickerList}>
              {historyRecipes.map(r => (
                <label key={r.id} className={`${styles.nutritionPickerItem} ${selectedHistoryIds.has(r.id) ? styles.nutritionPickerItemSelected : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.has(r.id)}
                    onChange={() => toggleHistorySelection(r.id)}
                    className={styles.nutritionPickerCheck}
                  />
                  <span className={styles.nutritionPickerLabel}>
                    <span className={styles.nutritionPickerName}>{r.title}</span>
                    <span className={styles.nutritionPickerMeta}>
                      {r.nutrition.calories}kcal · P:{r.nutrition.protein_g}g · C:{r.nutrition.carbs_g}g · F:{r.nutrition.fat_g}g
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.inputSection}>
        <div className={styles.inventorySummary}>
          現在の在庫: {ingredients.length > 0 ? ingredients.map((i, idx) => (
            <Fragment key={i.id || idx}>
              {i.is_pinned ? <strong>{i.name}<Pin size={14} fill="#ef4444" color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }} /></strong> : i.name}
              {idx < ingredients.length - 1 ? ", " : ""}
            </Fragment>
          )) : "なし"}
        </div>

        <div className={styles.conditionsAccordion}>
          <button
            className={styles.conditionsHeader}
            onClick={() => setShowConditions(!showConditions)}
          >
            <span>✨ 条件オプションを選択 {activeConditionsText}</span>
            {showConditions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence>
            {showConditions && (
              <motion.div
                className={styles.conditionsContent}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.conditionsContainer}>
                  {CONDITION_OPTIONS.map((opt) => {
                    const isActive = selectedConditions.includes(opt.label);
                    return (
                      <button
                        key={opt.id}
                        className={`${styles.conditionToggle} ${isActive ? styles.conditionActive : ""}`}
                        onClick={() => toggleCondition(opt.label)}
                      >
                        {opt.icon && <span>{opt.icon}</span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.servingsRow}>
                  <div className={styles.servingsHeader}>
                    <label className={styles.servingsLabel}>
                      <Utensils size={18} color="#ff7849" />
                      <span>🍽️ 分量を調整</span>
                    </label>
                    <div className={styles.servingsHint}>
                      レシピの人数分を指定できます
                    </div>
                  </div>
                  <select
                    className={styles.servingsSelect}
                    value={servings ?? ""}
                    onChange={(e) => setServings(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">指定なし (材料のみで提案)</option>
                    {SERVINGS_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}人分 の分量で提案</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          placeholder="カスタム指示 (任意) 例: 子供が喜ぶ味付け、辛さ控えめなど"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          className={styles.textarea}
        />

        <button
          className={styles.generateBtn}
          onClick={generateRecipes}
          disabled={loading || ingredients.length === 0}
        >
          {loading ? <Loader2 className="spinner" size={20} /> : <ChefHat size={20} />}
          レシピを提案する
        </button>
      </div>

      {errorMsg && (
        <div className={styles.errorAlert}>
          {errorMsg}
        </div>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.cookingAnimation}>
            <span className={styles.emoji}>🍳</span>
            <span className={styles.emoji}>🥕</span>
            <span className={styles.emoji}>🔪</span>
            <span className={styles.emoji}>🥘</span>
          </div>
          <p className={styles.loadingText}>在庫から最高のレシピを考案中...</p>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>✨ 提案結果</h2>
          </div>

          {recipes.map((recipe, index) => {
            const isExpanded = expandedIndex === index;
            const isSaved = savedSet.has(index);
            return (
              <div key={index} className={styles.recipeCard}>
                <div className={styles.recipeHeader} onClick={() => setExpandedIndex(isExpanded ? -1 : index)}>
                  <img
                    src={getRecipeIcon(recipe)}
                    alt={recipe.title}
                    className={styles.recipeIcon}
                  />

                  <div className={styles.recipeTitleGroup}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                    {recipe.genre && (
                      <span className={styles.genreBadge}>{recipe.genre}</span>
                    )}
                  </div>

                  <div className={styles.recipeActions}>
                    <button
                      className={isSaved ? styles.savedBtn : styles.saveBtn}
                      onClick={(e) => { e.stopPropagation(); handleSave(index); }}
                      disabled={isSaved || savingIndex === index}
                    >
                      {savingIndex === index ? (
                        <Loader2 className="spinner" size={14} />
                      ) : isSaved ? (
                        <><Check size={14} /><span>保存済み</span></>
                      ) : (
                        <><Bookmark size={14} /><span>保存</span></>
                      )}
                    </button>

                    <button className={styles.chevronBtn}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.recipeBody}>
                    {isLilyModel && recipe.nutrition && (
                      <div className={styles.nutritionSection}>
                        <h3 className={styles.nutritionTitle}>📊 栄養バランス</h3>
                        <NutritionChart nutrition={recipe.nutrition} />
                      </div>
                    )}

                    <div className={styles.section}>
                      <h3>材料・調味料</h3>
                      <ul className={styles.ingredientList}>
                        {recipe.ingredients.map((item, i) => (
                          <li key={i}>
                            <span>{item.name}</span>
                            <span className="text-muted">{item.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.section}>
                      <h3>作り方</h3>
                      <ol className={styles.stepList}>
                        {recipe.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {recipe.tips && (
                      <div className={styles.tipsBox}>
                        <strong>💡 ポイント: </strong> {recipe.tips}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cooking Tips Section */}
      {!loading && cookingTips.length > 0 && (
        <div className={styles.cookingTipsSection}>
          <button
            className={styles.cookingTipsHeader}
            onClick={() => setShowTips(!showTips)}
          >
            <span className={styles.cookingTipsTitle}>
              <Lightbulb size={18} color="#8b5cf6" />
              料理のコツ &amp; 豆知識
            </span>
            {showTips ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence>
            {showTips && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={styles.cookingTipsList}
              >
                {cookingTips.map((tip, i) => (
                  <div key={i} className={styles.cookingTipItem}>
                    <span
                      className={styles.tipCategoryBadge}
                      style={{ background: `${TIP_CATEGORY_COLORS[tip.category] || '#8b5cf6'}20`, color: TIP_CATEGORY_COLORS[tip.category] || '#8b5cf6' }}
                    >
                      {tip.category}
                    </span>
                    <p className={styles.tipText}>{tip.tip}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
