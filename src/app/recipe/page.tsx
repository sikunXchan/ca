"use client";

import { useEffect, useState } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
};

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(0);

  useEffect(() => {
    fetch("/api/inventory")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIngredients(data.map((i: any) => i.name));
        }
      })
      .catch(console.error);
  }, []);

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      setErrorMsg("冷蔵庫の在庫がありません。追加してください。");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    setRecipes([]);
    setExpandedIndex(0);

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, instruction }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "レシピの生成に失敗しました");
      }

      const data = await res.json();
      if (data.recipes && Array.isArray(data.recipes)) {
        setRecipes(data.recipes);
      } else {
        throw new Error("レシピデータの形式が正しくありません");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "予期せぬエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>AIレシピ提案</h1>
      
      <div className={styles.inputSection}>
        <p className="mb-2 text-sm text-muted">
          現在の在庫: {ingredients.length > 0 ? ingredients.join(", ") : "なし"}
        </p>
        
        <textarea
          placeholder="カスタム指示 (任意) 例: ガッツリ系、消化の良いもの"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          className={styles.textarea}
        />
        
        <button 
          className={styles.submitBtn} 
          onClick={generateRecipes}
          disabled={loading || ingredients.length === 0}
        >
          {loading ? <Loader2 className="spinner" size={20} /> : <ChefHat size={20} />}
          レシピを提案する
        </button>
      </div>

      {errorMsg && (
        <div className={styles.errorAlert}>{errorMsg}</div>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <Loader2 className="spinner" size={48} />
          <p>在庫から最適なレシピを考案中...</p>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className={styles.results}>
          {recipes.map((recipe, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div key={index} className={styles.recipeCard}>
                <div 
                  className={styles.recipeHeader}
                  onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                >
                  <div className={styles.recipeTitleGroup}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <span className={styles.recipeTime}>{recipe.time}</span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
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
