"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Loader2, ShoppingBag, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import styles from "./Home.module.css";

type Ingredient = {
  id: number;
  name: string;
  is_pinned: boolean;
};

export default function Home() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pinningId, setPinningId] = useState<number | null>(null);

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

  const handleTogglePin = async (item: Ingredient) => {
    setPinningId(item.id);
    const pinState = !item.is_pinned;
    
    // Star particle effect on pin
    if (pinState) {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        shapes: ['star'],
        colors: ['#FFD700', '#FFA500', '#FF7849'],
      });
    }

    // Optimistic update
    setIngredients(prev => {
      const next = prev.map(i => i.id === item.id ? { ...i, is_pinned: pinState } : i);
      // Sort: pinned first
      return [...next].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    });

    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: pinState }),
      });

      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch (e) {
      console.error(e);
      // Revert optimistic update on error
      fetchIngredients();
    } finally {
      setPinningId(null);
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

      {loading && (
        <div className="flex justify-center mt-4">
          <Loader2 className="spinner" size={32} color="var(--primary)" />
        </div>
      )}

      {!loading && (
        <>
          <ul className={styles.list}>
            <AnimatePresence initial={false}>
              {ingredients.map((item) => (
                <motion.li 
                  key={item.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 500, 
                    damping: 30,
                    opacity: { duration: 0.2 } 
                  }}
                  className={`${styles.listItem} ${item.is_pinned ? styles.pinned : ""}`}
                >
                  <div className={styles.nameSection}>
                    {item.is_pinned && <Pin size={14} fill="#ef4444" color="#ef4444" style={{ marginRight: 6 }} />}
                    <span>{item.name}</span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={`${styles.pinBtn} ${item.is_pinned ? styles.pinActive : ""}`}
                      onClick={() => handleTogglePin(item)}
                      disabled={pinningId === item.id}
                      title={item.is_pinned ? "ピンを外す" : "ピン留め（必須指定）"}
                    >
                      {pinningId === item.id ? (
                        <Loader2 className="spinner" size={20} strokeWidth={2.5} />
                      ) : (
                        <span style={{ fontSize: '20px' }}>📍</span>
                      )}
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      aria-label="削除"
                    >
                      <Trash2 size={22} strokeWidth={2.5} color="#ef4444" />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {ingredients.length === 0 && (
            <div
              style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}
            >
              <ShoppingBag size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p>在庫がありません。追加してください。</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
