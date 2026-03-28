"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Loader2, Trash2, Check, ShoppingCart, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence, animate } from "framer-motion";
import styles from "./Shopping.module.css";

type ShoppingItem = {
  id: number;
  name: string;
  is_completed: boolean;
};

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping");
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
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
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data && data.id) {
        setItems([data, ...items]);
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
    setItems(prev => prev.filter(item => item.id !== id));
    try {
      await fetch(`/api/shopping/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async (item: ShoppingItem, e: React.MouseEvent) => {
    // 1. Get source position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // 2. Get target position (Inventory tab in BottomNav)
    const targetEl = document.querySelector('[data-nav="在庫"]');
    if (!targetEl) {
      // Fallback: just delete
      processCompletion(item.id);
      return;
    }
    const targetRect = targetEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    // 3. Create flying animation
    createFlyingEffect(item.name, startX, startY, endX, endY);

    // 4. Remove from current list
    processCompletion(item.id);
  };

  const processCompletion = async (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
    try {
      await fetch(`/api/shopping/${id}`, { method: "PATCH" });
    } catch (e) {
      console.error(e);
    }
  };

  const createFlyingEffect = (name: string, startX: number, startY: number, endX: number, endY: number) => {
    // Main flying card
    const el = document.createElement("div");
    el.innerText = name;
    el.style.position = "fixed";
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.padding = "8px 16px";
    el.style.background = "var(--primary)";
    el.style.color = "white";
    el.style.borderRadius = "20px";
    el.style.fontSize = "14px";
    el.style.fontWeight = "bold";
    el.style.zIndex = "10000";
    el.style.pointerEvents = "none";
    el.style.boxShadow = "0 10px 25px rgba(255, 120, 73, 0.4)";
    document.body.appendChild(el);

    // Quadratic curve control point (gives the "arc" effect)
    const controlX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - 150; // Arc peak

    // Animate the flying item
    animate(0, 1, {
      duration: 0.8,
      ease: [0.45, 0, 0.55, 1],
      onUpdate: (t) => {
        // Bezier curve calculation
        const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * controlX + t ** 2 * endX;
        const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * controlY + t ** 2 * endY;
        const scale = 1 - 0.5 * t;
        const opacity = 1 - 0.2 * t;
        
        el.style.transform = `translate(-50%, -50%) translate(${x - startX}px, ${y - startY}px) scale(${scale})`;
        el.style.opacity = opacity.toString();

        // Add particles trailing
        if (Math.random() > 0.6) {
           createParticle(x, y);
        }
      },
      onComplete: () => {
        el.remove();
        // Success "pop" on target
        createTargetImpact(endX, endY);
      }
    });
  };

  const createParticle = (x: number, y: number) => {
    const p = document.createElement("div");
    p.style.position = "fixed";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.width = "4px";
    p.style.height = "4px";
    p.style.background = "var(--primary-light)";
    p.style.borderRadius = "50%";
    p.style.zIndex = "9999";
    p.style.pointerEvents = "none";
    document.body.appendChild(p);

    animate(p, {
      opacity: [1, 0],
      scale: [1, 2],
      x: (Math.random() - 0.5) * 40,
      y: (Math.random() - 0.5) * 40,
    }, { duration: 0.4, onComplete: () => p.remove() });
  };

  const createTargetImpact = (x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("div");
      p.style.position = "fixed";
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.width = "6px";
      p.style.height = "6px";
      p.style.background = i % 2 === 0 ? "var(--primary)" : "var(--secondary)";
      p.style.borderRadius = "50%";
      p.style.zIndex = "10001";
      document.body.appendChild(p);

      const angle = (i / 12) * Math.PI * 2;
      const velocity = 50 + Math.random() * 50;
      
      animate(p, {
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity,
        opacity: [1, 0],
        scale: [1, 0],
      }, { duration: 0.6, onComplete: () => p.remove() });
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <h1 className={styles.title}>🛒 買い物リスト</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input 
          type="text" 
          placeholder="買うものを入力 (例: 鶏むね肉)" 
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
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.li 
                  key={item.id} 
                  className={styles.listItem}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                >
                  <div className={styles.itemInfo}>
                    <div 
                      className={styles.checkbox} 
                      onClick={(e) => handleComplete(item, e)}
                    >
                      <Check size={16} />
                    </div>
                    <span className={styles.itemName}>{item.name}</span>
                  </div>
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

          {items.length === 0 && (
            <div className={styles.emptyState}>
              <ShoppingBag size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
              <p>買い物リストは空です</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
