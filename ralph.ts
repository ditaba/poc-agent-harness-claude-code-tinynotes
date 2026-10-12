// Helpers for ralph.sh, run from the repo root with Bun:
//   bun ralph.ts next                                   → "<id>\t<effort>", ALL_DONE or NONE_AVAILABLE
//   bun ralph.ts context <id>                           → the task's prompt context (markdown)
//   bun ralph.ts result <json> <iteration> <id> <effort> → logs token usage, prints Claude's final message
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

type Task = {
  id: string;
  milestone: string;
  description: string;
  spec: string[];
  dependsOn: string[];
  acceptance: string[];
  verify: string[];
  passes: boolean;
  blocked?: string;
  effort?: string;
};

type Heading = { line: number; end: number; level: number; text: string };

type ClaudeResult = {
  result?: string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  };
};

const PRD = "prd.json";
const SPEC = "SPEC.md";
const PROGRESS = "agent-progress.txt";
const USAGE = ".ralph/usage.csv";
const USAGE_HEADER =
  "time,iteration,task,effort,turns,duration_ms,input,cache_creation,cache_read,output,cost_usd";

// D37, R1, NOTE-7 and ranges such as NOTE-7..NOTE-11.
const ID_PATTERN =
  /(?<![\w-])(?:[DR]\d+|(?:AUTH|NOTE|SHARE|PUB|MSG|NAV)-\d+(?:\.\.(?:AUTH|NOTE|SHARE|PUB|MSG|NAV)-\d+)?)(?![\w-])/g;

function readLines(path: string): string[] {
  return existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
}

function loadTasks(): Task[] {
  return JSON.parse(readFileSync(PRD, "utf8")) as Task[];
}

// The id must stand alone, so "D4" doesn't match "D40" and "M4-save" doesn't match "M4-save-errors".
function standalone(id: string): RegExp {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`);
}

function next(): string {
  const tasks = loadTasks();
  const passed = new Set(tasks.filter((t) => t.passes).map((t) => t.id));
  if (passed.size === tasks.length) return "ALL_DONE";
  const task = tasks.find(
    (t) => !t.passes && !t.blocked && t.dependsOn.every((d) => passed.has(d)),
  );
  return task ? `${task.id}\t${task.effort ?? ""}` : "NONE_AVAILABLE";
}

function specHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  lines.forEach((text, i) => {
    if (text.startsWith("```")) inFence = !inFence;
    const match = inFence ? null : /^(#{1,6}) /.exec(text);
    if (match) {
      headings.push({
        line: i + 1,
        end: lines.length,
        level: match[1].length,
        text,
      });
    }
  });
  // A section ends just before the next heading of the same or a higher level.
  headings.forEach((heading, i) => {
    const after = headings.slice(i + 1).find((h) => h.level <= heading.level);
    if (after) heading.end = after.line - 1;
  });
  return headings;
}

function referencedIds(task: Task): string[] {
  const text = [...task.spec, ...task.acceptance, ...task.verify].join("\n");
  const ids = new Set<string>();
  for (const [ref] of text.matchAll(ID_PATTERN)) {
    const range = /^([A-Z]+)-(\d+)\.\.\1-(\d+)$/.exec(ref);
    if (!range) {
      ids.add(ref);
      continue;
    }
    for (let n = Number(range[2]); n <= Number(range[3]); n++)
      ids.add(`${range[1]}-${n}`);
  }
  return [...ids];
}

// Decisions and risks are table rows ("| D37 |"), requirements are bullets ("- **NOTE-7**").
function definitionIndex(lines: string[], id: string): number {
  const row = new RegExp(`^\\|\\s*${id}\\s*\\|`);
  const bullet = new RegExp(`^- \\*\\*${id}\\*\\*`);
  return lines.findIndex((line) => row.test(line) || bullet.test(line));
}

// The "Codebase patterns" section plus every entry whose heading names one of the ids.
function progressEntries(ids: string[]): string[] {
  const patterns = ids.map(standalone);
  const kept: string[] = [];
  let keep = false;
  for (const line of readLines(PROGRESS)) {
    if (line.startsWith("## ")) {
      const title = line.slice(3);
      keep =
        /^Codebase patterns/i.test(title) ||
        patterns.some((p) => p.test(title));
    }
    if (keep) kept.push(line);
  }
  return kept;
}

function context(id: string): string {
  const task = loadTasks().find((t) => t.id === id);
  if (!task) throw new Error(`Unknown task: ${id}`);
  const spec = readLines(SPEC);
  const headings = specHeadings(spec);

  const index = headings
    .filter((h) => h.level <= 3)
    .map((h) => `L${h.line}-${h.end} ${h.text}`);

  const found: { index: number; id: string }[] = [];
  const missing: string[] = [];
  for (const ref of referencedIds(task)) {
    const i = definitionIndex(spec, ref);
    if (i === -1) missing.push(ref);
    else found.push({ index: i, id: ref });
  }
  const idLines = found
    .sort((a, b) => a.index - b.index)
    .map(({ index: i }) => `L${i + 1}: ${spec[i]}`);
  if (missing.length > 0)
    idLines.push(
      `(not found as a definition, Grep for them: ${missing.join(", ")})`,
    );

  const milestone = headings.find((h) =>
    h.text.startsWith(`### ${task.milestone} `),
  );
  const milestoneLines = milestone
    ? spec.slice(milestone.line - 1, milestone.end)
    : [];

  const progress = progressEntries([task.id, ...task.dependsOn]);

  return [
    "### Task JSON (prd.json)",
    "```json",
    JSON.stringify({ ...task, passes: undefined }, null, 2),
    "```",
    "",
    "### SPEC.md index (read sections with Read offset/limit, or Grep)",
    ...index,
    "",
    "### SPEC.md lines for the IDs this task names",
    ...idLines,
    "",
    milestone
      ? `### SPEC.md milestone (L${milestone.line}-${milestone.end})`
      : "### SPEC.md milestone: not found",
    ...milestoneLines,
    "",
    "### agent-progress.txt: Codebase patterns, plus entries for this task and its dependsOn",
    ...(progress.length > 0 ? progress : ["(none yet)"]),
  ].join("\n");
}

function result(
  jsonPath: string,
  iteration: string,
  taskId: string,
  effort: string,
): string {
  const output = JSON.parse(readFileSync(jsonPath, "utf8")) as ClaudeResult;
  const usage = output.usage ?? {};
  const row = [
    new Date().toISOString(),
    iteration,
    taskId,
    effort,
    output.num_turns,
    output.duration_ms,
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens,
    usage.output_tokens,
    output.total_cost_usd,
  ]
    .map((value) => value ?? "")
    .join(",");
  mkdirSync(".ralph", { recursive: true });
  if (!existsSync(USAGE)) appendFileSync(USAGE, `${USAGE_HEADER}\n`);
  appendFileSync(USAGE, `${row}\n`);
  return output.result ?? "";
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "next":
    console.log(next());
    break;
  case "context":
    console.log(context(args[0]));
    break;
  case "result":
    console.log(result(args[0], args[1], args[2], args[3]));
    break;
  default:
    console.error(
      "Usage: bun ralph.ts next | context <id> | result <json> <iteration> <id> <effort>",
    );
    process.exit(1);
}
