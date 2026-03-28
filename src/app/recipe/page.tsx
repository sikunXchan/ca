"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Bookmark, Check, Utensils, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CookingModeToggle } from "@/components/CookingModeToggle";
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

type Recipe = {
  title: string;
  time: string;
  ingredients: RecipeItem[];
  steps: string[];
  tips: string;
  image_url: string | null;
};

const CONDITION_OPTIONS = [
  { id: "low-cal", label: "低カロリー", icon: "🍃" },
  { id: "party", label: "パーティメニュー", icon: "🎉" },
  { id: "gentle", label: "🤒お腹にやさしい", icon: "" },
  { id: "protein", label: "💪ガッツリ高タンパク", icon: "" },
  { id: "fast", label: "⏳超時短 (10分以内)", icon: "" },
];

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [showConditions, setShowConditions] = useState(false);

  useEffect(() => {
    fetchIngredients();
    
    // Load last generated recipes from localStorage
    try {
      const saved = localStorage.getItem("cooking_app_last_recipes");
      if (saved) {
        setRecipes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load from localStorage", e);
    }
  }, []);

  const fetchIngredients = async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (Array.isArray(data)) {
        setIngredients(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCondition = (label: string) => {
    setSelectedConditions(prev => 
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    setExpandedIndex(-1);
    
    const ingredientNames = ingredients.map(i => i.name);
    const pinnedNames = ingredients.filter(i => i.is_pinned).map(i => i.name);
    
    try {
      const res = await fetch("/api/recipes", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ingredients: ingredientNames,
          pinnedIngredients: pinnedNames,
          conditions: selectedConditions,
          instruction 
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      
      const newRecipes = data.recipes || [];
      setRecipes(newRecipes);
      
      // Save to localStorage
      localStorage.setItem("cooking_app_last_recipes", JSON.stringify(newRecipes));
      
      setSavedSet(new Set()); // Reset saved highlights for new results

      // Celebration!
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
    // 調理時間（文字列）から数字を抽出（例：「15分」→ 15）
    const timeStr = recipe.time || "";
    const match = timeStr.match(/(\d+)/);
    const minutes = match ? parseInt(match[0], 10) : 10; // 数字が見つからない場合はデフォルトで main (10分以上扱い)
    
    // 9分以内なら sub.png、それ以外（10分以上）なら main.png
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🍳 AIレシピ提案</h1>
        <CookingModeToggle />
      </div>

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
                        <>
                          <Check size={14} />
                          <span>保存済み</span>
                        </>
                      ) : (
                        <>
                          <Bookmark size={14} />
                          <span>保存</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      className={styles.chevronBtn}
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className={styles.recipeBody}>
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
    </div>
  );
}
