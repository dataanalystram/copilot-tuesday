"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RulesPanelProps {
  gameName: string;
  tagline: string;
  rules: string[];
  explanation: string;
  victoryCondition: string;
  flavor: Record<string, string | number>;
  phase: string;
}

const FLAVOR_ICONS: Record<string, string> = {
  "territorial-capture"    : "🗺",
  "chain-reaction cascade" : "⚡",
  "racing-advance"         : "🏁",
  "bridge-building"        : "🌉",
  "encirclement siege"     : "⚔",
  "element-conversion"     : "🔄",
  "displacement combat"    : "💥",
  "line-of-sight control"  : "👁",
  "sacrifice gambit"       : "♟",
  "flood-fill spread"      : "🌊",
  "sentinel defense"       : "🛡",
  "orbital swap"           : "🔀",
  "trap-and-spring"        : "🪤",
  "resource harvesting"    : "⛏",
  "mirror reflection"      : "🪞",
};

export function RulesPanel({
  gameName,
  tagline,
  rules,
  explanation,
  victoryCondition,
  flavor,
  phase,
}: RulesPanelProps) {
  const isInventing  = phase === "inventing";
  const isValidating = phase === "validating";
  const mechIcon     = FLAVOR_ICONS[flavor.mechanic as string] ?? "⚙";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Game identity ── */}
      <div>
        <div className="text-[8px] uppercase tracking-[0.4em] text-white/20 mb-1.5">game</div>

        <AnimatePresence mode="wait">
          {gameName ? (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-black text-white leading-tight tracking-tight">
                {gameName}
              </h2>
              {tagline && (
                <p className="mt-1 text-[11px] text-white/45 italic leading-relaxed">
                  {tagline}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div key="loading" className="flex items-center gap-2">
              <div className="h-5 w-32 rounded bg-white/5 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flavor badges */}
        {Object.keys(flavor).length > 0 && !isInventing && !isValidating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 flex flex-wrap gap-1"
          >
            {flavor.mechanic && (
              <Badge icon={mechIcon} label={flavor.mechanic as string} variant="purple" />
            )}
            {flavor.theme && (
              <Badge label={flavor.theme as string} variant="slate" />
            )}
            {flavor.size && (
              <Badge label={`${flavor.size}×${flavor.size}`} variant="slate" />
            )}
          </motion.div>
        )}
      </div>

      {/* ── How to play ── */}
      {explanation && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl bg-white/[0.03] border border-white/6 p-3"
        >
          <div className="text-[8px] uppercase tracking-[0.4em] text-white/20 mb-1.5">how to play</div>
          <p className="text-[11px] text-white/60 leading-relaxed">{explanation}</p>
        </motion.div>
      )}

      {/* ── Victory condition ── */}
      {victoryCondition && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-amber-500/20 bg-amber-900/10 p-3"
        >
          <div className="text-[8px] uppercase tracking-[0.4em] text-amber-400/50 mb-1.5 flex items-center gap-1.5">
            <span>🏆</span> victory
          </div>
          <p className="text-[11px] text-amber-200/70 leading-relaxed">{victoryCondition}</p>
        </motion.div>
      )}

      {/* ── Rules ── */}
      {(rules.length > 0 || isInventing || isValidating) && (
        <div>
          <div className="text-[8px] uppercase tracking-[0.4em] text-white/20 mb-2">rules</div>
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence>
              {rules.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2.5 group"
                >
                  <span className="shrink-0 mt-0.5 h-4 w-4 flex items-center justify-center rounded-md bg-violet-500/15 text-[9px] text-violet-400 font-mono font-bold">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-white/65 leading-relaxed group-hover:text-white/85 transition">
                    {rule}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>

            {(isInventing || isValidating) && rules.length === 0 && (
              <li className="flex flex-col gap-2">
                {[0.7, 1, 0.8].map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="shrink-0 h-4 w-4 rounded-md bg-white/5 animate-pulse" />
                    <div className={`h-3 rounded bg-white/5 animate-pulse`} style={{ width: `${w * 100}%` }} />
                  </div>
                ))}
                <p className="text-[10px] text-white/25 italic mt-1">
                  {isValidating ? "Arbiter is validating…" : "Chronicler is writing rules…"}
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Badge({ icon, label, variant }: { icon?: string; label: string; variant: "purple" | "slate" }) {
  const cls = variant === "purple"
    ? "border-violet-500/20 bg-violet-500/8 text-violet-300/70"
    : "border-white/8 bg-white/[0.03] text-white/40";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] rounded-full border px-2 py-0.5 ${cls}`}>
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}
