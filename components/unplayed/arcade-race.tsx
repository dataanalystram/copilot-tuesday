"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Runner {
  y: number;
  vy: number;
  score: number;
  hits: number;
  health: number;
  invincible: number;
}

interface Obstacle {
  id: number;
  x: number;
  lane: "human" | "ai";
  w: number;
  passedHuman?: boolean;
  passedAi?: boolean;
}

interface SimState {
  human: Runner;
  ai: Runner;
  obstacles: Obstacle[];
  lastInput: string;
  aiDecision: string;
  started: boolean;
}

const JUMP = 14.8;
const GRAVITY = 0.66;
const SPEED = 4.2;
const RUNNER_X = 132;
const HIT_LOW = RUNNER_X - 6;
const HIT_HIGH = RUNNER_X + 34;
const JUMP_BUFFER_FRAMES = 14;
const COYOTE_HEIGHT = 28;

function runner(): Runner {
  return { y: 0, vy: 0, score: 0, hits: 0, health: 100, invincible: 0 };
}

function nextObstacle(id: number, lane: "human" | "ai", x = 820): Obstacle {
  return { id, lane, x, w: 26 + Math.random() * 20 };
}

function initialState(): SimState {
  return {
    human: runner(),
    ai: runner(),
    obstacles: [nextObstacle(1, "human", 620), nextObstacle(2, "ai", 720)],
    lastInput: "click or press Space to start",
    aiDecision: "waiting for human",
    started: false,
  };
}

export function ArcadeRace({ onExit }: { onExit: () => void }) {
  const [sim, setSim] = useState<SimState>(() => initialState());
  const [paused, setPaused] = useState(false);
  const frame = useRef<number | null>(null);
  const ids = useRef(3);
  const jumpBuffer = useRef(0);
  const stateRef = useRef(sim);

  useEffect(() => {
    stateRef.current = sim;
  }, [sim]);

  const queueJump = useCallback(() => {
    jumpBuffer.current = JUMP_BUFFER_FRAMES;
    setSim((state) => ({
      ...state,
      started: true,
      lastInput: state.human.y < 8 ? "human jump queued" : "already airborne",
      aiDecision: state.started ? state.aiDecision : "race started",
    }));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        queueJump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueJump]);

  useEffect(() => {
    if (paused) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(2.2, (now - previous) / 16.67);
      previous = now;
      const buffered = jumpBuffer.current > 0;
      jumpBuffer.current = Math.max(0, jumpBuffer.current - 1);
      setSim((current) => (current.started ? step(current, dt, buffered) : current));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [paused]);

  const humanNet = sim.human.score;
  const aiNet = sim.ai.score;
  const leader = humanNet > aiNet ? "Human" : aiNet > humanNet ? "AI" : "Tied";

  return (
    <div className="absolute inset-0 flex flex-col bg-[#05070d] text-white">
      <div className="flex items-center gap-3 border-b border-white/8 bg-black/45 px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-cyan-300" />
        <span className="text-[10px] uppercase tracking-[0.28em] text-white/45">AI vs Human arcade</span>
        <div className="flex-1" />
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">leader: {leader}</span>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/8 hover:text-white"
        >
          {paused ? "resume" : "pause"}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/8 hover:text-white"
        >
          lab
        </button>
      </div>

      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          queueJump();
        }}
        className="relative flex-1 overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label="Jump human runner"
      >
        <div className="absolute left-5 top-5 grid grid-cols-4 gap-3">
          <ScoreCard label="Human" score={humanNet} detail={`health ${sim.human.health} · hits ${sim.human.hits}`} tone="cyan" />
          <ScoreCard label="AI" score={aiNet} detail={`health ${sim.ai.health} · hits ${sim.ai.hits}`} tone="violet" />
          <ScoreCard label="Input" score={sim.lastInput} detail="human control" tone="emerald" />
          <ScoreCard label="AI decision" score={sim.aiDecision} detail="live policy" tone="amber" />
        </div>

        <Lane
          label="Human"
          y={sim.human.y}
          runner="H"
          obstacles={sim.obstacles.filter((item) => item.lane === "human")}
          color="cyan"
          status={sim.human.invincible > 0 ? "recovering" : "manual"}
        />
        <Lane
          label="AI"
          y={sim.ai.y}
          runner="AI"
          obstacles={sim.obstacles.filter((item) => item.lane === "ai")}
          color="violet"
          status={sim.aiDecision}
          offset
        />

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/55">
          {sim.started ? "Click anywhere or press Space to jump. The AI predicts obstacle distance and jumps before impact." : "Click anywhere or press Space to start. Nothing moves until you begin."}
        </div>
      </button>
    </div>
  );

  function step(current: SimState, dt: number, humanJump: boolean): SimState {
    let obstacles = current.obstacles
      .map((item) => ({ ...item, x: item.x - SPEED * dt }))
      .filter((item) => item.x > -90);

    for (const lane of ["human", "ai"] as const) {
      if (!obstacles.some((item) => item.lane === lane && item.x > 430)) {
        obstacles.push(nextObstacle(ids.current++, lane, 720 + Math.random() * 220));
      }
    }

    const humanCanJump = humanJump && current.human.y < COYOTE_HEIGHT;
    const human = stepRunner(current.human, humanCanJump);
    const aiThreat = nearestThreat(obstacles, "ai");
    const aiShouldJump = !!aiThreat && aiThreat.x < 286 && aiThreat.x > RUNNER_X - 6 && current.ai.y < 18;
    const ai = stepRunner(current.ai, aiShouldJump);

    const humanHit = collides(human, obstacles, "human");
    const aiHit = collides(ai, obstacles, "ai");

    const nextHuman = scoreRunner(markPasses(human, obstacles, "human"), humanHit);
    const nextAi = scoreRunner(markPasses(ai, obstacles, "ai"), aiHit);

    obstacles = obstacles.map((item) => ({
      ...item,
      passedHuman: item.passedHuman || (item.lane === "human" && item.x < RUNNER_X - 20),
      passedAi: item.passedAi || (item.lane === "ai" && item.x < RUNNER_X - 20),
    }));

    return {
      human: nextHuman,
      ai: nextAi,
      obstacles,
      lastInput: humanCanJump ? "human jump registered" : humanJump ? "jump buffered" : current.lastInput,
      aiDecision: aiShouldJump
        ? `jump at ${Math.round(aiThreat?.x ?? 0)}px`
        : aiThreat
          ? `wait ${Math.round(aiThreat.x)}px`
          : "clear lane",
      started: current.started,
    };
  }
}

function stepRunner(input: Runner, jump: boolean): Runner {
  let vy = input.vy;
  let y = input.y;
  if (jump && y < COYOTE_HEIGHT) vy = JUMP;
  y = Math.max(0, y + vy);
  vy = y <= 0 && vy < 0 ? 0 : vy - GRAVITY;
  return {
    ...input,
    y,
    vy,
    score: input.score + 1,
    invincible: Math.max(0, input.invincible - 1),
  };
}

function nearestThreat(obstacles: Obstacle[], lane: "human" | "ai") {
  return obstacles
    .filter((item) => item.lane === lane && item.x > RUNNER_X - 20)
    .sort((a, b) => a.x - b.x)[0];
}

function collides(runnerState: Runner, obstacles: Obstacle[], lane: "human" | "ai") {
  if (runnerState.invincible > 0 || runnerState.y > 42) return false;
  return obstacles.some((item) => item.lane === lane && item.x < HIT_HIGH && item.x + item.w > HIT_LOW);
}

function markPasses(runnerState: Runner, obstacles: Obstacle[], lane: "human" | "ai") {
  const passed = obstacles.some((item) => {
    const already = lane === "human" ? item.passedHuman : item.passedAi;
    return item.lane === lane && !already && item.x < RUNNER_X - 20;
  });
  return passed ? { ...runnerState, score: runnerState.score + 80 } : runnerState;
}

function scoreRunner(runnerState: Runner, hit: boolean): Runner {
  return hit
    ? {
        ...runnerState,
        hits: runnerState.hits + 1,
        health: Math.max(0, runnerState.health - 12),
        invincible: 64,
        y: Math.max(runnerState.y, 54),
        vy: Math.max(runnerState.vy, 7),
      }
    : runnerState;
}

function ScoreCard({
  label,
  score,
  detail,
  tone,
}: {
  label: string;
  score: string | number;
  detail: string;
  tone: "cyan" | "violet" | "emerald" | "amber";
}) {
  const classes = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-100",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };
  return (
    <div className={`min-w-[150px] rounded-lg border px-3 py-2 ${classes[tone]}`}>
      <div className="text-[9px] uppercase tracking-[0.25em] opacity-55">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold" title={String(score)}>{score}</div>
      <div className="text-[10px] opacity-55">{detail}</div>
    </div>
  );
}

function Lane({
  label,
  y,
  runner,
  obstacles,
  color,
  status,
  offset = false,
}: {
  label: string;
  y: number;
  runner: string;
  obstacles: Obstacle[];
  color: "cyan" | "violet";
  status: string;
  offset?: boolean;
}) {
  const top = offset ? "top-[56%]" : "top-[31%]";
  const colorClass = color === "cyan" ? "bg-cyan-300 text-cyan-950 shadow-cyan-300/40" : "bg-violet-300 text-violet-950 shadow-violet-300/40";
  return (
    <div className={`absolute left-0 right-0 ${top} h-36`}>
      <div className="absolute left-6 top-1 flex items-center gap-4 text-[10px] uppercase tracking-[0.25em] text-white/30">
        <span>{label}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] tracking-normal text-white/45">{status}</span>
      </div>
      <div className="absolute bottom-[108px] left-0 right-0 border-t border-dashed border-white/10" />
      <div
        className={`absolute bottom-[108px] flex h-12 w-12 items-center justify-center rounded-xl font-black shadow-2xl ${colorClass}`}
        style={{ left: RUNNER_X, transform: `translate3d(0, ${-y}px, 0)` }}
      >
        {runner}
      </div>
      {obstacles.map((item) => (
        <motion.div
          key={item.id}
          className="absolute bottom-[108px] h-11 rounded-t-md bg-rose-400/90 shadow-lg shadow-rose-500/20"
          style={{ left: item.x, width: item.w }}
        />
      ))}
    </div>
  );
}
