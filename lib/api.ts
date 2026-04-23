// lib/api.ts — All FastAPI backend calls

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Message {
    id: string;
    role: "user" | "bot";
    text: string;
    timestamp: Date;
    audioB64?: string;
}

export interface AnalysisResult {
    grammar_score: number;
    vocabulary_score: number;
    fluency_score: number;
    grammar_errors: string[];
    vocabulary_suggestions: string[];
    overall_feedback: string;
    corrected_text: string;
    pronunciation_feedback?: string[];
}

export interface ProgressStats {
    grammar: number;
    vocabulary: number;
    fluency: number;
    feedback_history: Array<{
        grammar_score: number;
        vocabulary_score: number;
        fluency_score: number;
        overall_feedback: string;
        grammar_errors: string[];
    }>;
}

export interface Exercise {
    topic: string;
    instructions: string;
    prompts: string[];
    example_answers?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
    return Math.random().toString(36).slice(2, 10);
}

// ─── Session ──────────────────────────────────────────────────────────────────
export async function createNewSession(): Promise<string> {
    const res = await fetch(`${API_BASE}/new-session/`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to create session");
    const data = await res.json();
    return data.session_id;
}

// ─── LLM ─────────────────────────────────────────────────────────────────────
export async function sendTextToLLM(
    text: string,
    sessionId: string,
    mode = "casual",
    level = "intermediate"
): Promise<string> {
    const res = await fetch(`${API_BASE}/llm/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, session_id: sessionId, mode, level }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.response as string;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
export async function fetchTTSAudio(text: string): Promise<string> {
    const res = await fetch(`${API_BASE}/tts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("TTS request failed");
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ─── STT ─────────────────────────────────────────────────────────────────────
/** Get the file extension that matches the blob's mime type */
function blobExtension(blob: Blob): string {
    const mt = blob.type.split(";")[0].trim();
    const map: Record<string, string> = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/mpeg": "mp3",
        "audio/mp4": "mp4",
        "audio/flac": "flac",
    };
    return map[mt] ?? "webm"; // browser MediaRecorder default is webm
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    const ext = blobExtension(audioBlob);
    formData.append("file", audioBlob, `audio.${ext}`);

    const res = await fetch(`${API_BASE}/stt/`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`STT error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.text as string;
}

// ─── Full Conversation (STT → LLM → TTS) ─────────────────────────────────────
export async function fullConversation(
    audioBlob: Blob,
    sessionId: string,
    mode = "casual",
    level = "intermediate"
): Promise<{ user_text: string; bot_text: string; audio_base64?: string }> {
    const formData = new FormData();
    // Preserve the actual audio format so Groq Whisper can decode it correctly
    const ext = blobExtension(audioBlob);
    formData.append("file", audioBlob, `audio.${ext}`);
    formData.append("session_id", sessionId);
    formData.append("mode", mode);
    formData.append("level", level);

    const res = await fetch(`${API_BASE}/conversation/`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Conversation error ${res.status}: ${err}`);
    }
    return res.json();
}

// ─── Analyze English ─────────────────────────────────────────────────────────
export async function analyzeEnglish(
    text: string,
    sessionId: string
): Promise<AnalysisResult> {
    const res = await fetch(`${API_BASE}/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, session_id: sessionId }),
    });
    if (!res.ok) throw new Error("Analysis failed");
    return res.json();
}

// ─── Progress ─────────────────────────────────────────────────────────────────
export async function getProgress(sessionId: string): Promise<ProgressStats> {
    const res = await fetch(`${API_BASE}/progress/${sessionId}`);
    if (!res.ok) return { grammar: 0, vocabulary: 0, fluency: 0, feedback_history: [] };
    return res.json();
}

// ─── Exercise ────────────────────────────────────────────────────────────────
export async function generateExercise(sessionId: string): Promise<Exercise> {
    const res = await fetch(`${API_BASE}/exercise/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) throw new Error("Exercise generation failed");
    return res.json();
}

export { uid };
