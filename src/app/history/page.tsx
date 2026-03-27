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
      <motion.h1
        className={styles.title}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        📚 レシピ履歴
      </motion.h1>

      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            className="flex justify-center mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="spinner" size={32} color="var(--primary)" />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <>
          <AnimatePresence mode="popLayout">
            {recipes.map((recipe, index) => {
              const isExpanded = expandedId === recipe.id;
              return (
                <motion.div
                  key={recipe.id}
                  className={styles.recipeCard}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, x: -40, transition: { duration: 0.2, ease: "easeIn" } }}
                  transition={{
                    delay: index * 0.06,
                    type: "spring" as const,
                    stiffness: 450,
                    damping: 28,
                  }}
                >
                {recipe.image_url && (
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className={styles.recipeImage}
                  />
                )}
                
                <div className={styles.cardContent}>
                  <div className={styles.cardTopRow}>
                    <div style={{ flex: 1 }}>
                      <h2 className={styles.recipeTitle}>{recipe.title}</h2>
                      <span className={styles.recipeTime}>⏱ {recipe.time}</span>
                      <div className={styles.savedDate}>
                        📅 {formatDate(recipe.saved_at)}
                      </div>
                    </div>
                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpandedId(isExpanded ? null : recipe.id)}
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  <div className={styles.cardActions}>
                    <motion.button
                      className={styles.recookBtn}
                      onClick={() => handleRecook(recipe.id)}
                      disabled={updatingId === recipe.id}
                      whileTap={{ scale: 0.95 }}
                    >
                      {updatingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      もう一度作った
                    </motion.button>
                    <motion.button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(recipe.id)}
                      disabled={deletingId === recipe.id}
                      whileTap={{ scale: 0.95 }}
                    >
                      {deletingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </motion.button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className={styles.detailBody}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: "hidden" }}
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          </AnimatePresence>

          <AnimatePresence>
            {recipes.length === 0 && (
              <motion.div
                key="empty"
                className={styles.emptyState}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <BookOpen size={48} style={{ opacity: 0.5 }} />
                <p>保存されたレシピはありません</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
