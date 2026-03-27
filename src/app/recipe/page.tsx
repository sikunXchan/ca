"use client";

import { useEffect, useState, useCallback } from "react";
import { ChefHat, Loader2, ChevronDown, ChevronUp, Bookmark, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  image_url?: string;
};

export default function RecipePage() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    if (recipes.length > 0) {
      localStorage.setItem("cooking_app_recipes", JSON.stringify(recipes));
    }
  }, [recipes]);

  const handleInstructionChange = (val: string) => {
    setInstruction(val);
    localStorage.setItem("cooking_app_instruction", val);
  };

  const fireConfetti = useCallback(() => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#ff7849', '#f97316', '#fb923c', '#20b2aa', '#f472b6'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#ff7849', '#f97316', '#fb923c', '#20b2aa', '#f472b6'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      setErrorMsg("冷蔵庫の在庫がありません。追加してください。");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");
    setExpandedIndex(0);
    setSavedSet(new Set());
    setJustGenerated(false);

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
        setJustGenerated(true);
        // Fire confetti when recipes are generated
        setTimeout(() => fireConfetti(), 300);
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
          time: recipe.time,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          tips: recipe.tips,
          image_url: recipe.image_url || null,
        }),
      });
      
      if (res.ok) {
        setSavedSet(prev => new Set(prev).add(index));
        // Mini confetti for save
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#20b2aa', '#5fd4cd', '#99f6e4'],
        });
      }
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSavingIndex(null);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 60, scale: 0.9 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.15,
        type: "spring",
        stiffness: 300,
        damping: 24,
      },
    }),
  };

  return (
    <div className={styles.container}>
      <motion.h1
        className={styles.title}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        🍳 AIレシピ提案
      </motion.h1>
      
      <motion.div
        className={styles.inputSection}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
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
      </motion.div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            className={styles.errorAlert}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <motion.div
          className={styles.loadingState}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <ChefHat size={48} />
          </motion.div>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            在庫から最適なレシピを考案中...
          </motion.p>
        </motion.div>
      )}

      {!loading && recipes.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>✨ 提案結果</h2>
          </div>
          
          <AnimatePresence>
            {recipes.map((recipe, index) => {
              const isExpanded = expandedIndex === index;
              const isSaved = savedSet.has(index);
              return (
                <motion.div
                  key={index}
                  className={styles.recipeCard}
                  custom={index}
                  variants={justGenerated ? cardVariants : undefined}
                  initial={justGenerated ? "hidden" : undefined}
                  animate={justGenerated ? "visible" : undefined}
                  whileHover={{ 
                    y: -4,
                    rotateX: 2,
                    rotateY: -1,
                    transition: { duration: 0.3 }
                  }}
                  style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
                >
                  {recipe.image_url && (
                    <img 
                      src={recipe.image_url} 
                      alt={recipe.title}
                      className={styles.recipeImage}
                    />
                  )}
                  
                  <div className={styles.recipeHeader}>
                    <div 
                      className={styles.recipeTitleGroup}
                      onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                      style={{ cursor: "pointer", flex: 1 }}
                    >
                      <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                      <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                    </div>
                    
                    <div className={styles.recipeActions}>
                      <motion.button
                        className={isSaved ? styles.savedBtn : styles.saveBtn}
                        onClick={() => handleSave(index)}
                        disabled={isSaved || savingIndex === index}
                        whileTap={!isSaved ? { scale: 0.9 } : undefined}
                      >
                        {savingIndex === index ? (
                          <Loader2 className="spinner" size={14} />
                        ) : isSaved ? (
                          <Check size={14} />
                        ) : (
                          <Bookmark size={14} />
                        )}
                        {isSaved ? "保存済" : "保存"}
                      </motion.button>
                      
                      <button
                        className={styles.chevronBtn}
                        onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className={styles.recipeBody}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: "hidden" }}
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
