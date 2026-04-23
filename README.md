# MorphBoard Studio

MorphBoard Studio is an AI-native analysis canvas built with **CopilotKit**, **A2UI**, **MCP Apps**, **Next.js**, and a local **Ollama/Qwen** model. It turns a normal user request into a living workspace: dashboards, charts, source boards, Python data analysis, diagrams, approvals, and editable canvas artifacts.

Instead of treating chat as the product, MorphBoard uses chat as the control plane. The real output is the canvas.

## What It Does

MorphBoard lets a user ask for analysis in plain English and then watches an agent build the UI around the task.

Examples:

```text
Create two widgets with random revenue data.
Research global EV market trends and create a dashboard.
Aggregate this CSV by month and change the chart to a pie chart.
Read this repo and build an implementation evidence board.
Create an Excalidraw architecture diagram for this product.
Show an approval card before replacing the dashboard.
Put this GIF or image URL on the canvas.
```

The app supports:

- Live dashboard creation from user prompts
- Widget selection and targeted morphing
- CSV/TSV/JSON upload and Python/Pandas analysis
- Date parsing, numeric coercion, grouping, aggregation, and chart conversion
- Online topic research with source-backed dashboard surfaces
- GitHub repo analysis tools for stars, issues, contributors, commit activity, and file inspection
- Excalidraw MCP App integration for open-ended diagramming
- Human-in-the-loop approval cards
- Tool-call chips so users can see what the agent is doing
- Persistent threads, surface snapshots, export/share controls, voice input, and keyboard shortcuts
- Game Lab, a secondary AI-vs-human arcade surface that demonstrates interactive state beyond dashboards

## Why CopilotKit

MorphBoard is designed to show what CopilotKit is strongest at: not just answering a prompt, but letting an agent control a real application.

CopilotKit powers the core workflow:

- `CopilotKit` provider connects the frontend to the runtime.
- `BuiltInAgent` runs the default Studio agent.
- `useAgent` keeps shared state for theme, selection, stage, brief, scorecard, and script beats.
- `useFrontendTool` gives the agent real UI actions such as `morph_surface`, `set_theme`, `pin_insight`, and `annotate_surface`.
- `useComponent` registers rich React widgets so the agent can render structured UI instead of plain text.
- `useRenderTool` displays live tool activity in the interface.
- `useHumanInTheLoop` renders approval flows inside the assistant experience.
- `useInterrupt` supports pause/resume interaction.
- `useAgentContext` injects app state back into the agent.
- `useSuggestions` and `useConfigureSuggestions` provide useful next-step prompts.
- MCP Apps support lets MorphBoard render external interactive app surfaces such as Excalidraw.
- A2UI rendering lets the assistant generate declarative UI artifacts alongside normal React widgets.

The result is a practical agentic UI pattern: user intent -> agent reasoning -> tool calls -> live application state -> visual artifacts.

## Tech Stack

| Layer | Technology |
| --- | --- |
| App framework | Next.js 16 App Router |
| UI runtime | React 19 |
| Agent UI | CopilotKit 1.56.2 |
| Generative UI | A2UI renderer, CopilotKit components, frontend tools |
| MCP Apps | `@ag-ui/mcp-apps-middleware`, Excalidraw MCP App |
| LLM provider | Ollama via `@ai-sdk/openai-compatible` |
| Default model | `qwen2.5:14b` |
| Data analyst | Local Python 3 + Pandas script execution |
| Validation | Zod |
| Motion | Framer Motion |
| 3D visuals | Three.js |
| Styling | Tailwind CSS 4 |
| Language | TypeScript |

## Core Product Surfaces

### Studio

Studio is the main agentic workspace. It can create and edit:

- KPI cards
- Bar charts
- Line charts
- Pie charts
- Scatter plots
- Data tables
- Timelines
- Markdown analysis cards
- Media cards for image/GIF URLs
- GitHub evidence widgets
- Source boards
- Excalidraw diagrams
- Approval cards

The key interaction is **morphing**. A user can ask for a dashboard, click a widget, then ask for a targeted change like:

```text
Change this selected widget to a pie chart.
Make only this card show average sales instead of total sales.
Revert the last change.
```

### Data Analyst Mode

When the user uploads CSV, TSV, or JSON, MorphBoard can run a local Python/Pandas transformation through the `python_data_transform` tool.

It can:

- Clean column names
- Coerce numeric strings
- Parse date columns
- Detect numeric, category, and date fields
- Aggregate by day, week, month, year, or category
- Sum, average, count, min, or max values
- Return chart-ready data
- Update the frontend canvas from the actual transformed result

This means requests such as `aggregate sales by month and region as a line chart` produce computed rows, not placeholder visuals.

### Research Mode

For broad topics, markets, companies, technologies, and world events, the agent can use `web_research_topic` to gather sources and generate:

- Research progress surface
- KPI summary cards
- Signal bar chart
- Signal mix pie chart
- Source timeline
- Source table
- Summary card

The frontend stages the widgets one by one so the workspace visibly assembles as results arrive.

### MCP App Diagramming

MorphBoard includes MCP Apps runtime wiring and defaults to the public Excalidraw MCP App server:

```text
https://mcp.excalidraw.com/mcp
```

That gives the agent an open-ended visual surface for architecture maps, flows, storyboards, diagrams, and whiteboard-style artifacts.

### Game Lab

Game Lab is the second tab. It demonstrates that the same CopilotKit-driven app can host an interactive stateful experience, not only dashboards.

The current Game Lab shows:

- AI-vs-human arcade race
- Human input from click/Space
- AI decision/status panel
- Score and hit tracking
- Polished stateful UI separate from the Studio dashboard canvas

## Architecture

```text
Browser
├─ app/page.tsx
│  └─ CopilotKit provider, AppShell, Studio canvas, rails, sync helpers
├─ components/
│  ├─ canvas.tsx                  fullscreen artifact grid
│  ├─ chat-rail.tsx               custom CopilotKit agent chat rail
│  ├─ command-bar.tsx             always-on prompt composer
│  ├─ frontend-tools.tsx          agent-callable UI tools
│  ├─ widget-registry.tsx         useComponent registrations
│  ├─ research-sync.tsx           polls backend research results into canvas
│  ├─ data-transform-sync.tsx     polls Python transform results into canvas
│  └─ widgets/*                   rich UI components
├─ lib/
│  ├─ prompts.ts                  Studio system prompt and component catalog
│  ├─ project-tools.ts            GitHub, web, Python data tools
│  ├─ research-cache.ts           latest research/transform bridge
│  ├─ surfaces-store.ts           synchronous client canvas state
│  ├─ instant-dashboard.ts        deterministic local dashboard commands
│  ├─ data-transform-surfaces.ts  Python result -> dashboard surfaces
│  └─ mcp-apps.ts                 MCP Apps server config
└─ app/api/
   ├─ copilotkit/[[...catchall]]  CopilotKit runtime endpoint
   ├─ data/transform              direct Python transform endpoint
   ├─ data/latest                 latest transform result for frontend sync
   └─ research/latest             latest research result for frontend sync
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Run Ollama

```bash
ollama serve
ollama pull qwen2.5:14b
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Default local settings:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
OLLAMA_API_KEY=ollama
MCP_APPS_ENABLE_EXCALIDRAW_DEMO=true
NEXT_PUBLIC_DEFAULT_REPO=vercel/next.js
```

Optional:

```dotenv
GITHUB_TOKEN=...
MCP_APP_SERVERS=...
```

### 4. Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
npm run probe:ollama
npm run probe:a2ui
npx tsc --noEmit
npm run lint
npm run build
```

Direct data-transform smoke test:

```bash
curl -sS -X POST http://localhost:3000/api/data/transform \
  -H 'content-type: application/json' \
  --data '{
    "filename":"sales.csv",
    "task":"aggregate sales by month and region as a line chart",
    "content":"date,region,sales,units\n2026-01-01,US,100,4\n2026-01-15,US,120,5\n2026-02-01,EU,200,9\n2026-02-20,EU,240,10\n"
  }'
```

Expected shape:

```json
{
  "rows": 4,
  "groupBy": ["period", "region"],
  "valueColumn": "sales",
  "chartType": "LineChart",
  "chartData": [
    { "period": "2026-01", "region": "US", "sales": 220, "label": "2026-01 / US", "value": 220 },
    { "period": "2026-02", "region": "EU", "sales": 440, "label": "2026-02 / EU", "value": 440 }
  ]
}
```

## Useful Prompts

```text
Create four widgets with realistic SaaS revenue data.
```

```text
Research global EV market trends and create a dashboard with sources, KPIs, a pie chart, and a timeline.
```

```text
I uploaded a CSV. Clean it, aggregate revenue by month, and create a line chart plus preview table.
```

```text
Change the selected widget to a pie chart using the same underlying data.
```

```text
Read this app's implementation and create an evidence board for the most important files.
```

```text
Create an Excalidraw architecture diagram for how the agent, frontend tools, MCP Apps, and Python analyst fit together.
```

## Product Direction

MorphBoard is a general AI canvas for builders, analysts, and product teams. The strongest version is not a dashboard generator. It is an agentic workspace where the assistant can:

1. Understand the user's goal.
2. Gather evidence through tools.
3. Transform data locally when needed.
4. Render visual artifacts.
5. Let the user select and edit specific artifacts.
6. Ask for approval before destructive changes.
7. Preserve useful outputs as a workspace, not a chat transcript.

That is the product thesis: **CopilotKit makes the frontend agentic, and MorphBoard turns that into a real working canvas.**

