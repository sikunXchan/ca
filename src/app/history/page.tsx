"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Trash2, History, ChevronDown, ChevronUp, RefreshCw, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import styles from "./History.module.css";

type RecipeItem = {
  name: string;
  amount: string;
};

type SavedRecipe = {
  id: number;
  title: string;
  time: string;
  ingredients: RecipeItem[];
  steps: string[];
  tips: string;
  image_url: string | null;
  saved_at: string;
};

export default function HistoryPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-recipes");
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecipes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/saved-recipes/${id}`, { method: "DELETE" });
      setRecipes(recipes.filter(r => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRecook = async (id: number) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/saved-recipes/${id}`, { method: "PATCH" });
      if (res.ok) {
        const updated = await res.json();
        // Move to top and update
        setRecipes(prev => {
          const filtered = prev.filter(r => r.id !== id);
          return [updated, ...filtered];
        });
        
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#ff7849', '#20b2aa', '#fbbf24', '#f472b6'],
        });
      }
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>📚 レシピ履歴</h1>

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && (
        <>
          {recipes.map((recipe, index) => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div key={recipe.id} className={styles.recipeCard}>
                <div 
                  className={styles.cardTopRow}
                  onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                >
                  {recipe.image_url && (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className={styles.recipeIcon}
                    />
                  )}
                  
                  <div className={styles.titleInfo}>
                    <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                    <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                    <div className={styles.savedDate}>
                      📅 {formatDate(recipe.saved_at)}
                    </div>
                  </div>

                  <button
                    className={styles.expandBtn}
                  >
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.recookBtn}
                      onClick={(e) => { e.stopPropagation(); handleRecook(recipe.id); }}
                      disabled={updatingId === recipe.id}
                    >
                      {updatingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      もう一度作った
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id); }}
                      disabled={deletingId === recipe.id}
                    >
                      {deletingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className={styles.detailBody}>
                      <div className={styles.section}>
                        <h3>材料・調味料</h3>
                        <ul className={styles.ingredientList}>
                          {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((item, i) => (
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
                          {(Array.isArray(recipe.steps) ? recipe.steps : []).map((step, i) => (
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

          {recipes.length === 0 && (
            <div className={styles.emptyState}>
              <BookOpen size={48} style={{ opacity: 0.5 }} />
              <p>保存されたレシピはありません</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
