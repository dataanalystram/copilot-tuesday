import type { MCPClientConfig } from "@ag-ui/mcp-apps-middleware";

export type RuntimeMcpAppServer = MCPClientConfig & {
  agentId?: string;
};

export interface RuntimeMcpAppsConfig {
  servers: RuntimeMcpAppServer[];
}

const EXCALIDRAW_SERVER: RuntimeMcpAppServer = {
  type: "http",
  url: "https://mcp.excalidraw.com/mcp",
  serverId: "excalidraw",
  agentId: "default",
};

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function isServer(value: unknown): value is RuntimeMcpAppServer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RuntimeMcpAppServer>;
  return (
    (candidate.type === "http" || candidate.type === "sse") &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0
  );
}

function parseMcpAppServers(raw: string | undefined): RuntimeMcpAppServer[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter(isServer);
  } catch {
    return raw
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url, index) => ({
        type: "http" as const,
        url,
        serverId: `mcp-app-${index + 1}`,
        agentId: "default",
      }));
  }
}

export function getMcpAppsConfig(): RuntimeMcpAppsConfig | undefined {
  const servers = parseMcpAppServers(process.env.MCP_APP_SERVERS);

  if (boolEnv(process.env.MCP_APPS_ENABLE_EXCALIDRAW_DEMO, true)) {
    servers.unshift(EXCALIDRAW_SERVER);
  }

  const unique = Array.from(
    new Map(servers.map((server) => [server.serverId ?? server.url, server])).values(),
  );

  return unique.length ? { servers: unique } : undefined;
}
