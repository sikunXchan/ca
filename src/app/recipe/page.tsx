"use client";

import { useEffect, useState } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Download } from "lucide-react";
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
    // Load persisted recipes and instructions
    try {
      const savedRecipes = localStorage.getItem("cooking_app_recipes");
      if (savedRecipes) {
        setRecipes(JSON.parse(savedRecipes));
      }
      const savedInstruction = localStorage.getItem("cooking_app_instruction");
      if (savedInstruction) {
        setInstruction(savedInstruction);
      }
    } catch (e) {
      console.error("Failed to load from cache", e);
    }

    fetch("/api/inventory")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIngredients(data.map((i: any) => i.name));
        }
      })
      .catch(console.error);
  }, []);

  // Ensure recipes are always saved when they change
  useEffect(() => {
    if (recipes.length > 0) {
      localStorage.setItem("cooking_app_recipes", JSON.stringify(recipes));
    }
  }, [recipes]);

  const handleInstructionChange = (val: string) => {
    setInstruction(val);
    localStorage.setItem("cooking_app_instruction", val);
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      setErrorMsg("冷蔵庫の在庫がありません。追加してください。");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
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
        localStorage.setItem("cooking_app_recipes", JSON.stringify(data.recipes));
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

  const downloadRecipes = () => {
    if (recipes.length === 0) return;
    
    let content = "🍳 AIレシピ提案\n\n";
    recipes.forEach((r, idx) => {
      content += `【${r.title}】 (${r.time})\n\n`;
      content += "[材料・調味料]\n";
      r.ingredients.forEach(ing => {
        content += `・${ing.name}: ${ing.amount}\n`;
      });
      content += "\n[作り方]\n";
      r.steps.forEach((s, i) => {
        content += `${i + 1}. ${s}\n`;
      });
      if (r.tips) {
        content += `\n💡 ポイント: ${r.tips}\n`;
      }
      content += "\n-----------------------\n\n";
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recipes_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          onChange={(e) => handleInstructionChange(e.target.value)}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>提案結果</h2>
            <button onClick={downloadRecipes} className={styles.downloadBtn}>
              <Download size={16} /> ダウンロード
            </button>
          </div>
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
