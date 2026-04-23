"use client";

import { useEffect, useState } from "react";

export interface TextAttachment {
  id: string;
  filename: string;
  content: string;
  mimeType: string;
}

let current: TextAttachment[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const textAttachmentStore = {
  get: () => current,
  set: (next: TextAttachment[]) => {
    current = next;
    emit();
  },
  add: (attachment: TextAttachment) => {
    current = [...current.filter((item) => item.id !== attachment.id), attachment];
    emit();
  },
  remove: (id: string) => {
    current = current.filter((item) => item.id !== id);
    emit();
  },
  removeByFilename: (filename: string) => {
    current = current.filter((item) => item.filename !== filename);
    emit();
  },
  clear: () => {
    current = [];
    emit();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useTextAttachments() {
  const [attachments, setAttachments] = useState(textAttachmentStore.get());
  useEffect(() => {
    setAttachments(textAttachmentStore.get());
    return textAttachmentStore.subscribe(() => setAttachments(textAttachmentStore.get()));
  }, []);
  return attachments;
}
