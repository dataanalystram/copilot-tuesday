"use client";

/**
 * Voice input — a mic button that pipes the user's spoken prompt straight
 * into the agent as a message.
 *
 * DESIGN NOTE: CopilotKit v2 ships `CopilotChatAudioRecorder` which produces
 * a `Blob` via an imperative handle. We'd still need a transcription
 * endpoint to turn that into text — the runtime's `transcribeAudioUrl`
 * assumes Copilot Cloud, not the local Ollama chat endpoint. To stay self-hosted, we use the browser-native Web Speech API
 * (SpeechRecognition) which runs on-device in Chrome/Edge/Safari. The
 * button auto-hides in browsers without support, so this is purely
 * additive — no regression if SR is missing.
 *
 * The "CopilotKit way" would be to replace this with a tiny /api/transcribe
 * route that forwards the blob to a Whisper-compatible endpoint. Clearly
 * marked below.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { motion } from "framer-motion";
import { handleLocalDashboardCommand } from "@/lib/instant-dashboard";
import type { AgentSharedState } from "@/lib/agent-state";
import { maybeRequestCanvasApproval } from "@/lib/local-approval";

type SRInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SRConstructor = new () => SRInstance;

function getSR(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  // Webkit prefix is still required on Safari and older Chrome builds.
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceButton({ className }: { className?: string }) {
  const { agent } = useAgent();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const srRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      agent.addMessage({ id, role: "user", content: trimmed });
      if (maybeRequestCanvasApproval(trimmed, agent.state as AgentSharedState | undefined)) {
        return;
      }
      const local = handleLocalDashboardCommand(trimmed, agent.state as AgentSharedState | undefined);
      if (local.shouldRunAgent) {
        void agent.runAgent();
      }
    },
    [agent],
  );

  const toggle = useCallback(() => {
    if (listening) {
      srRef.current?.stop();
      return;
    }
    const SR = getSR();
    if (!SR) return;
    const sr = new SR();
    sr.continuous = false;
    sr.interimResults = true;
    sr.lang = "en-US";
    let finalText = "";
    sr.onstart = () => setListening(true);
    sr.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText) submit(finalText);
    };
    sr.onerror = () => {
      setListening(false);
      setInterim("");
    };
    sr.onresult = (ev) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        t += r[0].transcript;
        if (r.isFinal) finalText += r[0].transcript;
      }
      setInterim(t);
    };
    srRef.current = sr;
    sr.start();
  }, [listening, submit]);

  if (!supported) return null;

  return (
    <div className={`relative ${className ?? ""}`}>
      <motion.button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
          listening
            ? "border-rose-400/60 bg-rose-500/20 text-rose-200"
            : "border-white/10 bg-white/5 text-white/70 hover:border-violet-400/60 hover:text-white"
        }`}
        whileTap={{ scale: 0.94 }}
      >
        <MicIcon />
        {listening && (
          <motion.span
            className="absolute inset-0 rounded-full ring-2 ring-rose-400/40"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
      </motion.button>
      {listening && interim && (
        <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md border border-white/10 bg-black/80 px-3 py-1.5 text-xs text-white/80 shadow-xl backdrop-blur">
          {interim}
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}
