"use client";

import { motion, AnimatePresence } from "framer-motion";

export interface BoardCell {
  value: "" | "ai" | "human" | string;
  label: string;
  special?: string;
}

export interface BoardData {
  cells: Record<string, BoardCell>;
  size: number;
  topology: string;
}

interface GameBoardProps {
  board: BoardData;
  legalMoves: Array<{ id: string; label: string }>;
  turn: string;
  onPickMove: (id: string) => void;
  winner: string;
  pieceIconHuman?: string;
  pieceIconAi?: string;
  boardPalette?: string;
  pendingCell?: string | null;
  lastMoveCell?: string | null;
}

// ── Palette system ────────────────────────────────────────────────────────────

const PALETTES: Record<string, {
  wrapper: string;
  border: string;
  cell: string;
  legal: string;
  humanPiece: string;
  aiPiece: string;
  lastMove: string;
  pending: string;
  label: string;
}> = {
  fire: {
    wrapper   : "bg-gradient-to-br from-red-950/95 via-orange-950/90 to-red-900/95",
    border    : "border-orange-500/25",
    cell      : "bg-orange-950/60 border-orange-500/20 hover:bg-orange-900/70 hover:border-orange-400/40",
    legal     : "bg-orange-900/50 border-orange-400/60 ring-1 ring-orange-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]",
    lastMove  : "ring-2 ring-amber-400/90 shadow-[0_0_16px_rgba(251,191,36,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-orange-400/40",
  },
  ice: {
    wrapper   : "bg-gradient-to-br from-slate-950/95 via-cyan-950/90 to-blue-950/95",
    border    : "border-cyan-500/25",
    cell      : "bg-cyan-950/60 border-cyan-500/20 hover:bg-cyan-900/70 hover:border-cyan-400/40",
    legal     : "bg-cyan-900/50 border-cyan-400/60 ring-1 ring-cyan-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(59,130,246,0.9)]",
    lastMove  : "ring-2 ring-cyan-300/90 shadow-[0_0_16px_rgba(34,211,238,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-cyan-400/40",
  },
  forest: {
    wrapper   : "bg-gradient-to-br from-emerald-950/95 via-green-950/90 to-teal-950/95",
    border    : "border-emerald-500/25",
    cell      : "bg-green-950/60 border-emerald-500/20 hover:bg-green-900/70 hover:border-emerald-400/40",
    legal     : "bg-emerald-900/50 border-emerald-400/60 ring-1 ring-emerald-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(16,185,129,0.9)]",
    lastMove  : "ring-2 ring-lime-400/90 shadow-[0_0_16px_rgba(163,230,53,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-emerald-400/40",
  },
  void: {
    wrapper   : "bg-gradient-to-br from-slate-950/95 via-violet-950/90 to-purple-950/95",
    border    : "border-violet-500/25",
    cell      : "bg-violet-950/60 border-violet-500/20 hover:bg-violet-900/70 hover:border-violet-400/40",
    legal     : "bg-violet-900/50 border-violet-400/60 ring-1 ring-violet-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(167,139,250,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]",
    lastMove  : "ring-2 ring-violet-300/90 shadow-[0_0_16px_rgba(167,139,250,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-violet-400/40",
  },
  gold: {
    wrapper   : "bg-gradient-to-br from-amber-950/95 via-yellow-950/90 to-orange-950/95",
    border    : "border-amber-500/25",
    cell      : "bg-amber-950/60 border-amber-500/20 hover:bg-amber-900/70 hover:border-amber-400/40",
    legal     : "bg-amber-900/50 border-amber-400/60 ring-1 ring-amber-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]",
    lastMove  : "ring-2 ring-yellow-300/90 shadow-[0_0_16px_rgba(253,224,71,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-amber-400/40",
  },
  cyber: {
    wrapper   : "bg-gradient-to-br from-slate-950/98 via-slate-900/95 to-cyan-950/80",
    border    : "border-cyan-400/20",
    cell      : "bg-slate-900/70 border-cyan-400/15 hover:bg-slate-800/80 hover:border-cyan-400/40",
    legal     : "bg-cyan-950/60 border-cyan-400/60 ring-1 ring-cyan-400/60",
    humanPiece: "drop-shadow-[0_0_12px_rgba(34,211,238,1)]",
    aiPiece   : "drop-shadow-[0_0_12px_rgba(139,92,246,1)]",
    lastMove  : "ring-2 ring-cyan-400/90 shadow-[0_0_20px_rgba(34,211,238,0.6)]",
    pending   : "ring-2 ring-cyan-300/80 bg-cyan-950/40 scale-95",
    label     : "text-cyan-400/30 font-mono",
  },
  blood: {
    wrapper   : "bg-gradient-to-br from-red-950/98 via-rose-950/95 to-red-900/90",
    border    : "border-red-500/25",
    cell      : "bg-rose-950/60 border-red-500/20 hover:bg-rose-900/70 hover:border-red-400/40",
    legal     : "bg-red-900/50 border-red-400/60 ring-1 ring-red-400/50",
    humanPiece: "drop-shadow-[0_0_10px_rgba(248,113,113,0.9)]",
    aiPiece   : "drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]",
    lastMove  : "ring-2 ring-red-300/90 shadow-[0_0_16px_rgba(252,165,165,0.5)]",
    pending   : "ring-2 ring-white/80 bg-white/10 scale-95",
    label     : "text-red-400/40",
  },
  neon: {
    wrapper   : "bg-gradient-to-br from-black/99 via-fuchsia-950/60 to-black/95",
    border    : "border-fuchsia-500/25",
    cell      : "bg-black/70 border-fuchsia-500/15 hover:bg-fuchsia-950/50 hover:border-fuchsia-400/40",
    legal     : "bg-fuchsia-950/50 border-fuchsia-400/60 ring-1 ring-fuchsia-400/60",
    humanPiece: "drop-shadow-[0_0_12px_rgba(240,171,252,1)]",
    aiPiece   : "drop-shadow-[0_0_12px_rgba(167,139,250,1)]",
    lastMove  : "ring-2 ring-fuchsia-400/90 shadow-[0_0_20px_rgba(240,171,252,0.6)]",
    pending   : "ring-2 ring-fuchsia-300/80 bg-fuchsia-950/40 scale-95",
    label     : "text-fuchsia-400/30",
  },
};

const DEFAULT_PALETTE = PALETTES.void;

export function GameBoard({
  board,
  legalMoves,
  turn,
  onPickMove,
  winner,
  pieceIconHuman = "⚡",
  pieceIconAi    = "☯",
  boardPalette   = "void",
  pendingCell    = null,
  lastMoveCell   = null,
}: GameBoardProps) {
  const size      = board?.size ?? 5;
  const cells     = board?.cells ?? {};
  const legalSet  = new Set(legalMoves.map((m) => m.id));
  const isHumanTurn = turn === "human" && !winner;
  const palette   = PALETTES[boardPalette] ?? DEFAULT_PALETTE;

  const cellIds: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 1; c <= size; c++) {
      cellIds.push(`${String.fromCharCode(65 + r)}${c}`);
    }
  }

  return (
    <div className={`w-full h-full flex flex-col gap-3 rounded-2xl p-4 border ${palette.wrapper} ${palette.border} shadow-2xl`}>
      {/* Turn banner */}
      <div className="shrink-0 flex items-center justify-between px-1">
        <PlayerTag icon={pieceIconAi} label="Oracle" active={turn === "ai"} side="left" />
        <div className={`text-[11px] font-mono uppercase tracking-[0.2em] transition-all ${
          winner
            ? winner === "human" ? "text-emerald-300 font-bold" : winner === "ai" ? "text-violet-300 font-bold" : "text-white/60"
            : turn === "human" ? "text-emerald-300 animate-pulse" : "text-violet-300/70"
        }`}>
          {winner
            ? winner === "human" ? "⚔ Victory" : winner === "ai" ? "☠ Defeated" : "⚖ Draw"
            : turn === "human" ? "← Your move" : "AI thinking…"}
        </div>
        <PlayerTag icon={pieceIconHuman} label="You" active={turn === "human"} side="right" />
      </div>

      {/* Board grid */}
      <div
        className="flex-1 min-h-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows   : `repeat(${size}, minmax(0, 1fr))`,
          gap: "5px",
        }}
      >
        <AnimatePresence>
          {cellIds.map((cid, i) => {
            const cell        = cells[cid] ?? { value: "", label: cid };
            const val         = cell.value ?? "";
            const isLegal     = legalSet.has(cid) && isHumanTurn;
            const isPending   = pendingCell === cid;
            const isLastMove  = lastMoveCell === cid && !isPending;

            let cellClass = `relative flex items-center justify-center rounded-xl border
              text-xs font-mono transition-all duration-200 cursor-default select-none
              ${palette.cell}`;

            if (isPending) {
              cellClass += ` ${palette.pending} transition-transform duration-100`;
            } else if (isLastMove) {
              cellClass += ` ${palette.lastMove}`;
            } else if (isLegal) {
              cellClass += ` ${palette.legal} cursor-pointer hover:scale-105`;
            }

            return (
              <motion.button
                key={cid}
                type="button"
                disabled={!isLegal || !!winner}
                onClick={() => isLegal && onPickMove(cid)}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: isPending ? 0.93 : 1 }}
                transition={{ delay: i * 0.006, type: "spring", stiffness: 320, damping: 26 }}
                className={cellClass}
                aria-label={`Cell ${cid}${val ? ` — ${val}` : isLegal ? " — click to play" : ""}`}
              >
                {/* Piece */}
                {val === "ai" && (
                  <Piece icon={pieceIconAi} glow={palette.aiPiece} />
                )}
                {val === "human" && (
                  <Piece icon={pieceIconHuman} glow={palette.humanPiece} />
                )}

                {/* Pending shimmer */}
                {isPending && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-white/20"
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                )}

                {/* Legal move pulse */}
                {isLegal && !val && !isPending && (
                  <motion.span
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ boxShadow: ["0 0 0px 0px rgba(167,139,250,0)", "0 0 8px 2px rgba(167,139,250,0.4)", "0 0 0px 0px rgba(167,139,250,0)"] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                )}

                {/* Cell label when empty */}
                {!val && !isPending && (
                  <span className={`text-[9px] font-mono pointer-events-none ${isLegal ? "text-white/30" : `${palette.label}`}`}>
                    {cid}
                  </span>
                )}

                {/* Last-move indicator dot */}
                {isLastMove && (
                  <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Row/col legend */}
      <div className="shrink-0 flex justify-between px-1">
        <div className="flex gap-1">
          {Array.from({ length: size }, (_, i) => (
            <span key={i} className="text-[9px] text-white/15 font-mono"
              style={{ width: `${100 / size}%`, minWidth: 20, textAlign: "center" }}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 ml-1">
          {Array.from({ length: size }, (_, i) => (
            <span key={i} className="text-[9px] text-white/15 font-mono leading-none">
              {String.fromCharCode(65 + i)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Piece({ icon, glow }: { icon: string; glow: string }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`text-2xl leading-none select-none pointer-events-none ${glow}`}
    >
      {icon}
    </motion.div>
  );
}

function PlayerTag({ icon, label, active, side }: {
  icon: string; label: string; active: boolean; side: "left" | "right";
}) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] transition-all ${
      active ? "text-white opacity-100" : "text-white/30 opacity-60"
    } ${side === "right" ? "flex-row-reverse" : ""}`}>
      <motion.span
        className="text-base leading-none"
        animate={active ? { scale: [1, 1.2, 1] } : { scale: 1 }}
        transition={active ? { duration: 1.2, repeat: Infinity } : {}}
      >
        {icon}
      </motion.span>
      <span className="font-mono uppercase tracking-widest text-[9px]">{label}</span>
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
    </div>
  );
}
