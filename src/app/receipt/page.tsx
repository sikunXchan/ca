"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Camera, Upload, Loader2, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./Receipt.module.css";

export default function ReceiptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [addedItems, setAddedItems] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setErrorMsg("");
      setAddedItems([]);
      setSuccess(false);
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
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "読み取りに失敗しました");
      }

      const ingredients: string[] = data.ingredients || [];
      
      // 在庫に食材を追加
      for (const item of ingredients) {
        await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item }),
        });
      }

      setAddedItems(ingredients);
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(true);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message);
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
            <p style={{ fontWeight: 600, fontSize: '18px', color: 'var(--primary)', marginBottom: '8px' }}>読み取り完了！</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>既存の在庫と重複するものはスキップされました。</p>
            
            <div className={styles.addedItemsLabel}>
              📋 在庫に反映した項目：
            </div>
            <ul className={styles.addedItemsList}>
              {addedItems.map((item, i) => (
                <li key={i} className={styles.addedItem}>
                  <span>{item}</span>
                  <span className={styles.statusBadge}>OK</span>
                </li>
              ))}
            </ul>
            <button
              className={styles.submitBtn}
              onClick={() => router.push("/")}
              style={{ marginTop: "24px" }}
            >
              在庫を確認する
            </button>
          </div>
        </div>
      )}

      {!loading && !success && (
        <>
          <label className={styles.uploadBox}>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef}
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
          </label>

          {file && (
            <button
              className={styles.submitBtn}
              onClick={processReceipt}
              style={{ marginTop: "20px" }}
            >
              <Upload size={20} />
              読み取り開始
            </button>
          )}
        </>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <div className="spinner-container">
            <Loader2 className="spinner" size={48} />
          </div>
          <p>AIがレシートを解析中...</p>
        </div>
      )}
    </div>
  );
}
