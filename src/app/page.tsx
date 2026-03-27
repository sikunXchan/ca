"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Loader2, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Home.module.css";

type Ingredient = {
  id: number;
  name: string;
};

export default function Home() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (Array.isArray(data)) {
        setIngredients(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setAdding(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data && data.id) {
        setIngredients([data, ...ingredients]);
        setNewName("");
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    // Optimistic update: remove immediately so the animation plays at once
    const previous = ingredients;
    setIngredients(prev => prev.filter(i => i.id !== id));
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setIngredients(previous);
        alert("削除に失敗しました");
      }
    } catch (e) {
      console.error(e);
      setIngredients(previous);
      alert("エラーが発生しました");
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🧊 冷蔵庫の在庫</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input 
          type="text" 
          placeholder="新しい食材を追加 (例: トマト)" 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={adding}
        />
        <button type="submit" disabled={adding || !newName.trim()}>
          {adding ? <Loader2 className="spinner" size={20} /> : <Plus size={20} />}
          追加
        </button>
      </form>

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
          {/* Always keep the list in the DOM so AnimatePresence can run exit animations */}
          <ul className={styles.list}>
            <AnimatePresence mode="popLayout">
              {ingredients.map((item) => (
                <motion.li
                  key={item.id}
                  className={styles.listItem}
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -30, transition: { duration: 0.18, ease: "easeIn" } }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 500,
                    damping: 28,
                  }}
                  layout
                >
                  <span>{item.name}</span>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(item.id)}
                    aria-label="削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <AnimatePresence>
            {ingredients.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}
              >
                <ShoppingBag size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p>在庫がありません。追加してください。</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
