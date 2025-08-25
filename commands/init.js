// commands/init.js
import fs from "fs";
import path from "path";
import chalk from "chalk";
import prompts from "prompts";
import { spawnSync } from "child_process";
import { banner, neonBox, divider, center } from "../utils/ui.js";
import { TOOLS } from "../utils/tools.js";

const ENV_FILE = ".env.gearz";
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

function binFromLabel(label) {
  // first token is the binary; handle labels like "curl (crt.sh)" or "python3 (LinkFinder)"
  return (label || "").split(" ")[0];
}
function binExists(bin) {
  const r = spawnSync("bash", ["-lc", `command -v ${bin} >/dev/null 2>&1 && echo OK || echo NO`], { encoding: "utf8" });
  return r.stdout.trim() === "OK";
}
function uniqueBins() {
  const bins = new Set();
  for (const t of TOOLS) {
    const b = binFromLabel(t.label);
    if (b) bins.add(b);
  }
  return Array.from(bins).sort();
}

/** Safely double-quote a shell value (for `export VAR="..."`). */
function dq(v) {
  const s = String(v ?? "").replace(/(["$`\\])/g, "\\$1");
  return `"${s}"`;
}

function writeEnvFile(values) {
  const lines = [
    `# GEARZ environment (created ${new Date().toISOString()})`,
    `# Load with:  source ./${ENV_FILE}`,
    ``,

    // Polite global rate
    `export RPS=${dq(values.RPS)}`,

    // Tool timeouts & severities
    `export KATANA_TIMEOUT=${dq(values.KATANA_TIMEOUT)}`,
    `export NUCLEI_TIMEOUT=${dq(values.NUCLEI_TIMEOUT)}`,
    `export NUCLEI_SEV=${dq(values.NUCLEI_SEV)}`,

    // Retries/backoff + inter-tool delay
    `export GEARZ_RETRIES=${dq(values.GEARZ_RETRIES)}`,
    `export GEARZ_BACKOFF_MS=${dq(values.GEARZ_BACKOFF_MS)}`,
    `export GEARZ_BACKOFF_FACTOR=${dq(values.GEARZ_BACKOFF_FACTOR)}`,
    `export RATE_DELAY_MS=${dq(values.RATE_DELAY_MS)}`,

    // Global URL skip regex — QUOTED to avoid parse errors
    `export GEARZ_SKIP=${dq(values.GEARZ_SKIP || "")}`,
  ];

  // Optional bounty header
  if (values.HTTP_HEADER && String(values.HTTP_HEADER).trim()) {
    lines.push(`export XBB=${dq(values.HTTP_HEADER.trim())}`);
  } else {
    lines.push(`# Optional HTTP header: set later with`);
    lines.push(`# export XBB=${dq("User-Agent: BugBounty-Harman")}`);
  }

  lines.push("");

  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf8");
}

export async function runInit() {
  banner("GEARZ OPS", "ANSI Shadow", "atlas");
  console.log(center(chalk.gray("Cinematic hacker-core terminal suite\n")));

  // ── 1) Ensure folders
  ensureDir("./runs");
  ensureDir("./logs");
  ensureDir("./tmp");

  // ── 2) Binary scan
  const bins = uniqueBins();
  const missing = bins.filter((b) => !binExists(b));
  const present = bins.filter((b) => binExists(b));
  console.log(
    neonBox(
      [
        chalk.white("🔧 Binary scan"),
        "",
        chalk.green(`✓ Found (${present.length})`) + (present.length ? `: ${present.join(", ")}` : ""),
        chalk.yellow(`• Missing (${missing.length})`) + (missing.length ? `: ${missing.join(", ")}` : ""),
        "",
        chalk.gray("Missing tools will be auto-skipped during runs (fail-soft)."),
      ],
      { borderColor: "cyan" }
    )
  );

  // ── 3) Interactive env tuning (+ header)
  const ans = await prompts([
    { name: "RPS", type: "number", message: "Rate limit (requests per second) for supported tools:", initial: 10, min: 1 },
    { name: "KATANA_TIMEOUT", type: "number", message: "Katana timeout (seconds):", initial: 600, min: 60 },
    { name: "NUCLEI_TIMEOUT", type: "number", message: "Nuclei timeout (seconds):", initial: 900, min: 60 },
    { name: "NUCLEI_SEV", type: "text", message: "Nuclei severities (comma-sep):", initial: "medium,high,critical", validate: (v) => (!!v ? true : "Required") },
    { name: "GEARZ_SKIP", type: "text", message: "Global URL skip regex (comma-sep routes, blank to disable):", initial: "/logout,/feedback,/support" },
    { name: "GEARZ_RETRIES", type: "number", message: "Retries on rate-limit/timeout:", initial: 2, min: 0 },
    { name: "GEARZ_BACKOFF_MS", type: "number", message: "Initial backoff (ms):", initial: 1500, min: 0 },
    { name: "GEARZ_BACKOFF_FACTOR", type: "number", message: "Backoff factor (e.g., 1.6):", initial: 1.6, min: 1.0 },
    { name: "RATE_DELAY_MS", type: "number", message: "Delay between tools (ms):", initial: 250, min: 0 },

    // new: optional bounty header
    { name: "HTTP_HEADER", type: "text", message: "Optional HTTP header for all HTTP tools (e.g., User-Agent: BugBounty-Harman). Leave blank to skip:", initial: "" },
  ]);
  if (!ans) { console.log(chalk.yellow("↩ Cancelled.")); return; }

  writeEnvFile(ans);

  console.log(
    neonBox(
      [
        chalk.green("✅ Interactive init complete."),
        "",
        chalk.white("Next steps:"),
        `• ${chalk.cyan("source ./.env.gearz")}  ${chalk.gray("→ load into THIS shell (flow also auto-loads).")}`,
        `• ${chalk.cyan("gearz flow")}          ${chalk.gray("→ guided chain with review/edit before run")}`,
        `• ${chalk.cyan("gearz recon")}         ${chalk.gray("→ quick presets for passive/active/URLs")}`,
        "",
        chalk.gray("Tip: add ") + chalk.white('source "$(pwd)/.env.gearz"') + chalk.gray(" to your shell profile for auto-load."),
      ],
      { borderColor: "green" }
    )
  );

  divider();
}
