"use client";

/**
 * Dev inspector — tiny floating dot that mounts CopilotKit's built-in
 * inspector (tools, messages, state, tool-call traces) for debugging.
 *
 * VERIFIED against @copilotkit/react-core@1.56.2 .d.cts on Apr 19, 2026:
 *
 *   type Anchor = { horizontal: "left"|"right"; vertical: "top"|"bottom" };
 *   declare const CopilotKitInspector: React.FC<CopilotKitInspectorProps>;
 *   interface CopilotKitInspectorProps {
 *     core?: CopilotKitCore | null;
 *     defaultAnchor?: Anchor;
 *   }
 *
 * We omit `core` — when not provided, the inspector reads the current
 * CopilotKitCore out of context automatically. Gated behind NODE_ENV !==
 * "production" OR a `?inspect=1` query param so it never ships by accident.
 */

import { useEffect, useState } from "react";
import { CopilotKitInspector, useCopilotKit } from "@copilotkit/react-core/v2";

export default function InspectorToggle() {
  const [enabled, setEnabled] = useState(false);
  const { copilotkit } = useCopilotKit();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const forced = url.searchParams.get("inspect");
    setEnabled(process.env.NODE_ENV !== "production" || forced === "1");
  }, []);

  if (!enabled || !copilotkit) return null;

  return (
    <CopilotKitInspector
      core={copilotkit}
      defaultAnchor={{ horizontal: "right", vertical: "bottom" }}
    />
  );
}
