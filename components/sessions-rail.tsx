"use client";

/**
 * SessionsRail — left-side history panel. Wraps ThreadSwitcher with a
 * slide-in/out motion container and an aria-labelled region.
 */

import { AnimatePresence, motion } from "framer-motion";
import ThreadSwitcher from "./thread-switcher";
import type { LocalThread } from "@/lib/thread-store";

export default function SessionsRail({
  open,
  onClose,
  activeThreadId,
  onSelect,
  onNew,
}: {
  open: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  onSelect: (id: string, thread?: LocalThread) => void;
  onNew: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="sessions"
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          role="complementary"
          aria-label="Session history"
          className="fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-[280px] border-r border-white/5 bg-gradient-to-b from-black/80 via-black/70 to-black/80 backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">history</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sessions"
              className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              ✕
            </button>
          </div>
          <ThreadSwitcher
            activeThreadId={activeThreadId}
            onSelect={onSelect}
            onNew={onNew}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
