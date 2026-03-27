"use client";

import { useEffect, useState, useCallback } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Bookmark, Check, Utensils } from "lucide-react";
import confetti from "canvas-confetti";
import styles from "./Recipe.module.css";

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

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    fetchIngredients();
    
    // Load last generated recipes from localStorage
    try {
      const saved = localStorage.getItem("cooking_app_last_recipes");
      if (saved) {
        setRecipes(JSON.parse(saved));
      }
      
      const savedInstruction = localStorage.getItem("cooking_app_instruction");
      if (savedInstruction) {
        setInstruction(savedInstruction);
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
        setIngredients(data.map((i: any) => i.name));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateRecipes = async () => {
    setLoading(true);
    setErrorMsg("");
    setExpandedIndex(-1);
    
    try {
      const res = await fetch("/api/recipes", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, instruction })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      
      const newRecipes = data.recipes || [];
      setRecipes(newRecipes);
      
      // Save to localStorage
      localStorage.setItem("cooking_app_last_recipes", JSON.stringify(newRecipes));
      localStorage.setItem("cooking_app_instruction", instruction);
      
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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🍳 AIレシピ提案</h1>

      <div className={styles.inputSection}>
        <p className="mb-2 text-sm text-muted">
          現在の在庫: {ingredients.length > 0 ? ingredients.join(", ") : "なし"}
        </p>
        
        <textarea
          placeholder="カスタム指示 (任意) 例: ガッツリ系、消化の良いもの、15分以内など"
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
          <div className="spinner-container">
            <Loader2 className="spinner" size={48} />
          </div>
          <p>在庫から最適なレシピを考案中...</p>
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
                  {recipe.image_url ? (
                    <img 
                      src={recipe.image_url} 
                      alt={recipe.title}
                      className={styles.recipeIcon}
                    />
                  ) : (
                    <div className={styles.recipeIconFallback}>
                      <ChefHat size={28} color="var(--primary)" />
                    </div>
                  )}
                  
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
