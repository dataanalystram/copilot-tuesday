# Product Requirements Document: MorphBoard Studio

## 1. Product Summary

MorphBoard Studio is an AI-powered canvas where users can ask for analysis, dashboards, diagrams, data transformations, and visual artifacts in natural language. The agent uses CopilotKit to control the frontend, call backend tools, render React components, request approval, and update the workspace live.

The product is built around one core idea: the assistant should not only talk about an answer; it should build the workspace needed to act on that answer.

## 2. Target Users

- Builders preparing demos, product walkthroughs, or technical explanations
- Data analysts who want fast dashboards from CSV/TSV/JSON files
- Product and strategy teams researching companies, markets, and technology trends
- Engineers reviewing repositories, architecture, and implementation risks
- Creators who want a flexible AI canvas for charts, diagrams, media, and written artifacts

## 3. Problem

Most AI chat products produce long text answers and leave the user to manually turn that answer into charts, decks, dashboards, diagrams, or implementation plans.

Existing dashboard builders often require the user to know the schema, chart type, query shape, and layout upfront. They also rarely support follow-up edits such as "change the selected card to a pie chart using the same data" or "aggregate this by month before charting it."

## 4. Product Goals

MorphBoard should:

1. Convert natural language into useful visual artifacts.
2. Let the agent update the actual frontend through CopilotKit tools.
3. Support data-backed dashboards, not only random/generated placeholders.
4. Let users upload datasets and ask for cleaning, grouping, aggregation, and chart conversion.
5. Support online research and source-backed dashboards.
6. Render open-ended diagrams through MCP Apps.
7. Support human approval for destructive or finalizing changes.
8. Preserve the workspace as a canvas with sessions, not just a transcript.
9. Keep the Studio model local and affordable through Ollama/Qwen.

## 5. Non-Goals

- Build a full BI platform with SQL warehouse connectors in the initial version.
- Build a custom MCP App server in the initial version.
- Depend on paid hosted models for the core Studio flow.
- Replace professional notebook environments for deep data science.
- Generate image assets without a configured image generation backend.

## 6. Core User Stories

### Dashboard Creation

As a user, I can ask for "two widgets" or "a dashboard about global EV market trends" and see cards appear on the canvas.

Acceptance criteria:

- The app creates visible widgets without requiring manual setup.
- Each widget has clear labels, titles, and hover tooltips where relevant.
- The agent can choose charts based on the user request.

### Selected Widget Editing

As a user, I can click a widget and ask the agent to change only that widget.

Acceptance criteria:

- Selected widgets have a visible highlight and label.
- The agent can morph the selected widget into another supported type.
- Reverts restore the previous surface state.

### Dataset Analysis

As a user, I can upload CSV/TSV/JSON and ask the agent to clean, aggregate, or visualize it.

Acceptance criteria:

- Python/Pandas runs locally through `python_data_transform`.
- Dates, numerics, and categories are inferred.
- Aggregations use computed values, not hallucinated values.
- The frontend receives transformed chart data through `/api/data/latest`.
- The canvas updates one artifact at a time.

### Online Research

As a user, I can ask for a dashboard on a broad topic and the agent can research online.

Acceptance criteria:

- `web_research_topic` returns sources, metrics, categories, and timeline items.
- The frontend renders source-backed KPIs, charts, timeline, and source table.
- GitHub tools are used only when the user asks about a GitHub repo.

### MCP App Diagramming

As a user, I can ask for a diagram or storyboard and get an Excalidraw MCP App surface.

Acceptance criteria:

- MCP Apps are configured through runtime config.
- Excalidraw is enabled by default.
- The agent can create or update a diagram using MCP App tools.

### Human Approval

As a user, I can approve or reject important changes.

Acceptance criteria:

- Human-in-the-loop cards render inside the assistant experience.
- Approval can be used before destructive changes or final plan approval.
- The agent resumes after the user responds.

## 7. Feature Requirements

### 7.1 Studio Canvas

- 12-column responsive artifact grid
- Widget cards with stable dimensions
- Add/update/remove surfaces
- Selected widget highlight
- Undo/revert support
- Export/share controls
- Empty/loading/progress states

### 7.2 CopilotKit Runtime

- CopilotKit runtime endpoint at `/api/copilotkit`
- Local Ollama model through OpenAI-compatible provider
- Frontend tool catalog
- Server-side tool catalog
- MCP Apps server config
- Excalidraw MCP App default server

### 7.3 Data Tools

- `python_data_profile`
- `python_data_transform`
- `/api/data/transform`
- `/api/data/latest`
- Transform result cache
- Surface mapper for transform outputs

### 7.4 Research Tools

- `web_research_topic`
- `web_fetch_url`
- `/api/research/latest`
- Research result cache
- Surface mapper for research outputs

### 7.5 GitHub Tools

- Repo stats
- Contributors
- Issues
- Commit heatmap
- Star trend
- Project file tree/read tools for local implementation evidence

### 7.6 Widgets

- KPI
- BarChart
- LineChart
- PieChart
- ScatterPlot
- DataTable
- Timeline
- Markdown
- Heatmap
- Contributors
- Issues
- Globe
- MediaCard

### 7.7 Game Lab

- Secondary tab
- AI-vs-human arcade interaction
- Human click/Space control
- AI status/decision panel
- Score and hit tracking

## 8. Technical Architecture

Frontend:

- Next.js App Router
- React 19
- CopilotKit React Core
- Framer Motion
- Tailwind CSS
- Three.js

Backend:

- Next.js route handlers
- CopilotKit runtime v2
- Local Ollama model through `@ai-sdk/openai-compatible`
- Python 3 subprocess for Pandas transforms
- GitHub REST APIs
- Web fetch/research helpers

Agent/UI bridge:

- `useFrontendTool` for UI mutation
- `useComponent` for renderable widgets
- `useAgent` for shared state
- `surfacesStore` for synchronous canvas state
- Polling sync for backend research/data results

## 9. Success Metrics

- User can create a dashboard from a plain-language prompt in under 10 seconds for local/random data.
- User can upload a small CSV and get a computed dashboard without editing code.
- User can ask for a chart conversion and preserve the underlying data.
- User can understand which widget is selected.
- User can see tool activity while the agent works.
- User can approve or reject meaningful changes.
- Build, lint, and typecheck pass.

## 10. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Local LLM does not reliably call tools | Add deterministic local command handling and tighter system prompt |
| Uploaded CSV has messy values | Python transform coerces numerics, parses dates, and returns notes |
| Agent creates chat text but no UI | Frontend polling bridges backend tool results into canvas updates |
| Browser/IAB test bridge is unstable | Keep backend API smoke tests and production build verification |
| Arbitrary media URLs break Next image optimization | `MediaCard` uses `next/image` with `unoptimized` |
| GitHub rate limits | Optional `GITHUB_TOKEN` |

## 11. Roadmap

### Near Term

- Add direct local transform routing from attachment commands when the model misses the tool call.
- Improve chart editing for selected widgets with stronger source-data preservation.
- Add richer chart controls: horizontal bar, stacked bar, area chart, histogram.
- Add PPT/export flow from current canvas surfaces.
- Add image generation backend integration for generated media cards.

### Later

- Persistent database-backed workspaces.
- Authenticated team sharing.
- Custom MCP App server for MorphBoard-native artifacts.
- SQL connectors and warehouse integrations.
- Notebook-style Python code review panel.
- Multi-step report/deck generation.

## 12. Positioning

MorphBoard is a CopilotKit-powered AI canvas. It demonstrates how a frontend can become agentic when the assistant has access to UI tools, state, components, MCP Apps, backend data tools, and human approval.

The product is not "chat with widgets." It is a workspace that the agent can build, inspect, revise, and explain.

