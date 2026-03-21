"use client";

import { useState } from "react";
import { Camera, Upload, Loader2, CheckCircle } from "lucide-react";
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

      // Add each ingredient sequentially or all at once via Promise.all
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
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "予期せぬエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>レシート読み取り</h1>
      
      <p className="text-center text-muted mb-4">
        レシートを撮影するか、画像をアップロードして在庫に自動追加します。
      </p>

      {errorMsg && (
        <div className={styles.errorAlert}>
          {errorMsg}
        </div>
      )}

      {addedItems.length > 0 && (
        <div className={styles.successAlert}>
          <CheckCircle size={24} />
          <div>
            <p>以下の食材を追加しました：</p>
            <p className="mt-2 text-lg"><strong>{addedItems.join(", ")}</strong></p>
            <button className="mt-4" onClick={() => router.push("/")}>在庫を確認する</button>
          </div>
        </div>
      )}

      {!loading && addedItems.length === 0 && (
        <label className={styles.uploadBox}>
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
        </label>
      )}

      {file && !loading && addedItems.length === 0 && (
        <button className={styles.submitBtn} onClick={processReceipt}>
          <Upload size={20} />
          読み取り開始
        </button>
      )}

      {loading && (
        <div className={styles.loadingState}>
          <Loader2 className="spinner" size={48} />
          <p>AIがレシートを解析中...</p>
        </div>
      )}
    </div>
  );
}
