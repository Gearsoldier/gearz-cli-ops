// commands/timeline.js
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";
import { banner, neonBox, divider, center } from "../utils/ui.js";

const ROOT = path.resolve(process.cwd());
const RUNS_DIR = path.join(ROOT, "runs");
const ARCHIVE_DIR = path.join(RUNS_DIR, "_archive");
const HISTORY_PATH = path.resolve(ROOT, "command-history.json");

function readJsonSafe(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const txt = fs.readFileSync(file, "utf8");
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}
function writeJsonSafe(file, val) {
  try { fs.writeFileSync(file, JSON.stringify(val, null, 2)); }
  catch (e) { console.log(chalk.red(`❌ Failed to write ${file}: ${e.message}`)); }
}
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function listRunFolders(baseDir = RUNS_DIR) {
  if (!fs.existsSync(baseDir)) return [];
  return fs.readdirSync(baseDir)
    .filter(name => {
      const p = path.join(baseDir, name);
      return fs.statSync(p).isDirectory() && !name.startsWith(".");
    })
    .sort();
}

function detectArtifacts(runId) {
  const p = path.join(RUNS_DIR, runId);
  const f = (name) => path.join(p, name);
  const statSize = (file) => (fs.existsSync(file) ? (fs.statSync(file).size || 0) : 0);
  return {
    subs: statSize(f("subs.txt")),
    hosts: statSize(f("hosts.txt")),
    urls: statSize(f("urls.txt")),
    nuclei: statSize(f("nuclei.txt")),
  };
}

function summarizeRun(history, runId) {
  const items = history.filter(h => h.runId === runId).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const first = items[0]?.timestamp;
  const last = items[items.length-1]?.timestamp;
  return { count: items.length, first, last, items };
}

function renderTimeline(runId, items) {
  console.log(center(chalk.gray("\n")));
  console.log(
    neonBox([
      `🎮 Run: ${runId}`,
      `${items.length} command(s)`
    ], { borderColor: "cyan" })
  );
  items.forEach((x, i) => {
    console.log(chalk.gray(`#${i+1} ${x.timestamp}`));
    console.log(chalk.white(`$ ${x.command}\n`));
  });
}

function parseFlags(argv = []) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = (argv[i+1] && !argv[i+1].startsWith("--")) ? argv[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

async function pickRunPrompt({ includeArchive = true } = {}) {
  const activeRuns = listRunFolders(RUNS_DIR);
  const archived = includeArchive && fs.existsSync(ARCHIVE_DIR) ? listRunFolders(ARCHIVE_DIR) : [];
  const choices = [];
  if (!activeRuns.length && !archived.length) {
    console.log(chalk.yellow("No runs found yet."));
    return null;
  }
  if (activeRuns.length) {
    choices.push(new inquirer.Separator(chalk.cyan("— Active Runs —")));
    for (const r of activeRuns) choices.push({ name: r, value: { id: r, where: "active" } });
  }
  if (archived.length) {
    choices.push(new inquirer.Separator(chalk.magenta("— Archived Runs —")));
    for (const r of archived) choices.push({ name: `(arch) ${r}`, value: { id: r, where: "arch" } });
  }
  const ans = await inquirer.prompt([{
    type: "list",
    name: "pick",
    message: "Select a run:",
    choices,
    pageSize: 12
  }]);
  return ans?.pick || null;
}

async function manageRunMenu(sel, history) {
  const artifacts = detectArtifacts(sel.id);
  const lines = [
    `🎮 Run: ${sel.id}${sel.where === "arch" ? " (archived)" : ""}`,
    `🗂 subs:${artifacts.subs}  hosts:${artifacts.hosts}  urls:${artifacts.urls}  nuclei:${artifacts.nuclei}`
  ];
  console.log(neonBox(lines, { borderColor: sel.where === "arch" ? "magenta" : "cyan" }));

  const actions = [];
  if (sel.where === "active") {
    actions.push({ name: "📦 Archive run", value: "archive" });
    actions.push({ name: "🧹 Clear command history for this run", value: "clearhist" });
    actions.push({ name: "🗑 Delete run (files + history)", value: "delete" });
  } else {
    actions.push({ name: "♻ Restore run from archive", value: "restore" });
    actions.push({ name: "🗑 Delete archived run (files + history)", value: "delete" });
  }
  actions.push({ name: "⬅ Back", value: "back" });

  const { action } = await inquirer.prompt([{ type: "list", name: "action", message: "Manage:", choices: actions }]);
  if (!action || action === "back") return;

  if (action === "archive") {
    ensureDir(ARCHIVE_DIR);
    const src = path.join(RUNS_DIR, sel.id);
    const dst = path.join(ARCHIVE_DIR, sel.id);
    if (!fs.existsSync(src)) return console.log(chalk.red("Run folder not found."));
    if (fs.existsSync(dst)) return console.log(chalk.yellow("Already archived."));
    const ok = await inquirer.prompt([{ type: "confirm", name: "y", message: `Archive ${sel.id}?`, default: true }]);
    if (!ok.y) return console.log(chalk.yellow("↩ Cancelled."));
    fs.renameSync(src, dst);
    console.log(chalk.green("✅ Archived."));
    return;
  }

  if (action === "restore") {
    ensureDir(RUNS_DIR);
    const src = path.join(ARCHIVE_DIR, sel.id);
    const dst = path.join(RUNS_DIR, sel.id);
    if (!fs.existsSync(src)) return console.log(chalk.red("Archived run not found."));
    if (fs.existsSync(dst)) return console.log(chalk.yellow("Already restored."));
    const ok = await inquirer.prompt([{ type: "confirm", name: "y", message: `Restore ${sel.id}?`, default: true }]);
    if (!ok.y) return console.log(chalk.yellow("↩ Cancelled."));
    fs.renameSync(src, dst);
    console.log(chalk.green("✅ Restored."));
    return;
  }

  if (action === "clearhist") {
    const ok = await inquirer.prompt([{ type: "confirm", name: "y", message: `Clear command history entries for ${sel.id}?`, default: true }]);
    if (!ok.y) return console.log(chalk.yellow("↩ Cancelled."));
    const newHist = history.filter(h => h.runId !== sel.id);
    writeJsonSafe(HISTORY_PATH, newHist);
    console.log(chalk.green("✅ History cleared for this run."));
    return;
  }

  if (action === "delete") {
    const whereDir = sel.where === "arch" ? ARCHIVE_DIR : RUNS_DIR;
    const tgt = path.join(whereDir, sel.id);
    const ok = await inquirer.prompt([{
      type: "confirm",
      name: "y",
      message: `Permanently delete ${sel.id} (files + history)?`,
      default: false
    }]);
    if (!ok.y) return console.log(chalk.yellow("↩ Cancelled."));
    try { fs.rmSync(tgt, { recursive: true, force: true }); }
    catch (e) { return console.log(chalk.red(`❌ Delete failed: ${e.message}`)); }
    const newHist = history.filter(h => h.runId !== sel.id);
    writeJsonSafe(HISTORY_PATH, newHist);
    console.log(chalk.green("✅ Deleted."));
    return;
  }
}

function gcHistory(history) {
  const active = new Set(listRunFolders(RUNS_DIR));
  const arch = fs.existsSync(ARCHIVE_DIR) ? new Set(listRunFolders(ARCHIVE_DIR)) : new Set();
  const keep = history.filter(h => active.has(h.runId) || arch.has(h.runId));
  const removed = history.length - keep.length;
  if (removed > 0) writeJsonSafe(HISTORY_PATH, keep);
  return removed;
}

export async function runTimelineCommand(argv = []) {
  banner("TIMELINE", "ANSI Shadow", "fruit");
  console.log(center(chalk.gray("Runs → View timeline → Manage (archive/restore/delete) → GC history\n")));

  const flags = parseFlags(argv);
  let history = readJsonSafe(HISTORY_PATH, []);

  if (flags.list || flags["list-runs"]) {
    const active = listRunFolders(RUNS_DIR);
    const arch = listRunFolders(ARCHIVE_DIR);
    console.log(neonBox(["📜 Runs", `Active: ${active.length}`, `Archived: ${arch.length}`], { borderColor: "cyan" }));
    active.forEach(r => console.log(r));
    if (arch.length) { console.log(chalk.gray("\n# archived")); arch.forEach(r => console.log(r)); }
    return;
  }

  if (flags.gc) {
    const removed = gcHistory(history);
    console.log(chalk.green(`🧹 GC complete. Removed ${removed} dangling history entr${removed === 1 ? "y" : "ies"}.`));
    return;
  }

  const directRun = flags.run || flags.id;
  if (directRun) {
    const where = fs.existsSync(path.join(RUNS_DIR, directRun)) ? "active"
                 : fs.existsSync(path.join(ARCHIVE_DIR, directRun)) ? "arch"
                 : null;
    if (!where) return console.log(chalk.red(`Run '${directRun}' not found.`));
    const { items } = summarizeRun(history, directRun);
    renderTimeline(directRun, items);
    return;
  }

  while (true) {
    const sel = await pickRunPrompt({ includeArchive: true });
    if (!sel) return;

    const { items } = summarizeRun(history, sel.id);
    renderTimeline(sel.id, items);

    const next = await inquirer.prompt([{
      type: "list",
      name: "next",
      message: "Next:",
      choices: [
        { name: "Manage this run…", value: "manage" },
        { name: "🗑 Delete this run now", value: "deleteNow" },
        { name: "Pick another run…", value: "again" },
        { name: "GC dangling history", value: "gc" },
        { name: "Exit", value: "exit" },
      ]
    }]);

    if (!next || next.next === "exit") return;

    if (next.next === "gc") {
      const removed = gcHistory(readJsonSafe(HISTORY_PATH, []));
      console.log(chalk.green(`🧹 GC complete. Removed ${removed} dangling history entr${removed === 1 ? "y" : "ies"}.`));
      continue;
    }

    if (next.next === "again") continue;

    if (next.next === "manage") {
      await manageRunMenu(sel, readJsonSafe(HISTORY_PATH, []));
      divider();
      continue;
    }

    if (next.next === "deleteNow") {
      const whereDir = sel.where === "arch" ? ARCHIVE_DIR : RUNS_DIR;
      const tgt = path.join(whereDir, sel.id);
      const ok = await inquirer.prompt([{
        type: "confirm",
        name: "y",
        message: `Permanently delete ${sel.id} (files + history)?`,
        default: false
      }]);
      if (!ok.y) { console.log(chalk.yellow("↩ Cancelled.")); continue; }
      try { fs.rmSync(tgt, { recursive: true, force: true }); }
      catch (e) { console.log(chalk.red(`❌ Delete failed: ${e.message}`)); continue; }
      const newHist = readJsonSafe(HISTORY_PATH, []).filter(h => h.runId !== sel.id);
      writeJsonSafe(HISTORY_PATH, newHist);
      console.log(chalk.green("✅ Deleted."));
      divider();
      // refresh loop so you can pick another
      continue;
    }
  }
}
