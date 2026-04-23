"use client";

/**
 * AttachmentDropzone — drag CSV / JSON / image onto the canvas, the agent
 * ingests it, and often morphs a widget straight from the file.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts + @copilotkit/shared
 * attachments/types.d.cts on Apr 19, 2026:
 *
 *   interface AttachmentsConfig {
 *     enabled: boolean;
 *     accept?: string;
 *     maxSize?: number;                             // bytes, default 20MB
 *     onUpload?: (file: File) => AttachmentUploadResult | Promise<...>;
 *     onUploadFailed?: (error: AttachmentUploadError) => void;
 *   }
 *
 *   useAttachments({ config }) : {
 *     attachments, enabled, dragOver, fileInputRef, containerRef,
 *     processFiles, handleFileUpload, handleDragOver, handleDragLeave,
 *     handleDrop, removeAttachment, consumeAttachments
 *   }
 *
 * The attachment is uploaded to a data-URL (default behaviour when no
 * `onUpload` is given — the renderer embeds it as an `InputContentDataSource`
 * next time the user sends a message). For CSV / JSON we override `onUpload`
 * so the file is embedded as a string the model can reason over directly.
 */

import { useCallback, useEffect } from "react";
import { useAttachments } from "@copilotkit/react-core/v2";
import { motion, AnimatePresence } from "framer-motion";
import { textAttachmentStore } from "@/lib/attachment-store";

const ACCEPT = [
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".md",
  ".txt",
  "text/csv",
  "application/json",
  "text/plain",
  "image/*",
].join(",");

const ATTACHMENT_INPUT_ID = "morphboard-attachment-input";
const OPEN_ATTACHMENT_EVENT = "morphboard:open-attachment-picker";

async function readAsText(file: File): Promise<string> {
  return await file.text();
}

export default function AttachmentDropzone({ children }: { children: React.ReactNode }) {
  const onUpload = useCallback(async (file: File) => {
    // Text-ish files: embed contents directly so the agent can just read them.
    if (
      /\.(csv|tsv|json|jsonl|md|txt)$/i.test(file.name) ||
      file.type.startsWith("text/") ||
      file.type === "application/json"
    ) {
      const text = await readAsText(file);
      textAttachmentStore.add({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        filename: file.name,
        content: text,
        mimeType: file.type || "text/plain",
      });
      return {
        type: "data" as const,
        value: text,
        mimeType: file.type || "text/plain",
        metadata: { filename: file.name, size: file.size, kind: "text" },
      };
    }
    // Images → data URL (handled by default encoder, but we spell it out so
    // the model receives an explicit filename in metadata).
    const buf = await file.arrayBuffer();
    const b64 = typeof Buffer !== "undefined"
      ? Buffer.from(buf).toString("base64")
      : btoa(String.fromCharCode(...new Uint8Array(buf)));
    return {
      type: "data" as const,
      value: `data:${file.type};base64,${b64}`,
      mimeType: file.type,
      metadata: { filename: file.name, size: file.size, kind: "binary" },
    };
  }, []);

  const {
    attachments,
    dragOver,
    containerRef,
    fileInputRef,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeAttachment,
  } = useAttachments({
    config: {
      enabled: true,
      accept: ACCEPT,
      maxSize: 20 * 1024 * 1024,
      onUpload,
      onUploadFailed: (err) => {
        console.warn("[attachments]", err.reason, err.file.name, err.message);
      },
    },
  });

  const openPicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, [fileInputRef]);

  useEffect(() => {
    window.addEventListener(OPEN_ATTACHMENT_EVENT, openPicker);
    return () => window.removeEventListener(OPEN_ATTACHMENT_EVENT, openPicker);
  }, [openPicker]);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative h-full w-full"
    >
      {/* Native file input — visually hidden, but still clickable from toolbar buttons. */}
      <input
        id={ATTACHMENT_INPUT_ID}
        data-morphboard-attachment-input="true"
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleFileUpload}
        className="fixed -left-[9999px] top-0 h-px w-px opacity-0"
        tabIndex={-1}
        aria-hidden
      />

      {children}

      <AnimatePresence>
        {dragOver && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-violet-900/20 backdrop-blur-md"
          >
            <div className="rounded-2xl border-2 border-dashed border-violet-300/70 bg-violet-500/10 px-10 py-8 text-center">
              <div className="text-xs uppercase tracking-[0.35em] text-violet-200/80">drop to ingest</div>
              <div className="mt-2 text-2xl font-medium text-white">
                CSV · JSON · Markdown · Image
              </div>
              <div className="mt-1 text-sm text-violet-100/80">
                the agent will build a widget from it
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chips shown bottom-left when attachments are staged. */}
      {attachments.length > 0 && (
        <div className="pointer-events-auto fixed bottom-28 left-6 z-40 flex flex-col gap-2">
          {attachments.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/80 backdrop-blur"
            >
              <span className="text-violet-300">◎</span>
              <span className="max-w-[200px] truncate">{a.filename ?? "attachment"}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${a.status === "ready" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              <button
                type="button"
                aria-label={`Remove ${a.filename ?? "attachment"}`}
                onClick={() => {
                  removeAttachment(a.id);
                  if (a.filename) textAttachmentStore.removeByFilename(a.filename);
                }}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AttachButton — a small paperclip button you can drop into the toolbar.
 * It triggers the hidden file input in the dropzone via a custom event
 * (so the button can live in a different part of the tree).
 */
export function AttachButton({ className }: { className?: string }) {
  const onClick = () => {
    const input =
      document.getElementById(ATTACHMENT_INPUT_ID) as HTMLInputElement | null
      ?? document.querySelector<HTMLInputElement>(
        '[data-morphboard-attachment-input="true"]',
      );

    if (input) {
      input.value = "";
      input.click();
      return;
    }

    window.dispatchEvent(new CustomEvent(OPEN_ATTACHMENT_EVENT));
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Attach file"
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-violet-400/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m21 12-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />
      </svg>
    </button>
  );
}
