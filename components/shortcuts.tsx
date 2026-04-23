"use client";

/**
 * Shortcuts — global keyboard bindings.
 *
 *   ⌘K / Ctrl+K   focus the command input
 *   /             focus the command input (when not in a text field)
 *   Esc           close any open rail
 *   ⌘/ / Ctrl+/   toggle the chat rail
 *   ⌘B / Ctrl+B   toggle the sessions rail
 *   ⌘\ / Ctrl+\   start/stop voice input
 *
 * We attach a single keydown listener on `window` and dispatch via CustomEvent
 * so components anywhere in the tree can react without prop drilling.
 */

import { useEffect } from "react";

export type MorphboardShortcut =
  | "focus-input"
  | "close-all"
  | "toggle-chat"
  | "toggle-sessions"
  | "toggle-voice";

export const SHORTCUT_EVENT = "morphboard:shortcut";

export function dispatchShortcut(kind: MorphboardShortcut): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MorphboardShortcut>(SHORTCUT_EVENT, { detail: kind }));
}

export function useShortcut(kind: MorphboardShortcut, handler: () => void): void {
  useEffect(() => {
    const onEv = (e: Event) => {
      const detail = (e as CustomEvent<MorphboardShortcut>).detail;
      if (detail === kind) handler();
    };
    window.addEventListener(SHORTCUT_EVENT, onEv);
    return () => window.removeEventListener(SHORTCUT_EVENT, onEv);
  }, [kind, handler]);
}

export default function Shortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inEditable =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatchShortcut("focus-input");
        return;
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        dispatchShortcut("toggle-chat");
        return;
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        dispatchShortcut("toggle-sessions");
        return;
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        dispatchShortcut("toggle-voice");
        return;
      }
      if (e.key === "Escape") {
        dispatchShortcut("close-all");
        return;
      }
      if (e.key === "/" && !inEditable) {
        e.preventDefault();
        dispatchShortcut("focus-input");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
