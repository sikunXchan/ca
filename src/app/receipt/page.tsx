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
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setErrorMsg("");
      setAddedItems([]);
      setSuccess(false); // Reset success state on new file selection
    }
  };

  const processReceipt = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg("");
    setAddedItems([]);
    setSuccess(false);

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
      setSuccess(true);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "予期せぬエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>📷 レシート読み取り</h1>

      <p className="text-center text-muted mb-4">
        レシートを撮影するか、画像をアップロードして在庫に自動追加します。
      </p>

      {errorMsg && (
        <div className={styles.errorAlert}>
          {errorMsg}
        </div>
      )}

      {success && (
        <div className={styles.successAlert}>
          <div className={styles.successIcon}>
            <CheckCircle size={40} />
          </div>
          <div>
            <p style={{ fontWeight: 600 }}>以下の食材を追加しました：</p>
            <ul className={styles.addedItemsList}>
              {addedItems.map((item, i) => (
                <li
                  key={i}
                  className={styles.addedItem}
                >
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push("/")}
            >
              在庫を確認する
            </button>
          </div>
        </div>
      )}

      {!loading && !success && (
        <label
          className={styles.uploadBox}
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
