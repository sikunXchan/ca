"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Trash2, History, ChevronDown, ChevronUp, RefreshCw, BookOpen, ChefHat, Utensils } from "lucide-react";
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
  const [remakingId, setRemakingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);

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

  const confirmDelete = (id: number) => {
    setTargetId(id);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (targetId === null) return;
    const id = targetId;
    setModalOpen(false);
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
      setTargetId(null);
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

  const handleRemake = async (recipe: SavedRecipe) => {
    setRemakingId(recipe.id);
    try {
      // 1. Generate remake from AI
      const res = await fetch("/api/recipes/remake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe }),
      });
      const remakeData = await res.json();
      
      if (!res.ok) throw new Error(remakeData.error || "リメイクに失敗しました");

      // 2. Save the new recipe
      const saveRes = await fetch("/api/saved-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remakeData),
      });
      
      if (saveRes.ok) {
        const saved = await saveRes.json();
        setRecipes([saved, ...recipes]);
        setExpandedId(saved.id); // Expand the new one
        
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff7849', '#f472b6', '#8b5cf6'],
        });
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setRemakingId(null);
    }
  };

  const getRecipeIcon = (recipe: SavedRecipe) => {
    // 調理時間（文字列）から数字を抽出（例：「15分」→ 15）
    const timeStr = recipe.time || "";
    const match = timeStr.match(/(\d+)/);
    const minutes = match ? parseInt(match[0], 10) : 10; // 数字が見つからない場合はデフォルトで main (10分以上扱い)
    
    // 9分以内なら sub.png、それ以外（10分以上）なら main.png
    return minutes <= 9 ? "/sub.png" : "/main.png";
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

      <AnimatePresence>
        {modalOpen && (
          <motion.div 
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
            >
              <div className={styles.modalIcon}>
                <Trash2 size={32} />
              </div>
              <h2 className={styles.modalTitle}>本当に削除しますか？</h2>
              <p className={styles.modalText}>
                このレシピを履歴から削除します。<br />この操作は取り消せません。
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  キャンセル
                </button>
                <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
                  削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <img
                    src={getRecipeIcon(recipe)}
                    alt={recipe.title}
                    className={styles.recipeIcon}
                  />
                  
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
                      className={styles.remakeBtn}
                      onClick={(e) => { e.stopPropagation(); handleRemake(recipe); }}
                      disabled={remakingId === recipe.id}
                    >
                      {remakingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <ChefHat size={14} />
                      )}
                      この残りでリメイク！
                    </button>
                    <button
                      className={styles.recookBtn}
                      onClick={(e) => { e.stopPropagation(); handleRecook(recipe.id); }}
                      disabled={updatingId === recipe.id}
                      title="今日作った"
                    >
                      {updatingId === recipe.id ? (
                        <Loader2 className="spinner" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      再作成
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); confirmDelete(recipe.id); }}
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
