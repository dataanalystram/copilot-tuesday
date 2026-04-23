"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { GameShell } from "@/components/unplayed/game-shell";

export default function UnplayedPage() {
  return (
    <CopilotKit
      runtimeUrl="/api/unplayed"
      agent="unplayed"
    >
      <main className="relative h-screen w-screen overflow-hidden bg-[#0b0613] text-white">
        <GameShell agentId="unplayed" />
      </main>
    </CopilotKit>
  );
}
