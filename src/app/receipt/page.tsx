"use client";

import { useState } from "react";
import { Camera, Upload, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import styles from "./Receipt.module.css";
import { useRouter } from "next/navigation";

export default function ReceiptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [addedItems, setAddedItems] = useState<string[]>([]);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setErrorMsg("");
      setAddedItems([]);
    }
  };

  const fireSuccessConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#20b2aa', '#5fd4cd', '#ff7849', '#f97316', '#fbbf24'],
    });
  };

  const processReceipt = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setAddedItems([]);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const ocrRes = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!ocrRes.ok) {
        const errorData = await ocrRes.json();
        throw new Error(errorData.error || "レシートを読み取れませんでした。");
      }

      const data = await ocrRes.json();
      if (!data.ingredients || data.ingredients.length === 0) {
        throw new Error("食材が見つかりませんでした。手動で追加してください。");
      }

      const promises = data.ingredients.map((name: string) => 
        fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        })
      );
      
      await Promise.all(promises);
      setAddedItems(data.ingredients);
      setFile(null);
      setPreview(null);
      
      // Fire confetti on success
      setTimeout(() => fireSuccessConfetti(), 200);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "予期せぬエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <motion.h1
        className={styles.title}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        📷 レシート読み取り
      </motion.h1>
      
      <motion.p
        className="text-center text-muted mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        レシートを撮影するか、画像をアップロードして在庫に自動追加します。
      </motion.p>

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

      <AnimatePresence>
        {addedItems.length > 0 && (
          <motion.div
            className={styles.successAlert}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 20 }}
              className={styles.successIcon}
            >
              <CheckCircle size={40} />
            </motion.div>
            <div>
              <p style={{ fontWeight: 600 }}>以下の食材を追加しました：</p>
              <ul className={styles.addedItemsList}>
                {addedItems.map((item, i) => (
                  <motion.li
                    key={i}
                    className={styles.addedItem}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {item}
                  </motion.li>
                ))}
              </ul>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + addedItems.length * 0.1 }}
                onClick={() => router.push("/")}
              >
                在庫を確認する
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && addedItems.length === 0 && (
        <motion.label
          className={styles.uploadBox}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handleFileChange}
            className={styles.hiddenInput}
          />
          {preview ? (
            <img src={preview} alt="Preview" className={styles.previewImage} />
          ) : (
            <div className={styles.placeholder}>
              <Camera size={48} className="text-muted" />
              <span>カメラで撮影 / 画像選択</span>
            </div>
          )}
        </motion.label>
      )}

      {file && !loading && addedItems.length === 0 && (
        <motion.button
          className={styles.submitBtn}
          onClick={processReceipt}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.95 }}
        >
          <Upload size={20} />
          読み取り開始
        </motion.button>
      )}

      {loading && (
        <motion.div
          className={styles.loadingState}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Camera size={48} />
          </motion.div>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            AIがレシートを解析中...
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
