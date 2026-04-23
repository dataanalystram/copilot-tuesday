/**
 * Minimal GitHub REST client.
 *
 * Public endpoints only; a GITHUB_TOKEN env var is optional and raises rate
 * limits from 60/hr to 5000/hr. All functions are tool-shaped so the agent
 * can call them via useFrontendTool / a server tool.
 */

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "morphboard",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: headers(), next: { revalidate: 60 } });
  if (!r.ok) throw new Error(`GitHub ${r.status} on ${path}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export type RepoStats = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  pushed_at: string;
};

export function getRepo(repo: string) {
  return gh<RepoStats>(`/repos/${repo}`);
}

export type Contributor = { login: string; contributions: number };
export function getContributors(repo: string, limit = 10) {
  return gh<Contributor[]>(`/repos/${repo}/contributors?per_page=${limit}`);
}

export type Issue = {
  number: number; title: string; state: "open" | "closed";
  user: { login: string }; created_at: string; pull_request?: unknown;
};
export async function getIssues(repo: string, state: "open" | "closed" | "all" = "open", limit = 10) {
  const list = await gh<Issue[]>(`/repos/${repo}/issues?state=${state}&per_page=${limit}`);
  const now = Date.now();
  return list
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      author: i.user?.login ?? "unknown",
      ageDays: Math.max(0, Math.round((now - Date.parse(i.created_at)) / 86400000)),
    }));
}

export type CommitActivity = { total: number; week: number; days: number[] };
export async function getCommitActivity(repo: string): Promise<number[][]> {
  // GitHub's stats endpoint: 52 weeks of 7-day arrays.
  // We slice to the last 12 weeks to prevent the model from generating massive JSON arrays
  // that lead to missing brace syntax errors.
  const list = await gh<CommitActivity[]>(`/repos/${repo}/stats/commit_activity`);
  const recent = list.slice(-12);
  const max = Math.max(1, ...recent.flatMap((w) => w.days));
  // Quantize 0..4 like GitHub's palette.
  return recent.map((w) => w.days.map((d) => Math.round((d / max) * 4)));
}

export type StarPoint = { x: string; y: number };
export async function getStarTrend(repo: string, months = 12): Promise<StarPoint[]> {
  // GitHub does not expose star history via REST efficiently. We approximate
  // using the current star count and the repo's age, producing a plausible
  // monotonic trend. For a real demo, swap in the community starchart.cc API
  // or run a one-time crawl of the stargazers endpoint with timestamps.
  // NOTE: This is clearly marked as approximated in the agent's prompt and
  // labeled in UI copy.
  const r = await getRepo(repo);
  const now = new Date();
  const total = r.stargazers_count;
  // growth curve shaped like a softened sqrt, more recent = more stars
  return Array.from({ length: months }, (_, i) => {
    const t = (i + 1) / months;
    return { x: monthLabel(now, months - 1 - i), y: Math.round(total * Math.pow(t, 0.65)) };
  });
}
function monthLabel(now: Date, offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}
