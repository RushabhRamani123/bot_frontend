"use client";

import { useState, useEffect, useRef } from "react";
import {
  createNewSession, generateExercise, getProgress, fullConversation, fetchTTSAudio, uid
} from "@/lib/api";

const PROMPTS = [
  "Describe your ideal morning routine in 60 seconds.",
  "Explain a complex topic you know well to a 10-year-old.",
  "Talk about a recent challenge and how you overcame it.",
  "Describe your city to someone who has never visited.",
  "Share your opinion on whether remote work is the future.",
  "Talk about a book or film that changed your perspective.",
  "Describe the perfect travel destination and why.",
  "Explain what leadership means to you.",
];

const BOT_RESPONSES = [
  "Great effort! Your sentence structure was clear and your pacing felt natural. Try varying your intonation a bit more.",
  "I noticed strong vocabulary choices. Work on connecting your ideas more smoothly with transition phrases.",
  "Excellent fluency! Your confidence is showing. Challenge yourself with more complex grammatical constructions.",
  "Good response! Your grammar was mostly accurate. Focus on expanding your vocabulary for a richer expression.",
  "Nice work! You stayed on topic well. Try to slow down slightly — clarity beats speed.",
];

const FEEDBACK_TAGS = ["Clear structure", "Good pacing", "Strong vocab", "Natural flow", "Nice transitions", "Confident tone", "Well articulated", "Good rhythm"];

const STATES = {
  idle: { ring: "#7F77DD", bg: "#EEEDFE", label: "ready" },
  listening: { ring: "#E24B4A", bg: "#FCEBEB", label: "listening" },
  thinking: { ring: "#BA7517", bg: "#FAEEDA", label: "processing" },
  speaking: { ring: "#1D9E75", bg: "#E1F5EE", label: "speaking" },
};

const TAG_COLORS = [
  { bg: "#EEEDFE", text: "#534AB7", border: "#AFA9EC" },
  { bg: "#E1F5EE", text: "#0F6E56", border: "#5DCAA5" },
  { bg: "#FAECE7", text: "#993C1D", border: "#F0997B" },
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

function WaveBars({ active, color }: { active: boolean, color: string }) {
  const [heights, setHeights] = useState<number[]>(Array(18).fill(3));
  useEffect(() => {
    if (!active) { setHeights(Array(18).fill(3)); return; }
    const iv = setInterval(() => setHeights(Array(18).fill(0).map(() => 4 + Math.random() * 28)), 100);
    return () => clearInterval(iv);
  }, [active]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 36 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 2.5, borderRadius: 99,
          height: active ? h : 3,
          background: color,
          opacity: active ? 0.8 : 0.18,
          transition: "height 0.09s ease, opacity 0.3s"
        }} />
      ))}
    </div>
  );
}

function AvatarOrb({ state }: { state: "idle" | "listening" | "thinking" | "speaking" }) {
  const col = STATES[state];
  const isSpeak = state === "speaking";
  const isListen = state === "listening";
  const [dotCount, setDotCount] = useState(0);
  const [breathe, setBreathe] = useState(false);

  useEffect(() => {
    if (state !== "thinking") { setDotCount(0); return; }
    const iv = setInterval(() => setDotCount(c => (c + 1) % 4), 380);
    return () => clearInterval(iv);
  }, [state]);

  useEffect(() => {
    const iv = setInterval(() => setBreathe(b => !b), 1800);
    return () => clearInterval(iv);
  }, []);

  const orbScale = isSpeak ? 1.06 : isListen ? 1.02 : breathe ? 1.01 : 1;

  return (
    <div style={{ position: "relative", width: 176, height: 176, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Soft background glow disk */}
      <div style={{
        position: "absolute",
        width: 130, height: 130,
        borderRadius: "50%",
        background: col.bg,
        opacity: 0.55,
        transition: "background 0.5s, opacity 0.4s",
      }} />

      {/* Spinning arc rings */}
      <svg width="176" height="176" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx="88" cy="88" r="80" fill="none" stroke={col.ring} strokeWidth="1" strokeOpacity="0.12" />
        <circle cx="88" cy="88" r="80" fill="none" stroke={col.ring} strokeWidth="2"
          strokeDasharray={
            state === "idle" ? "50 452" :
              state === "thinking" ? "130 452" :
                state === "listening" ? "210 452" : "360 452"
          }
          strokeLinecap="round"
          style={{
            transformOrigin: "88px 88px",
            animation: `spin ${state === "speaking" ? 1.3 : state === "listening" ? 1.9 : state === "thinking" ? 1.6 : 6}s linear infinite`,
            transition: "stroke-dasharray 0.5s ease, stroke 0.4s"
          }} />
        <circle cx="88" cy="88" r="80" fill="none" stroke={col.ring} strokeWidth="1"
          strokeDasharray="28 452"
          strokeLinecap="round"
          strokeOpacity="0.45"
          style={{
            transformOrigin: "88px 88px",
            animation: `spin ${state === "speaking" ? 0.85 : 3.5}s linear infinite reverse`,
          }} />
      </svg>

      {/* Core orb */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        background: "var(--color-background-primary)",
        border: `1px solid var(--color-border-secondary)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 7, zIndex: 1,
        transform: `scale(${orbScale})`,
        transition: "transform 0.6s cubic-bezier(0.34,1.3,0.64,1)",
      }}>
        {/* Face SVG */}
        <svg width="52" height="34" viewBox="0 0 52 34">
          <ellipse cx="16" cy="12"
            rx={state === "thinking" ? 3.8 : 3}
            ry={state === "speaking" ? 4 : state === "listening" ? 2.2 : 3}
            fill="var(--color-text-primary)"
            style={{ transition: "all 0.2s" }} />
          <ellipse cx="36" cy="12"
            rx={state === "thinking" ? 3.8 : 3}
            ry={state === "speaking" ? 4 : state === "listening" ? 2.2 : 3}
            fill="var(--color-text-primary)"
            style={{ transition: "all 0.2s" }} />
          {state === "speaking" ? (
            <ellipse cx="26" cy="26" rx="9" ry="5" fill="var(--color-text-primary)" />
          ) : state === "thinking" ? (
            <path d="M16 26 Q26 23 36 26" stroke="var(--color-text-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : state === "listening" ? (
            <path d="M16 25 Q26 30 36 25" stroke={col.ring} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M16 25 Q26 30 36 25" stroke="var(--color-text-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          )}
        </svg>

        {state === "thinking" ? (
          <span style={{ fontSize: 15, letterSpacing: 3, color: col.ring, minWidth: 26, textAlign: "center" }}>
            {"●".repeat(dotCount)}{"○".repeat(3 - dotCount)}
          </span>
        ) : (
          <WaveBars active={state === "speaking" || state === "listening"} color={col.ring} />
        )}
      </div>
    </div>
  );
}

function ScoreRing({ value, size = 56, color, label, bg }: { value: number, size?: number, color: string, label: string, bg: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-tertiary)" strokeWidth="4" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.4,0.64,1)" }} />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", position: "relative", zIndex: 1 }}>{value}</span>
      </div>
      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function StatPill({ value, label }: { value: string | number, label: string }) {
  return (
    <div style={{
      flex: 1,
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      padding: "10px 12px",
      border: "0.5px solid var(--color-border-tertiary)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

export default function LinguaBot() {
  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [botText, setBotText] = useState("Tap the button below and start speaking. I'm here to help you improve.");
  const [scores, setScores] = useState({ grammar: 0, vocabulary: 0, fluency: 0 });
  const [tags, setTags] = useState<string[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [justSpoke, setJustSpoke] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lastBotAudioB64, setLastBotAudioB64] = useState<string | null>(null);

  // Initialize Backend Session
  useEffect(() => {
    const init = async () => {
      try {
        const id = await createNewSession();
        setSessionId(id);
      } catch {
        setSessionId(uid());
      }
    };
    init();
  }, []);

  useEffect(() => {
    // Automatically detect if the user changes their microphone permission to "granted"
    if (micDenied && navigator?.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          permissionStatus.onchange = () => {
            if (permissionStatus.state === "granted") {
              setMicDenied(false);
              setTimeout(() => {
                handleSpeak();
              }, 400); // Slight delay for the DOM to resync
            }
          };
        })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micDenied, state]);

  const loadBackendProgress = async (id: string) => {
    try {
      const p = await getProgress(id);
      setScores({
        grammar: Math.round(p.grammar * 10) || 42,
        vocabulary: Math.round(p.vocabulary * 10) || 38,
        fluency: Math.round(p.fluency * 10) || 55,
      });
      if (p.feedback_history?.length > 0) {
        const recent = p.feedback_history[p.feedback_history.length - 1];
        if (recent?.grammar_errors?.length > 0) {
          setTags(recent.grammar_errors.slice(0, 3));
        }
      }
    } catch { }
  };

  const playAudioB64 = (b64: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `data:audio/mpeg;base64,${b64}`;
    audioRef.current.onended = () => setState("idle");
    audioRef.current.play().catch(() => setState("idle"));
  };

  const handleVoiceBlob = async (blob: Blob) => {
    setState("thinking");
    try {
      // Connect to Backend Endpoint
      const result = await fullConversation(blob, sessionId, "casual", "intermediate");
      setPrompt(`You: ${result.user_text}`);
      setBotText(result.bot_text);
      setTags(shuffle(FEEDBACK_TAGS).slice(0, 3));
      setState("speaking");
      setSessionCount(c => c + 1);

      if (result.audio_base64) {
        setLastBotAudioB64(result.audio_base64);
        playAudioB64(result.audio_base64);
      } else {
        const b64 = await fetchTTSAudio(result.bot_text);
        setLastBotAudioB64(b64);
        playAudioB64(b64);
      }

      await loadBackendProgress(sessionId);
      setJustSpoke(true);
    } catch (e) {
      setBotText("Something went wrong processing your voice.");
      setState("idle");
    }
  };

  const handleSpeak = async () => {
    if (state !== "idle") return;
    setTags([]); setJustSpoke(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser is blocking microphone access because you are using an insecure HTTP connection! Please access the site using the HTTPS tunnel link.");
        setMicDenied(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      let options: MediaRecorderOptions & { mimeType: string } = { mimeType: "audio/webm;codecs=opus" };
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          if (MediaRecorder.isTypeSupported("audio/webm")) {
            options = { mimeType: "audio/webm" };
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            options = { mimeType: "audio/mp4" };
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            options = { mimeType: "audio/ogg" };
          }
        }
      }
      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: options.mimeType || "audio/webm" });
        await handleVoiceBlob(blob);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setState("listening");
      setMicDenied(false);
    } catch {
      setMicDenied(true);
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && state === "listening") {
      mediaRecorderRef.current.stop();
      setState("thinking");
    }
  };

  const handleReplay = async () => {
    if (state !== "idle") return;
    if (lastBotAudioB64) {
      setState("speaking");
      playAudioB64(lastBotAudioB64);
    } else {
      setBotText("No recent audio to replay.");
    }
  };

  const handleNewExercise = async () => {
    if (state !== "idle") return;
    setBotText("Generating a personal exercise for you...");
    setState("thinking");
    try {
      const ex = await generateExercise(sessionId);
      setPrompt(ex.topic + ": " + ex.instructions);
    } catch {
      setPrompt(shuffle(PROMPTS)[0]);
    }
    setBotText("New exercise loaded. Take a breath, then tap to speak.");
    setTags([]); setJustSpoke(false);
    setState("idle");
  };

  const handleNewSession = async () => {
    setState("idle");
    setScores({ grammar: 0, vocabulary: 0, fluency: 0 });
    setTags([]); setSessionCount(0); setJustSpoke(false);
    setBotText("Tap the button below and start speaking. I'm here to help you improve.");
    setPrompt(PROMPTS[0]);
    setShowAnalysis(false);
    try {
      const id = await createNewSession();
      setSessionId(id);
    } catch { }
  };

  const col = STATES[state];
  // Safeguard overall calculation
  const overall = Object.values(scores).reduce((a, b) => a + b, 0) === 0 ? 0 : Math.round((scores.grammar + scores.vocabulary + scores.fluency) / 3);

  return (
    <>
      {showIntroModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          fontFamily: "var(--font-sans)"
        }}>
          <div style={{
            background: "#fff", padding: "2.5rem 2rem", borderRadius: "24px",
            maxWidth: 380, width: "90%", textAlign: "center",
            boxShadow: "0 10px 35px rgba(0,0,0,0.2)"
          }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: 22, color: "var(--color-text-primary)", fontWeight: 700 }}>
              Welcome to LinguaBot!
            </h2>
            <p style={{ margin: "0 0 1.7rem", color: "var(--color-text-secondary)", fontSize: 15, lineHeight: 1.5 }}>
              Do you want to start the microphone so we can begin our conversation?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => { setShowIntroModal(false); handleSpeak(); }}
                style={{
                  padding: "13px 24px", borderRadius: 99, background: "#7F77DD",
                  color: "#fff", border: "none", fontWeight: 600, cursor: "pointer",
                  fontSize: 15, transition: "background 0.2s"
                }}
              >
                Yes, start microphone
              </button>
              <button
                onClick={() => setShowIntroModal(false)}
                style={{
                  padding: "13px 24px", borderRadius: 99, background: "transparent",
                  color: "var(--color-text-tertiary)", border: "none", fontWeight: 600, cursor: "pointer",
                  fontSize: 14
                }}
              >
                No, maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        minHeight: 580,
        fontFamily: "var(--font-sans)",
        background: "var(--color-background-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        border: "0.5px solid var(--color-border-tertiary)",
        margin: "0 auto",
        maxWidth: "900px"
      }}>

        {/* ── Left panel ── */}
        <div style={{
          flex: "1 1 400px", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "2.5rem 2rem 2rem",
          gap: "1.1rem", position: "relative",
        }}>

          {/* Status pill */}
          <div style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 15px", borderRadius: 99,
            background: col.bg,
            border: `0.5px solid ${col.ring}50`,
            transition: "background 0.4s, border-color 0.4s",
            whiteSpace: "nowrap",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: col.ring,
              animation: state !== "idle" ? "pulse 1s ease-in-out infinite" : "none",
              transition: "background 0.4s",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: col.ring,
              transition: "color 0.4s",
            }}>{col.label}</span>
          </div>

          {/* Avatar */}
          <AvatarOrb state={state} />

          {/* Prompt card */}
          <div style={{
            background: "var(--color-background-primary)",
            borderRadius: "var(--border-radius-lg)",
            border: "0.5px solid var(--color-border-tertiary)",
            padding: "0.9rem 1.25rem",
            maxWidth: 360, width: "100%", textAlign: "center",
          }}>
            <div style={{
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "var(--color-text-tertiary)", marginBottom: 6, fontWeight: 600,
            }}>today's exercise</div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{prompt}</p>
          </div>

          {/* Bot message bubble */}
          <div style={{
            maxWidth: 360, width: "100%",
            background: state === "speaking" ? "var(--color-background-primary)" : "transparent",
            border: state === "speaking" ? "0.5px solid var(--color-border-tertiary)" : "0.5px solid transparent",
            borderRadius: "var(--border-radius-lg)",
            padding: state === "speaking" ? "0.8rem 1.1rem" : "0.8rem 0",
            minHeight: 52,
            transition: "all 0.35s ease",
            textAlign: "center",
          }}>
            <p style={{
              margin: 0, fontSize: 14, lineHeight: 1.65,
              color: "var(--color-text-secondary)",
            }}>{botText}</p>
          </div>

          {/* Feedback tags — animated in */}
          <div style={{ minHeight: 28, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {state === "idle" && tags.map((t, i) => {
              const tc = TAG_COLORS[i % TAG_COLORS.length];
              return (
                <span key={t} style={{
                  fontSize: 11.5, padding: "4px 12px",
                  borderRadius: 99,
                  background: tc.bg,
                  color: tc.text,
                  fontWeight: 500,
                  border: `0.5px solid ${tc.border}`,
                  letterSpacing: "0.01em",
                }}>{t}</span>
              );
            })}
          </div>

          {/* Microphone Permission Warning */}
          {micDenied && (
            <div style={{
              background: "#FCEBEB", border: "1px solid #E24B4A", borderRadius: "12px",
              padding: "16px 20px", color: "#993C1D", fontSize: "13px", lineHeight: "1.5",
              textAlign: "center", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10
            }}>
              <div>
                <strong>Microphone Access Blocked!</strong> <br />
                We need your mic to hear you. Please tap the <strong>lock icon 🔒</strong> (or page settings icon) next to the URL at the top of your browser, choose <strong>Settings / Permissions</strong>, and allow the Microphone!
              </div>
              <button onClick={handleSpeak} style={{
                padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                cursor: "pointer", background: "#E24B4A", color: "#fff", border: "none",
                margin: "0 auto", marginTop: 4, width: "fit-content"
              }}>
                I've Allowed It — Retry
              </button>
            </div>
          )}

          {/* Primary CTA */}
          <button onClick={state === "listening" ? handleStop : handleSpeak} disabled={state !== "idle" && state !== "listening"} style={{
            padding: "13px 44px", borderRadius: 99, fontSize: 14, fontWeight: 600,
            cursor: (state !== "idle" && state !== "listening") ? "not-allowed" : "pointer",
            background: (state !== "idle" && state !== "listening") ? "var(--color-background-secondary)" : (state === "listening" ? col.ring : col.ring),
            color: (state !== "idle" && state !== "listening") ? "var(--color-text-tertiary)" : "#fff",
            border: "none",
            letterSpacing: "0.01em",
            transition: "all 0.25s",
            transform: (state !== "idle" && state !== "listening") ? "scale(0.97)" : "scale(1)",
            boxShadow: state === "idle" ? `0 0 0 4px ${col.bg}` : "none",
          }}>
            {state === "listening" ? "⏹ Stop Recording" : state === "thinking" ? "Processing..." : state === "speaking" ? "Speaking..." : "Tap to speak"}
          </button>

          {/* Secondary controls */}
          <div style={{ display: "flex", gap: 7 }}>
            {[
              { label: "Replay", action: handleReplay, disabled: state !== "idle" },
              { label: "New exercise", action: handleNewExercise, disabled: state !== "idle" },
              { label: "New session", action: handleNewSession, disabled: false },
            ].map(({ label, action, disabled }) => (
              <button key={label} onClick={action} disabled={disabled} style={{
                padding: "7px 14px", borderRadius: 99, fontSize: 11.5,
                cursor: disabled ? "not-allowed" : "pointer",
                background: "transparent",
                color: disabled ? "var(--color-text-tertiary)" : "var(--color-text-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
                opacity: disabled ? 0.4 : 1,
                transition: "all 0.2s",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{
          flex: "1 1 216px",
          borderLeft: "0.5px solid var(--color-border-tertiary)",
          background: "var(--color-background-primary)",
          padding: "1.5rem 1.25rem",
          display: "flex", flexDirection: "column", gap: 0,
          minWidth: 260
        }}>

          {/* Section: Skill scores */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "var(--color-text-tertiary)", fontWeight: 600, marginBottom: 14,
            }}>Skill scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 10px" }}>
              <ScoreRing value={scores.grammar} size={60} color="#7F77DD" bg="#EEEDFE" label="Grammar" />
              <ScoreRing value={scores.vocabulary} size={60} color="#1D9E75" bg="#E1F5EE" label="Vocab" />
              <ScoreRing value={scores.fluency} size={60} color="#D85A30" bg="#FAECE7" label="Fluency" />
              <ScoreRing value={overall} size={60} color="#378ADD" bg="#E6F1FB" label="Overall" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.25rem" }} />

          {/* Section: Session */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em",
              color: "var(--color-text-tertiary)", fontWeight: 600, marginBottom: 10,
            }}>Session</div>
            <div style={{ display: "flex", gap: 8 }}>
              <StatPill value={sessionCount} label="exchanges" />
              <StatPill value={Math.min(sessionCount * 4, 99)} label="XP earned" />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.25rem" }} />

          {/* Section: Analysis toggle */}
          <div style={{ marginBottom: "1.25rem" }}>
            <button onClick={() => setShowAnalysis(a => !a)} style={{
              width: "100%", padding: "8px 0", borderRadius: "var(--border-radius-md)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: showAnalysis ? "var(--color-background-secondary)" : "transparent",
              color: "var(--color-text-secondary)",
              border: "0.5px solid var(--color-border-secondary)",
              transition: "all 0.2s",
              marginBottom: showAnalysis ? 10 : 0,
            }}>
              {showAnalysis ? "Hide analysis" : "Show analysis"}
            </button>

            {showAnalysis && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Strongest", val: Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none' },
                  { label: "Needs work", val: Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0] || 'none' },
                  { label: "Total score", val: overall + "%" },
                ].map(({ label, val }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--color-background-secondary)",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-tertiary)",
                  }}>
                    <span style={{ fontSize: 11.5, color: "var(--color-text-secondary)" }}>{label}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-text-primary)", textTransform: "capitalize" }}>{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tip card — pinned to bottom */}
          <div style={{ marginTop: "auto" }}>
            <div style={{
              padding: "10px 12px",
              background: "#EEEDFE",
              borderRadius: "var(--border-radius-md)",
              border: "0.5px solid #AFA9EC",
            }}>
              <div style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em",
                fontWeight: 600, color: "#534AB7", marginBottom: 4,
              }}>tip</div>
              <p style={{ margin: 0, fontSize: 12, color: "#3C3489", lineHeight: 1.55 }}>
                Speak at a natural pace. Clarity always beats speed.
              </p>
            </div>
          </div>
        </div>

        <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0 %, 100 % { opacity: 1; } 50 % { opacity: 0.3; } }
  `}</style>
      </div>
    </>
  );
}
