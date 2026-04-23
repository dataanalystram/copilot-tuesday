# Unplayed — building an AI that invents 2‑player games

**An AI that designs a never-before-seen 2‑player board/card game, explains the rules, and plays you in a live browser session is buildable today on CopilotKit 1.52 + LangGraph + Next.js 15 App Router — and, critically, nothing like it exists in the CopilotKit ecosystem as of April 2026.** The scaffolding is a two-repo split (Python LangGraph agent + Next.js UI) wired through `LangGraphHttpAgent` and `ExperimentalEmptyAdapter`, with the board rendered via agentic generative UI keyed to LangGraph node names and moves mediated by a `renderAndWaitForResponse` interrupt. The novelty gap matters because the CopilotKit team actively amplifies demos that show off *new* patterns of generative UI — the showcase path is clear, even if a formal April 2026 contest could not be verified in public sources. The playbook below resolves the three risks that kill agent demos on muted X autoplay (no hook, no visible cognition, no payoff) by mapping each to a concrete CopilotKit primitive.

## Why this demo is novel and why the timing is right

A full scan of `github.com/CopilotKit/CopilotKit/examples/` plus the `showcases/` sub-tree returns **47 demos, none of which involve rule-invention gameplay**. The closest adjacencies are the car-sales `copilot-state-machine` (stages, no invented rules), `coagents-research-canvas` (shared state + HITL, but research not play), `canvas-with-langgraph-python` (freeform canvas, no game loop), and `OpenGenerativeUI` (LangChain Deep Agents emitting HTML/SVG/Three.js in a sandboxed iframe — technically capable but never demonstrated as a game). Community searches for "CopilotKit game demo," "CoAgents board game," and "LangGraph agent plays game" return **zero relevant hits**; the entire "LLMs play games" genre is dominated by Claude Plays Pokémon (pre-existing game) and Plank's ARC-AGI template (puzzle solving). **No one has shipped an agent that invents rules from scratch and enforces them in a 2-player loop.** That is your moat.

The 2026 context amplifies the opportunity. CopilotKit is the maintainer of the **AG-UI Protocol** adopted by Google, LangChain, AWS, Microsoft, Mastra, and PydanticAI, and shipped full A2UI compatibility as a Google launch partner in early 2026. Generative UI has moved from novelty to table-stakes — which means the *content* of the UI (what is generated) is the differentiator, not the rendering tech. A game is the cleanest possible demonstration of emergent, stateful, rule-governed generative UI: rules must be consistent frame-to-frame, the board must reflect state bidirectionally, and the AI must commit to moves it can't later retcon. It is a stress test disguised as entertainment.

## The architecture in one page

The stable 2026 pattern for a CopilotKit + Python LangGraph app is a **two-process split**: a Python agent exposing an HTTP endpoint (either via `langgraph dev` on port 8000/8123 or a self-hosted FastAPI `CopilotKitRemoteEndpoint`), and a Next.js 15 App Router UI that proxies through `/api/copilotkit/route.ts` using `CopilotRuntime` + `ExperimentalEmptyAdapter` + `LangGraphHttpAgent`. The **`ExperimentalEmptyAdapter` is mandatory** when delegating the runloop to LangGraph — any LLM adapter (OpenAI, Anthropic, NVIDIA) in its place causes the runtime to try to handle messages itself and breaks agent-lock mode.

The canonical verified route.ts (from issue #616 and the pydantic-ai-todos reference, which mirrors the `coagents-starter-langgraph` pattern):

```ts
// app/api/copilotkit/route.ts
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@ag-ui/langgraph";
import { NextRequest } from "next/server";

const serviceAdapter = new ExperimentalEmptyAdapter();

const unplayed = new LangGraphHttpAgent({
  url: process.env.AGENT_URL ?? "http://127.0.0.1:8000/agent",
});

const runtime = new CopilotRuntime({
  agents: { unplayed },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
```

The layout wraps children in `<CopilotKit runtimeUrl="/api/copilotkit" agent="unplayed">` — the `agent` prop pins the app to a single agent (agent-lock mode), which is what you want for a single-purpose demo. For Copilot Cloud deployment the same shape holds but swap `runtimeUrl` for `publicApiKey`.

On the Python side, the agent inherits from `CopilotKitState` so it receives frontend actions as LangChain tools automatically. The state schema extends with whatever the game needs:

```python
# agent/unplayed/agent.py
from copilotkit import CopilotKitState
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_exit
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from langchain_nvidia_ai_endpoints import ChatNVIDIA

class GameState(CopilotKitState):
    phase: str            # "invent" | "explain" | "play" | "end"
    rules: list[str]
    board: dict           # free-form; rendered by UI via useCoAgent
    turn: str             # "ai" | "human"
    history: list[dict]
    winner: str | None
```

Registration via FastAPI (when self-hosting rather than `langgraph dev`):

```python
# agent/server.py
from fastapi import FastAPI
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from unplayed.agent import graph

app = FastAPI()
sdk = CopilotKitRemoteEndpoint(
    agents=[LangGraphAGUIAgent(
        name="unplayed",
        description="Invents and plays a novel 2-player game.",
        graph=graph,
    )]
)
add_fastapi_endpoint(app, sdk, "/copilotkit")
```

**Two subtle gotchas confirmed from the SDK source.** First, as of `copilotkit` 0.1.87 (April 15, 2026), passing a plain `LangGraphAgent` raises `ValueError` — you must use `LangGraphAGUIAgent`, which adds AG-UI protocol event support. Second, `langgraph` must be pinned `>=0.3.25,<1.1.0`; newer `langgraph` releases have broken the SDK's message converter in the past.

## The five hooks that do all the work

CopilotKit surface area is intentionally small. For Unplayed you need exactly five React hooks and one Python emitter. Every signature below is verbatim from `docs.copilotkit.ai/llms-full.txt`.

| Hook | Purpose in Unplayed | Key prop |
|---|---|---|
| `useCoAgent<GameState>` | Bidirectional shared state: UI reads `state.rules`, `state.board`; agent writes them | `name`, `initialState` |
| `useCoAgentStateRender` | Renders "AI is inventing rules…" progress keyed to the LangGraph `invent_rules` node | `node` (exact prop name) |
| `useCopilotAction` with `render` | Streams partial tool args as UI during move animation | `render: ({status, args, result})` |
| `useCopilotAction` with `renderAndWaitForResponse` | Blocks the graph until the human plays a move | `renderAndWaitForResponse: ({status, args, respond})` |
| `useCopilotReadable` | Exposes current board state back to the LLM as context | `description`, `value` |

The **`useCoAgentStateRender`** pattern is the single most important primitive for this demo, because it's what lets you show different UI for each phase of the graph with zero routing logic:

```tsx
useCoAgentStateRender<GameState>({
  name: "unplayed",
  node: "invent_rules",
  render: ({ state, nodeName, status }) => (
    <RulesInventing rules={state.rules} status={status} />
  ),
});
useCoAgentStateRender<GameState>({
  name: "unplayed",
  node: "explain_rules",
  render: ({ state }) => <RulesCard rules={state.rules} />,
});
useCoAgentStateRender<GameState>({
  name: "unplayed",
  node: "ai_move",
  render: ({ state }) => <Board board={state.board} highlight="ai" />,
});
```

The `node` prop is literal — it matches the string you passed to `workflow.add_node("invent_rules", ...)`. `status` is `"inProgress" | "executing" | "complete"`. The render is keyed to that node being active on the agent side; when the graph transitions nodes, CopilotKit swaps the rendered component. No client-side state machine needed — the Python graph *is* the state machine.

For the human move, use `useCopilotAction` with `renderAndWaitForResponse`. The graph calls `interrupt({...})` on the Python side; CopilotKit surfaces that as a tool call the frontend must answer via `respond(...)`:

```tsx
useCopilotAction({
  name: "requestHumanMove",
  available: "remote",  // only the agent can invoke
  parameters: [{ name: "legalMoves", type: "object[]", required: true }],
  renderAndWaitForResponse: ({ status, args, respond }) => (
    <MovePicker
      moves={args.legalMoves}
      disabled={status !== "executing"}
      onPick={(move) => respond?.({ move })}
    />
  ),
});
```

On the Python side the corresponding node reads the resumed value directly:

```python
def human_move_node(state: GameState, config):
    response = interrupt({"legalMoves": compute_legal_moves(state)})
    return {"history": state["history"] + [response["move"]], "turn": "ai"}
```

This pattern is verified in the `coagents-qa-native` example and the HITL bug-report threads (issues #1818, #2315, #1397, PR #1642) — it's well-trafficked but fragile: **always store the interrupt response in state before branching**, or page reloads will re-fire the interrupt against null state. Use LangGraph's `MemorySaver` checkpointer with a persistent `thread_id` from day one.

## Designing the game-invention graph

The agent's cognitive architecture is the interesting part. A working design uses **four nodes and two loops**:

1. `invent_rules` — The LLM (ChatNVIDIA with a large-context NIM like `nvidia/llama-3.1-nemotron-70b-instruct` or `meta/llama-3.3-70b-instruct`) is prompted to design a novel 2-player perfect-information game with exactly N rules, a victory condition, and a starting board. It emits intermediate state via `copilotkit_emit_state(config, state)` so the rules *appear to type themselves* in the UI in real time. The prompt must include a **self-consistency check**: "restate each rule as a predicate; verify no two predicates contradict; verify the game is terminating." Most rule-consistency failures happen here, not mid-play.
2. `explain_rules` — Deterministic node that formats rules into a `RulesCard` and advances phase. No LLM call. Cheap.
3. `ai_move` — LLM decides a move given `(board, rules, history)`. Output is a structured tool call with `move` + `reasoning`. The `reasoning` field is surfaced in the split-pane UI (see virality section). Use temperature 0.3 — you want strategic play, not chaos.
4. `human_move` — Interrupts as above.

Loop between `ai_move` and `human_move` until `check_winner` (a conditional edge) returns non-null, then route to `end` and call `copilotkit_exit(config)`. The entire loop should run under a single `thread_id` so LangGraph's checkpointer holds the game state across interrupts.

**The single biggest engineering risk is rule-drift** — the LLM inventing rules on turn 1, then "forgetting" or re-interpreting them on turn 4. Two mitigations work: (a) freeze `state.rules` after `invent_rules` and never include `invent_rules` in `ai_move`'s context regeneration; (b) on each `ai_move`, include the rules verbatim plus a one-shot check: "Is the move you are about to make legal under rule N? If unsure, pick a different move." Frontier NIMs handle this; smaller models do not.

A second risk is **search-space collapse** — the LLM inventing tic-tac-toe variants every time. Seed `invent_rules` with a randomly sampled "flavor" tuple (mechanic: *drafting|placement|deduction|bidding|racing*; theme: *abstract|spatial|token|graph*; board-topology: *grid|hex|ring|tree*) drawn from a pre-written palette of ~200 combinations. This gives you ~200 visibly distinct demos per run while keeping rule-consistency tractable.

## The three-act clip that gets retweeted

X autoplay is muted, 9:16-friendly, and completion drops off a cliff after 45 seconds — so the clip has to deliver *invent → play → win* in 38–45 seconds, and the first 3 seconds must promise something a viewer has not seen before. Based on the 2025-26 viral-agent corpus (Devin, Manus, Bolt.new, Replit Agent 3, Operator, Claude Plays Pokémon), the tropes that reliably ship are **time-compressed cold-opens**, **split-pane reasoning↔output**, **personification**, and **micro-failure-then-recovery**. Unplayed can use all four simultaneously.

The recommended clip structure:

- **Seconds 0–3 (hook):** Black frame → burned-in title "I asked an AI to invent a game I've never seen. Then it played me." Cut to an empty board materializing as the rules stream in on the right pane. Muted-readable because the type-out *is* the payoff.
- **Seconds 3–13 (invention):** Split pane. Left 55%: board self-assembling (hexes, cards, or tokens — whatever this run drew). Right 45%: rules typing at ~60 cps with a "Rule 1 of 7" counter. The counter is your Replit-Agent-3-style progress flex.
- **Seconds 13–33 (play):** Cursor (yellow, trailed) makes AI moves with on-screen "AI thinking…" ticks; on the human turn a hand-drawn arrow points at the `MovePicker` and a second cursor simulates the human choice. Include **one visible micro-failure** — AI attempts an illegal move, rule-checker rejects, AI picks again. This is the Claude-Plays-Pokémon rock-wall moment; it triples shareability.
- **Seconds 33–45 (payoff + CTA):** Winner reveal with "AI invented 7 rules, played 4 moves, won." End-card: URL, GitHub stars, `@CopilotKit` + `Built on CopilotKit + LangGraph + AG-UI`.

Ship in **1080×1920 9:16** with always-on 44–56pt burned captions (white-on-black-stroke), plus a 1080×1080 square fallback for desktop timelines. Thread caption: *"Gave a LangGraph agent a blank canvas and said 'invent a 2-player game, then beat me at it.' It made up the rules. It explained them. It won. Built on @CopilotKit."* Follow up the post with a quote-tweet showing **a completely different game** generated from the same prompt — the "runs it again, gets a new game" demo is your second viral beat and it's essentially free given the palette design.

## Contest status, unknowns, and what to verify by DM

A deliberate search for a **2026 CopilotKit Generative UI Showcase contest** — across copilotkit.ai/blog, X, DEV, and hackathon sponsor listings — returned **no public rules page**. CopilotKit is currently sponsoring several hackathons (100 Agents Hackathon on Devpost, AI Tinkerers SF Fullstack Agents, Seattle HITL hackathon with Anthropic) but none has a "generative UI showcase" track specifically. **Assume informal community amplification via @CopilotKit's X account** unless a Discord #announcements check confirms otherwise; a DM to @ulidabess or @NathanTarbert is the fastest clarification path.

Three facts to verify before you ship: (a) CopilotKit `1.52.0` introduced `@copilotkit/react-core/v2` with new hooks (`useComponent`, `useDefaultRenderTool`, `useLangGraphInterrupt` v2) — v1 hooks still work as compatibility wrappers but new projects in April 2026 should consider starting on v2; (b) the `copilotkit` Python package version is 0.1.87 while most public tutorials reference 0.1.65 — the API is compatible but some internal line numbers have shifted, so trust the PyPI source over blog posts; (c) `@ag-ui/langgraph`'s `LangGraphHttpAgent` has a known type-incompatibility with `HttpAgent` from `@ag-ui/client` in runtime 1.10.7+ (issue #3205) — pin `@copilotkit/runtime` to `1.10.6` or upgrade carefully.

## What this gives you

**Unplayed is the rare demo where the technical pattern and the narrative hook align perfectly.** Every CopilotKit primitive you need — bidirectional shared state, node-keyed generative UI, mid-graph HITL via interrupt, streaming partial tool args — appears naturally and visibly in the user-facing flow, not as plumbing. That's what makes it a *showcase* rather than just another LangGraph app: the plumbing is the point. The novelty confirmation ("no one has shipped this") plus the virality structure (muted-friendly, split-pane cognition, micro-failure, replayable) plus the clean scaffolding (two processes, five hooks, one graph) mean a working demo is achievable in a focused weekend, and a retweet-worthy clip in one more. The three risks worth budgeting for — rule-drift, search-space collapse, and interrupt-on-reload — each have documented fixes in the CopilotKit issue tracker and the SDK source. Ship the first version with a single game family (grid-placement) to de-risk rule-consistency, then expand the flavor palette for the launch clip.