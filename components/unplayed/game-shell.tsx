"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { motion, AnimatePresence } from "framer-motion";
import { GameBoard }  from "./game-board";
import { RulesPanel } from "./rules-panel";
import { ArcadeRace } from "./arcade-race";

interface GameShellProps {
  agentId: string;
}

export function GameShell({ agentId }: GameShellProps) {
  const { agent }      = useAgent({ agentId });
  const { copilotkit } = useCopilotKit();
  const [draft, setDraft]             = useState("");
  const [running, setRunning]         = useState(false);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [moveToast, setMoveToast]     = useState<{ text: string; ok: boolean } | null>(null);
  const [battleMode, setBattleMode]   = useState(false);
  const [arcadeMode, setArcadeMode]   = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevHistoryLen = useRef(0);

  const state: Record<string, unknown> = (agent?.state as Record<string, unknown>) ?? {};
  const phase           = (state.phase as string)  ?? "idle";
  const gameName        = (state.game_name as string) ?? "";
  const tagline         = (state.tagline as string) ?? "";
  const rules           = (state.rules as string[]) ?? [];
  const explanation     = (state.rules_explanation as string) ?? "";
  const victoryCondition= (state.victory_condition as string) ?? "";
  const flavor          = (state.flavor as Record<string, string | number>) ?? {};
  const board           = (state.board as { cells: Record<string, {value: string; label: string; special?: string}>; size: number; topology: string }) ?? { cells: {}, size: 5, topology: "grid" };
  const turn            = (state.turn as string)   ?? "none";
  const legalMoves      = (state.legal_moves as Array<{ id: string; label: string }>) ?? [];
  const winner          = (state.winner as string) ?? "";
  const aiReasoning     = (state.ai_reasoning as string) ?? "";
  const activity        = (state.agent_activity as string) ?? "";
  const history         = (state.history as Array<{player: string; move: {id?: string; label?: string}; reasoning?: string}>) ?? [];
  const moveCount       = (state.move_count as number) ?? 0;
  const pieceIconHuman  = (state.piece_icon_human as string) ?? "⚡";
  const pieceIconAi     = (state.piece_icon_ai as string)    ?? "☯";
  const boardPalette    = (state.board_palette as string)    ?? "void";

  // Last move cell for highlighting
  const lastHistoryEntry = history[history.length - 1];
  const lastMoveCell     = lastHistoryEntry?.move?.id ?? lastHistoryEntry?.move?.label ?? null;

  // Clear pending cell when history advances (move confirmed)
  useEffect(() => {
    if (history.length > prevHistoryLen.current) {
      prevHistoryLen.current = history.length;
      setPendingCell(null);
    }
  }, [history.length]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!moveToast) return;
    const t = setTimeout(() => setMoveToast(null), 2200);
    return () => clearTimeout(t);
  }, [moveToast]);

  // Battle mode — AI plays for human when it's human's turn
  useEffect(() => {
    if (!battleMode || !agent || running || winner) return;
    if (turn === "human" && phase === "playing") {
      const t = setTimeout(() => {
        sendMessage("Make the best strategic move for the human player.");
      }, 900);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleMode, turn, phase, running, winner]);

  useEffect(() => {
    const sub = agent?.subscribe({
      onRunInitialized: () => setRunning(true),
      onRunFinalized:   () => setRunning(false),
      onRunFailed:      () => setRunning(false),
    });
    setRunning(agent?.isRunning ?? false);
    return () => {
      try { (sub as {unsubscribe?: () => void})?.unsubscribe?.(); } catch {/* noop */}
    };
  }, [agent]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !agent) return;
    const id = crypto.randomUUID();
    agent.addMessage({ id, role: "user", content: trimmed });
    setDraft("");
    void copilotkit.runAgent({ agent });
  }, [agent, copilotkit]);

  const startGame = useCallback(() => {
    sendMessage("Start a new Game Lab session: invent a tight original 2-player strategy game, explain why the mechanic is novel, then prepare it for a fast playtest.");
  }, [sendMessage]);

  const onPickMove = useCallback((cellId: string) => {
    setPendingCell(cellId);
    setMoveToast({ text: `Move sent: ${cellId}`, ok: true });
    sendMessage(`I pick cell ${cellId}`);
  }, [sendMessage]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  }, [draft, sendMessage]);

  const isIdle    = phase === "idle";
  const isPlaying = ["explaining", "playing", "ended"].includes(phase);
  const showBoard = isPlaying && board.size > 0;

  // Show invalid-move feedback from agent_activity
  useEffect(() => {
    if (activity.startsWith("⚠")) {
      setMoveToast({ text: activity.replace("⚠ ", ""), ok: false });
      setPendingCell(null);
    }
  }, [activity]);

  if (arcadeMode) {
    return <ArcadeRace onExit={() => setArcadeMode(false)} />;
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#060410] text-white overflow-hidden">

      {/* ── Top status bar ── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-white/5 bg-black/50 px-5 py-2.5 backdrop-blur-sm">
        <span className={`h-2 w-2 rounded-full shrink-0 transition-all ${
          running ? "bg-violet-400 animate-ping" :
          winner  ? (winner === "human" ? "bg-emerald-400" : winner === "ai" ? "bg-red-400" : "bg-white/40") :
          "bg-emerald-400/60"
        }`} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 truncate max-w-xs">
          {activity || (running ? "processing…" : phase === "idle" ? "ready" : phase)}
        </span>

        <div className="flex-1" />

        {gameName && (
          <span className="font-mono text-white/70 text-xs truncate max-w-[180px]">{gameName}</span>
        )}

        {moveCount > 0 && (
          <span className="text-[10px] text-white/25 font-mono">
            move {moveCount}
          </span>
        )}

        {/* Battle mode toggle */}
        {isPlaying && !winner && (
          <button
            type="button"
            onClick={() => setBattleMode(b => !b)}
            title={battleMode ? "Exit battle mode" : "Watch AI battle itself"}
            className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-full border transition ${
              battleMode
                ? "border-violet-400/60 bg-violet-500/20 text-violet-300"
                : "border-white/10 text-white/25 hover:text-white/60 hover:border-white/20"
            }`}
          >
            {battleMode ? "⚔ battle" : "⚔ battle"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setArcadeMode(true)}
          className="text-[9px] uppercase tracking-widest text-cyan-200/55 hover:text-cyan-100 transition px-2 py-1 rounded border border-cyan-300/10 hover:border-cyan-300/25"
        >
          arcade
        </button>

        {isPlaying && !winner && (
          <button
            type="button"
            onClick={() => sendMessage("Playtest this design: identify balance risks, dominant strategies, unclear rules, and one concrete rebalance patch.")}
            className="text-[9px] uppercase tracking-widest text-white/25 hover:text-white/60 transition px-2 py-1 rounded border border-transparent hover:border-white/10"
          >
            playtest
          </button>
        )}

        {isPlaying && !winner && (
          <button
            type="button"
            onClick={() => sendMessage("Package this game as a concise demo card: hook, rules, board, victory condition, and why the agentic UI matters.")}
            className="text-[9px] uppercase tracking-widest text-white/25 hover:text-white/60 transition px-2 py-1 rounded border border-transparent hover:border-white/10"
          >
            package
          </button>
        )}

        {isPlaying && !winner && (
          <button
            type="button"
            onClick={() => sendMessage("New game please, invent a completely different one with a different theme and mechanic.")}
            className="text-[9px] uppercase tracking-widest text-white/25 hover:text-white/60 transition px-2 py-1 rounded border border-transparent hover:border-white/10"
          >
            new game
          </button>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {isIdle ? (
          <IdleScreen onStart={startGame} onArcade={() => setArcadeMode(true)} running={running} />
        ) : (
          <>
            {/* ── Left: board area ── */}
            <div className="flex-1 min-w-0 flex items-center justify-center p-5 relative">
              {showBoard ? (
                <div className="w-full max-w-[420px] aspect-square">
                  <GameBoard
                    board={board}
                    legalMoves={legalMoves}
                    turn={turn}
                    onPickMove={onPickMove}
                    winner={winner}
                    pieceIconHuman={pieceIconHuman}
                    pieceIconAi={pieceIconAi}
                    boardPalette={boardPalette}
                    pendingCell={pendingCell}
                    lastMoveCell={lastMoveCell}
                  />
                </div>
              ) : (
                <PhaseAnimation phase={phase} flavor={flavor} />
              )}

              {/* Winner overlay */}
              <AnimatePresence>
                {winner && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="text-center">
                      <div className="text-6xl mb-3">
                        {winner === "human" ? "🏆" : winner === "ai" ? "💀" : "⚖️"}
                      </div>
                      <div className={`text-2xl font-bold ${
                        winner === "human" ? "text-emerald-300" :
                        winner === "ai"    ? "text-red-300" : "text-white/70"
                      }`}>
                        {winner === "human" ? "Victory!" : winner === "ai" ? "Defeated" : "Draw"}
                      </div>
                      <button
                        type="button"
                        onClick={() => sendMessage("New game — invent a completely different one.")}
                        className="mt-4 pointer-events-auto rounded-xl bg-violet-500/80 hover:bg-violet-400 px-5 py-2 text-sm font-semibold transition"
                      >
                        Play Again →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Move toast */}
              <AnimatePresence>
                {moveToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.9 }}
                    className={`absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-mono border ${
                      moveToast.ok
                        ? "bg-emerald-900/80 border-emerald-400/40 text-emerald-300"
                        : "bg-red-900/80 border-red-400/40 text-red-300"
                    } shadow-xl backdrop-blur-sm`}
                  >
                    {moveToast.ok ? "✓ " : "✗ "}{moveToast.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: rules + history ── */}
            <div className="w-72 shrink-0 border-l border-white/5 bg-black/20 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <RulesPanel
                  gameName={gameName}
                  tagline={tagline}
                  rules={rules}
                  explanation={explanation}
                  victoryCondition={victoryCondition}
                  flavor={flavor}
                  phase={phase}
                />

                {/* Move history */}
                {history.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.35em] text-white/25 mb-2 flex items-center gap-2">
                      <span>battle log</span>
                      <span className="text-white/15">({history.length} moves)</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {history.slice(-10).map((h, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-start gap-2 text-[11px] rounded-lg px-2 py-1.5 ${
                            h.player === "ai"
                              ? "bg-violet-500/8 border border-violet-500/10"
                              : "bg-emerald-500/8 border border-emerald-500/10"
                          }`}
                        >
                          <span className={`shrink-0 text-[9px] font-mono uppercase tracking-wider mt-0.5 ${
                            h.player === "ai" ? "text-violet-400" : "text-emerald-400"
                          }`}>
                            {h.player === "ai" ? "AI" : "You"}
                          </span>
                          <span className="text-white/50 font-mono">
                            {h.move?.id ?? h.move?.label ?? "—"}
                          </span>
                          {h.player === "ai" && h.reasoning && (
                            <span className="text-violet-300/40 text-[10px] italic truncate" title={h.reasoning}>
                              {h.reasoning.slice(0, 30)}…
                            </span>
                          )}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI reasoning */}
                {aiReasoning && !winner && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.35em] text-violet-400/40 mb-1.5">oracle logic</div>
                    <div className="text-[11px] text-violet-200/60 italic leading-relaxed border-l-2 border-violet-500/20 pl-2.5">
                      {aiReasoning}
                    </div>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="shrink-0 p-3 border-t border-white/5">
                <div className="flex gap-2 items-end rounded-xl border border-white/8 bg-white/[0.025] p-2
                  focus-within:border-violet-400/50 focus-within:ring-1 focus-within:ring-violet-400/20 transition">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={
                      battleMode ? "Battle mode active — watching AI play…" :
                      turn === "human" && !winner ? "Type 'B3' or click a cell on the board…" :
                      winner ? "Say 'new game' for another round!" :
                      "Tell the agent what to do…"
                    }
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-1 py-1 text-[12px] text-white placeholder:text-white/20 focus:outline-none min-h-[32px]"
                  />
                  <button
                    type="button"
                    disabled={!draft.trim() || running || battleMode}
                    onClick={() => sendMessage(draft)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow transition hover:bg-violet-400 disabled:bg-white/8 disabled:text-white/20 disabled:cursor-not-allowed"
                    aria-label="Send"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 11l5-5 5 5" /><path d="M12 6v13" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Idle / splash screen ──────────────────────────────────────────────────────

function IdleScreen({ onStart, onArcade, running }: { onStart: () => void; onArcade: () => void; running: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="text-[9px] uppercase tracking-[0.5em] text-white/20 mb-4">Game Lab</div>
        <h1 className="bg-gradient-to-br from-white via-white/85 to-white/30 bg-clip-text text-6xl font-black text-transparent leading-[1.05] tracking-tight">
          Playtest what<br />doesn&apos;t exist yet.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm text-white/40 leading-relaxed">
          A multi-agent lab where Chronicler, Arbiter, and Oracle forge an original
          strategy game, validate the rules, battle you, and turn the result into a
          concise playable artifact.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex flex-col items-center gap-5"
      >
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: "⚗", label: "Chronicler", sub: "invents the rules" },
            { icon: "⚖", label: "Arbiter",    sub: "validates logic" },
            { icon: "☯", label: "Oracle",     sub: "plays to win" },
          ].map((a) => (
            <div key={a.label} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
              <span className="text-xl">{a.icon}</span>
              <div className="text-left">
                <div className="text-xs font-medium text-white/70">{a.label}</div>
                <div className="text-[10px] text-white/30">{a.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <motion.button
          type="button"
          disabled={running}
          onClick={onStart}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 px-10 py-4 text-sm font-bold text-white shadow-2xl shadow-violet-900/60 transition hover:from-violet-400 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⚙</motion.span>
              Forging game…
            </span>
          ) : (
            "Forge strategy board →"
          )}
        </motion.button>
        <button
          type="button"
          onClick={onArcade}
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80 transition hover:bg-cyan-300/15 hover:text-cyan-50"
        >
          AI vs Human arcade
        </button>
        <div className="max-w-lg text-xs leading-relaxed text-white/32">
          Choose the strategy board for generated multi-agent games, or Arcade for a real-time AI-vs-human runner.
        </div>
      </motion.div>
    </div>
  );
}

// ── Phase animation while agents work ────────────────────────────────────────

function PhaseAnimation({ phase, flavor }: { phase: string; flavor: Record<string, string | number> }) {
  const stages: Record<string, { msgs: string[]; icon: string }> = {
    inventing: {
      icon: "⚗",
      msgs: [
        `Chronicler is forging a ${flavor.theme || "novel"} game…`,
        `Designing ${flavor.size ?? 5}×${flavor.size ?? 5} battlefield…`,
        `Writing novel rules for ${flavor.mechanic || "unique"} mechanics…`,
        "Choosing visual identity…",
      ],
    },
    validating: {
      icon: "⚖",
      msgs: [
        "Arbiter is stress-testing the rules…",
        "Checking for infinite loops…",
        "Verifying fairness and playability…",
        "Polishing rule language…",
      ],
    },
    explaining: {
      icon: "✦",
      msgs: ["Rules validated ✓", "Preparing your battlefield…", "Ready!"],
    },
  };

  const { msgs, icon } = stages[phase] ?? { msgs: ["Thinking…"], icon: "·" };
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((v) => (v + 1) % msgs.length), 2000);
    return () => clearInterval(t);
  }, [msgs.length]);

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="text-4xl opacity-60"
      >
        {icon}
      </motion.div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-violet-400"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="text-sm text-white/40 text-center max-w-xs"
        >
          {msgs[idx]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
