"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Hand,
  Flame,
  Timer as TimerIcon,
  Check,
  Play,
  Pause,
  PartyPopper,
} from "lucide-react";
import styles from "./CookingSession.module.css";

type Props = {
  title: string;
  steps: string[];
  onClose: () => void;
};

interface SpeechRecognitionEventLike {
  results: { length: number; [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type DeviceMotionEventStatic = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type StepMeta = {
  seconds: number | null;
  heat: string | null;
};

function parseStepMeta(step: string): StepMeta {
  const timeMatch = step.match(/(\d+)\s*(時間|分|秒)/);
  let seconds: number | null = null;
  if (timeMatch) {
    const n = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2];
    seconds = unit === "時間" ? n * 3600 : unit === "分" ? n * 60 : n;
  }
  const heatMatch = step.match(/強火|中火|弱火|予熱|沸騰|余熱/);
  return { seconds, heat: heatMatch ? heatMatch[0] : null };
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -40 : 40, opacity: 0 }),
};

export default function CookingSession({ title, steps, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [finished, setFinished] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [tapGestureOn, setTapGestureOn] = useState(false);
  const [tapGestureSupported, setTapGestureSupported] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const micOnRef = useRef(false);
  const lastTapRef = useRef(0);

  const metas = useMemo(() => steps.map(parseStepMeta), [steps]);
  const total = steps.length;
  const progressPct = total > 1 ? (index / (total - 1)) * 100 : 0;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setMicSupported(!!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    setTapGestureSupported("DeviceMotionEvent" in window);
  }, []);

  useEffect(() => {
    nodeRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index]);

  // Reset the per-step timer whenever the step changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerRemaining(metas[index]?.seconds ?? null);
  }, [index, metas]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    },
    [voiceOn]
  );

  useEffect(() => {
    if (finished) {
      speak("完成です。お疲れさまでした！");
      return;
    }
    speak(`ステップ${index + 1}。${steps[index]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, steps, voiceOn]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((prev) => {
      if (prev >= total - 1) {
        setFinished(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ff7849", "#20b2aa", "#fbbf24"],
        });
        return prev;
      }
      return prev + 1;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goTo = useCallback(
    (i: number) => {
      setDirection(i >= index ? 1 : -1);
      setFinished(false);
      setIndex(i);
    },
    [index]
  );

  // Keyboard support (desktop testing / accessibility)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Voice command control: "次/next" advances, "戻る/back" goes back
  useEffect(() => {
    micOnRef.current = micOn;
    if (!micOn) {
      recognitionRef.current?.stop?.();
      return;
    }
    const speechWindow = window as SpeechWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (/次|進んで|next|オーケー|ok/i.test(transcript)) {
        goNext();
      } else if (/戻|前|back/i.test(transcript)) {
        goPrev();
      }
    };
    recognition.onend = () => {
      if (micOnRef.current) {
        try {
          recognition.start();
        } catch {
          // already running / transient error, ignore
        }
      }
    };
    recognition.onerror = () => {
      // let onend's auto-restart handle recoverable errors
    };

    try {
      recognition.start();
    } catch {
      // ignore
    }
    recognitionRef.current = recognition;

    return () => {
      recognition.onend = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [micOn, goNext, goPrev]);

  // Experimental hands-free control: tap/knock the phone body to advance
  useEffect(() => {
    if (!tapGestureOn) return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const now = Date.now();
      if (magnitude > 28 && now - lastTapRef.current > 700) {
        lastTapRef.current = now;
        goNext();
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [tapGestureOn, goNext]);

  const enableTapGesture = async () => {
    const DME = window.DeviceMotionEvent as DeviceMotionEventStatic | undefined;
    if (DME && typeof DME.requestPermission === "function") {
      try {
        const result = await DME.requestPermission();
        if (result !== "granted") return;
      } catch {
        return;
      }
    }
    setTapGestureOn(true);
  };

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timerRemaining === null) return;
    if (timerRemaining <= 0) {
      setTimerRunning(false);
      speak("タイマーが終了しました");
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      return;
    }
    const t = setTimeout(() => setTimerRemaining((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timerRemaining, speak]);

  const handleTapZone = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.noTap}`)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.35) {
      goPrev();
    } else {
      goNext();
    }
  };

  const currentMeta = metas[index];

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>{title}</div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
          <X size={22} />
        </button>
      </div>

      <div className={styles.timelineWrap}>
        <div className={styles.timelineTrack}>
          <div className={styles.timelineLineBg} />
          <motion.div
            className={styles.timelineLineFill}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
          {steps.map((_, i) => (
            <button
              key={i}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              className={`${styles.node} ${i === index ? styles.nodeActive : ""} ${
                i < index || finished ? styles.nodeDone : ""
              }`}
              onClick={() => goTo(i)}
            >
              {i < index || (finished && i <= index) ? <Check size={14} /> : i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stage}>
        <AnimatePresence mode="wait" custom={direction}>
          {finished ? (
            <motion.div
              key="finished"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={styles.finishedCard}
            >
              <PartyPopper size={56} color="#ff7849" />
              <h2>完成です！</h2>
              <p>お疲れさまでした 🍽️</p>
              <button className={styles.finishBtn} onClick={onClose}>
                閉じる
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={index}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className={styles.stepCard}
              onClick={handleTapZone}
            >
              <div className={styles.stepLabel}>
                STEP {index + 1} / {total}
              </div>

              {(currentMeta?.heat || currentMeta?.seconds) && (
                <div className={styles.badgeRow}>
                  {currentMeta?.heat && (
                    <span className={styles.badge}>
                      <Flame size={14} /> {currentMeta.heat}
                    </span>
                  )}
                  {currentMeta?.seconds != null && (
                    <span className={styles.badge}>
                      <TimerIcon size={14} /> {formatClock(currentMeta.seconds)}
                    </span>
                  )}
                </div>
              )}

              <p className={styles.stepText}>{steps[index]}</p>

              {currentMeta?.seconds != null && (
                <div className={`${styles.timerBox} ${styles.noTap}`}>
                  <span className={styles.timerClock}>
                    {formatClock(timerRemaining ?? currentMeta.seconds)}
                  </span>
                  <button
                    className={styles.timerBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimerRunning((r) => !r);
                    }}
                  >
                    {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                    {timerRunning ? "一時停止" : "タイマー開始"}
                  </button>
                </div>
              )}

              <div className={styles.tapHint}>画面タップ：右で次へ / 左で戻る</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.controls}>
        <button className={styles.navBtn} onClick={goPrev} disabled={index === 0 || finished}>
          <ChevronLeft size={20} />
        </button>

        <button
          className={styles.toolBtn}
          onClick={() => setVoiceOn((v) => !v)}
          title="読み上げ"
        >
          {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {micSupported && (
          <button
            className={`${styles.toolBtn} ${micOn ? styles.toolBtnActive : ""}`}
            onClick={() => setMicOn((m) => !m)}
            title="音声操作（「次」「戻る」）"
          >
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        )}

        {tapGestureSupported && (
          <button
            className={`${styles.toolBtn} ${tapGestureOn ? styles.toolBtnActive : ""}`}
            onClick={() => (tapGestureOn ? setTapGestureOn(false) : enableTapGesture())}
            title="スマホをトン、で次へ（実験的）"
          >
            <Hand size={18} />
          </button>
        )}

        <button className={styles.navBtn} onClick={goNext} disabled={finished}>
          {index === total - 1 ? <Check size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    </motion.div>
  );
}
