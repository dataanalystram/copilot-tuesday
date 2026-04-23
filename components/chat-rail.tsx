"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { AnimatePresence, motion } from "framer-motion";
import { SuggestionPills } from "./suggestions";
import VoiceButton from "./voice-button";
import { AttachButton } from "./attachment-dropzone";
import type { AgentSharedState } from "@/lib/agent-state";
import { localApprovalStore, maybeRequestCanvasApproval, useLocalApproval } from "@/lib/local-approval";
import { useTextAttachments } from "@/lib/attachment-store";

interface SimpleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function cleanAssistantText(text: string): string {
  if (/No tool response indicates|Let me begin with creating|Let's begin by fetching|I will generate some random data/i.test(text)) {
    return "";
  }
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/<\/?tool_call>/g, "")
    .replace(/<arg_key>[\s\S]*?<\/arg_value>/g, "")
    .replace(/<\/?(arg_key|arg_value|tool_response)>/g, "")
    .replace(/^(morph_surface|set_theme|set_showcase_stage|pin_insight|update_script_beat|annotate_surface|approve_showcase_plan|github_\w+|project_\w+|python_data_profile|python_data_transform|web_research_\w+|web_fetch_url)<[\s\S]*$/m, "")
    .replace(/^\s*[{[][{"][\s\S]*$/m, "")
    .trim();
}

function extractMessages(raw: ReadonlyArray<{ id: string; role: string; content?: unknown }>): SimpleMessage[] {
  return raw
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const content =
        message.role === "assistant"
          ? cleanAssistantText(textFromContent(message.content))
          : textFromContent(message.content).trim();
      return {
        id: message.id,
        role: message.role as "user" | "assistant",
        content,
      };
    })
    .filter((message) => message.content.length > 0);
}

export default function ChatRail({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const approval = useLocalApproval();
  const textAttachments = useTextAttachments();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      setMessages(extractMessages(agent.messages ?? []));
      setRunning(agent.isRunning);
    };
    refresh();
    const sub = agent.subscribe({
      onMessagesChanged: refresh,
      onRunInitialized: refresh,
      onRunFinalized: refresh,
      onRunFailed: refresh,
    });
    return () => {
      try {
        (sub as { unsubscribe?: () => void })?.unsubscribe?.();
      } catch {
        /* noop */
      }
    };
  }, [agent]);

  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, running]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || running) return;
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
    if (inputRef.current) inputRef.current.style.height = "auto";
    if (maybeRequestCanvasApproval(trimmed, agent.state as AgentSharedState | undefined)) {
      return;
    }
    void copilotkit.runAgent({ agent });
  }, [agent, copilotkit, draft, running, textAttachments]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="rail"
          initial={{ x: 460, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 460, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          role="complementary"
          aria-label="AI chat"
          className="fixed right-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-[min(460px,96vw)] flex-col border-l border-white/5 bg-[#080510]/95 shadow-2xl shadow-black/50 backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-cyan-300" : "bg-emerald-400"}`} />
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/45">
                  {running ? "thinking" : "AI assistant"}
                </span>
              </div>
              <div className="mt-1 text-xs text-white/55">
                Ask a question, build a dashboard, or analyze a file.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="rounded-md p-1 text-white/50 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {messages.length === 0 && !approval ? (
              <div className="flex h-full flex-col justify-center gap-3 text-sm text-white/55">
                <div className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/45">new chat</div>
                <div className="text-xl font-semibold text-white">What should we work on?</div>
                <div>Send a normal message. The assistant will answer here and update the canvas when a visual artifact is needed.</div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((message) => (
                  <li key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-cyan-500/80 text-cyan-950"
                          : "border border-white/10 bg-white/5 text-white/82"
                      }`}
                    >
                      {message.content}
                    </div>
                  </li>
                ))}
                {running && (
                  <li className="flex justify-start">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/55">
                      Thinking...
                    </div>
                  </li>
                )}
                {approval && (
                  <li className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-50">
                      <div className="font-semibold text-amber-100">{approval.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-amber-100/70">{approval.summary}</div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => localApprovalStore.approve()}
                          className="rounded-md bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-200"
                        >
                          {approval.approveLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => localApprovalStore.reject()}
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                          {approval.rejectLabel}
                        </button>
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="border-t border-white/5 px-4 pt-3">
            <SuggestionPills max={3} />
          </div>

          <div className="border-t border-white/5 bg-black/35 px-3 pb-3 pt-2">
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-cyan-300/50 focus-within:ring-2 focus-within:ring-cyan-300/20">
              <AttachButton className="shrink-0" />
              <VoiceButton className="shrink-0" />
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = Math.min(event.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder={textAttachments.length > 0 ? `Message with ${textAttachments.length} file attached...` : "Message the assistant..."}
                rows={1}
                aria-label="Message input"
                className="min-h-[36px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || running}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-cyan-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M7 11l5-5 5 5" />
                  <path d="M12 6v13" />
                </svg>
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
