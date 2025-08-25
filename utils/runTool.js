// utils/runTool.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const historyPath = path.resolve(__dirname, "../command-history.json");
const runsDir = path.resolve(__dirname, "../runs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function recordCommand(command, runId) {
  try {
    let history = [];
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      if (!Array.isArray(history)) history = [];
    }
    history.push({ command, runId, timestamp: new Date().toISOString() });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error("⚠️ Failed to record command history:", e.message);
  }
}

function shouldRetryFromOutput(buf) {
  const s = buf.toLowerCase();
  return (
    s.includes("429") ||
    s.includes("too many requests") ||
    s.includes("rate limit") ||
    s.includes("timeout") ||
    s.includes("timed out")
  );
}

/**
 * Run a command with streaming output and tee to runs/<runId>/<logName>.log
 * Retries on 429/rate-limit/timeout with exponential backoff.
 *
 * opts:
 *  - runId
 *  - logName
 *  - env, cwd
 *  - retries (default from env GEARZ_RETRIES or 0)
 *  - backoffMs (default from env GEARZ_BACKOFF_MS or 1500)
 *  - backoffFactor (default from env GEARZ_BACKOFF_FACTOR or 1.6)
 *  - delayBetweenToolsMs (env RATE_DELAY_MS applied by callers between tools)
 */
export default async function runTool(cmd, opts = {}) {
  if (!cmd || typeof cmd !== "string") throw new Error("runTool: command must be a non-empty string");

  const runId = opts.runId || new Date().toISOString().replace(/[:.]/g, "-");
  const logName = (opts.logName || "cmd").replace(/[^\w.-]+/g, "_");
  const runPath = path.join(runsDir, runId);
  const logPath = path.join(runPath, `${logName}.log`);
  ensureDir(runPath);

  const retries = Number(opts.retries ?? process.env.GEARZ_RETRIES ?? 0);
  const backoffFactor = Number(opts.backoffFactor ?? process.env.GEARZ_BACKOFF_FACTOR ?? 1.6);
  let backoffMs = Number(opts.backoffMs ?? process.env.GEARZ_BACKOFF_MS ?? 1500);

  let attempt = 0;
  let lastStdout = "";
  let lastStderr = "";
  let lastCode = 0;

  while (attempt <= retries) {
    if (attempt > 0) {
      const wait = Math.max(0, Math.round(backoffMs));
      console.log(chalkGray(`↻ retry ${attempt}/${retries} in ${wait}ms…`));
      await sleep(wait);
      backoffMs *= backoffFactor;
    }

    recordCommand(cmd, runId);

    const outBufs = [];
    const errBufs = [];

    const res = await new Promise((resolve) => {
      const child = spawn(cmd, {
        shell: true,
        env: { ...process.env, ...opts.env },
        cwd: opts.cwd || process.cwd(),
      });

      const logStream = fs.createWriteStream(logPath, { flags: attempt === 0 ? "w" : "a" });

      child.stdout.on("data", (data) => {
        process.stdout.write(data);
        logStream.write(data);
        outBufs.push(data);
      });
      child.stderr.on("data", (data) => {
        process.stderr.write(data);
        logStream.write(data);
        errBufs.push(data);
      });

      child.on("close", (code) => {
        logStream.end();
        resolve({ code });
      });
    });

    lastCode = res.code ?? 0;
    lastStdout = Buffer.concat(outBufs).toString("utf8");
    lastStderr = Buffer.concat(errBufs).toString("utf8");

    if (lastCode === 0) {
      return { runId, logPath };
    }

    // Decide retry
    const retryable = shouldRetryFromOutput(lastStdout + "\n" + lastStderr);
    if (!retryable || attempt === retries) break;

    attempt += 1;
  }

  throw new Error(`Command failed (code ${lastCode}) after ${attempt} attempt(s): ${cmd}`);
}

// minimal color without importing chalk
function chalkGray(s) { return `\x1b[90m${s}\x1b[0m`; }
