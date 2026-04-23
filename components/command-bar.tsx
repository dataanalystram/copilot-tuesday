"use client";

/**
 * CommandBar — the always-visible floating input at the bottom of the
 * canvas. Acts as a zero-friction entry point: type a morph, press Enter,
 * watch the dashboard rewire itself.
 *
 * The command bar writes directly to the shared agent via agent.addMessage
 * + agent.runAgent(), so the chat rail and the command bar send to the
 * same thread. It ALSO auto-opens the chat rail on first send so the user
 * sees the assistant's reply without hunting for it.
 *
 * Keyboard:
 *   ⌘K / /          focus the input
 *   Enter           submit
 *   Shift+Enter     newline
 *   Esc             blur
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentSharedState } from "@/lib/agent-state";
import { useShortcut } from "./shortcuts";
import { SuggestionPills } from "./suggestions";
import VoiceButton from "./voice-button";
import { AttachButton } from "./attachment-dropzone";
import { handleLocalDashboardCommand } from "@/lib/instant-dashboard";
import { maybeRequestCanvasApproval } from "@/lib/local-approval";
import { textAttachmentStore, useTextAttachments } from "@/lib/attachment-store";
import { maybeBuildCsvDashboard } from "@/lib/csv-surfaces";
import { runLocalAsyncBuild } from "@/lib/local-async-build";

export default function CommandBar({
  onSend,
}: {
  /** Called after each successful submit — typically opens the chat rail. */
  onSend?: () => void;
}) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const theme = ((agent.state as AgentSharedState | undefined)?.theme ?? "dark");
  const isLight = theme === "light";
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const textAttachments = useTextAttachments();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const content =
      textAttachments.length > 0
        ? `${trimmed}\n\nAttached files:\n${textAttachments
            .map((file) => `--- ${file.filename} ---\n${file.content}`)
            .join("\n\n")}`
        : trimmed;
    agent.addMessage({ id, role: "user", content });
    setDraft("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    const builtCsv = maybeBuildCsvDashboard(textAttachments);
    if (builtCsv) {
      textAttachmentStore.clear();
      void copilotkit.runAgent({ agent });
      onSend?.();
      return;
    }
    if (maybeRequestCanvasApproval(trimmed, agent.state as AgentSharedState | undefined)) {
      onSend?.();
      return;
    }
    const local = handleLocalDashboardCommand(trimmed, agent.state as AgentSharedState | undefined);
    if (local.localAsync) {
      void runLocalAsyncBuild(local.localAsync, local.topic).catch(() => {
        // The agent response remains available if the deterministic bridge fails.
      });
    }
    if (local.shouldRunAgent) {
      void copilotkit.runAgent({ agent });
    }
    onSend?.();
  }, [draft, agent, copilotkit, onSend, textAttachments]);

  useShortcut("focus-input", () => {
    inputRef.current?.focus();
  });

  useEffect(() => {
    if (!inputRef.current) return;
    const el = inputRef.current;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === el) el.blur();
    };
    el.addEventListener("keydown", onEsc);
    return () => el.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-5 pt-10">
      {/* Suggestion pills appear just above the bar when it's idle. */}
      <div className="pointer-events-auto mx-auto mb-3 flex max-w-3xl justify-center">
        <AnimatePresence>
          {draft.length === 0 && (
            <motion.div
              key="pills"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <SuggestionPills max={4} className="justify-center" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The bar. */}
      <motion.div
        layout
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 30, delay: 0.15 }}
        className={`pointer-events-auto mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border px-2 py-2 shadow-2xl backdrop-blur-2xl transition ${
          focused
            ? isLight
              ? "border-violet-500/40 bg-white/95 ring-2 ring-violet-300/40"
              : "border-violet-400/50 bg-black/70 ring-2 ring-violet-400/30"
            : isLight
              ? "border-gray-300 bg-white/85 hover:border-gray-400"
              : "border-white/10 bg-black/50 hover:border-white/20"
        }`}
      >
        <span className="ml-2 mr-0.5 self-center text-violet-300" aria-hidden>
          ›_
        </span>
        <AttachButton className="shrink-0 self-center" />
        <VoiceButton className="shrink-0 self-center" />
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask the assistant or describe the dashboard you want..."
          rows={1}
          aria-label="Morph command"
          className={`min-h-[36px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] focus:outline-none ${
            isLight ? "text-gray-950 placeholder:text-gray-400" : "text-white placeholder:text-white/30"
          }`}
        />
        <motion.button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          aria-label="Send message"
          whileTap={{ scale: 0.94 }}
          className="flex h-9 min-w-[64px] shrink-0 items-center justify-center gap-1.5 self-center rounded-full bg-violet-500 px-3 text-sm font-medium text-white shadow-md transition hover:bg-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
        >
          Send
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </motion.button>
      </motion.div>
    </div>
  );
}
