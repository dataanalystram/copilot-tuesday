"use client";
import { motion } from "framer-motion";

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string; // "+12.3%"
  trend?: "up" | "down" | "flat";
  hint?: string;
}

export function KpiCard({ label, value, delta, trend = "flat", hint }: KpiCardProps) {
  const trendColor =
    trend === "up" ? "text-emerald-300" : trend === "down" ? "text-rose-300" : "text-white/50";
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "■";
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="text-[11px] uppercase tracking-widest text-white/50">{label}</div>
      <motion.div
        key={String(value)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-semibold text-white tabular-nums"
      >
        {value}
      </motion.div>
      <div className="flex items-center gap-2 text-xs">
        {delta && <span className={trendColor}>{arrow} {delta}</span>}
        {hint && <span className="text-white/40">{hint}</span>}
      </div>
    </div>
  );
}
