// commands/recon.js
import prompts from "prompts";
import chalk from "chalk";
import fs from "fs";
import { banner, neonBox, divider } from "../utils/ui.js";
import runTool from "../utils/runTool.js";
import { TOOLS, PRESETS, buildCtx } from "../utils/tools.js";
import { spawnSync } from "child_process";
import {
  listPresets, getPresetByName, upsertPreset, deletePreset,
  renamePreset, exportPresets, importPresets, tagPreset
} from "../utils/presets.js";
import { loadScope, copyScopeToRun } from "../utils/scope.js";

const RECON_PRESETS = {
  "👾 Passive Sweep": PRESETS["👾 Passive Sweep"],
  "🚀 Active Mapping": PRESETS["🚀 Active Mapping"],
  "🧩 URL & JS Harvest": PRESETS["🧩 URL & JS Harvest"],
};

function binExists(bin) {
  const r = spawnSync("bash", ["-lc", `command -v ${bin} >/dev/null 2>&1 && echo OK || echo NO`], { encoding: "utf8" });
  return r.stdout.trim() === "OK";
}

function allToolIds() {
  return new Set(TOOLS.map(t => t.id));
}
function validateIds(ids) {
  const known = allToolIds();
  const valid = [];
  const invalid = [];
  for (const id of ids) (known.has(id) ? valid : invalid).push(id);
  return { valid, invalid };
}

function warnMissingBins(ids) {
  const missing = ids
    .map(id => TOOLS.find(t=>t.id===id)?.label.split(" ")[0])
    .filter(bin => bin && !binExists(bin));
  if (missing.length) {
    console.log(neonBox([
      chalk.yellow("⚠ Some binaries appear missing and will be skipped:"),
      chalk.gray(missing.join(", ")),
    ], { borderColor: "yellow" }));
  }
}

async function confirmScope() {
  const scopeAns = await prompts({
    type: "confirm",
    name: "ok",
    message: "✅ Confirm this target is public and in scope.",
    initial: false,
  });
  if (!scopeAns.ok) { console.log(chalk.yellow("↩ Cancelled. Scope not confirmed.")); return false; }
  return true;
}

function parseFlags(argv) {
  const get = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i+1] : undefined;
  };
  const has = (k) => argv.includes(k);
  return { has, get, argv };
}

function showPresetDetails(p) {
  const { valid, invalid } = validateIds(p.ids || []);
  const tagStr = (p.tags && p.tags.length) ? `🏷  ${p.tags.join(", ")}` : "";
  const lines = [
    `📦 ${p.name}`,
    p.notes ? `📝 ${p.notes}` : "",
    tagStr,
    `🧰 Tools (${valid.length}): ${valid.join(", ") || "-"}`,
    invalid.length ? chalk.red(`❌ Unknown tools in preset: ${invalid.join(", ")}`) : "",
    p.createdAt ? chalk.gray(`created: ${p.createdAt}`) : "",
    p.updatedAt ? chalk.gray(`updated: ${p.updatedAt}`) : "",
  ].filter(Boolean);
  console.log(neonBox(lines, { borderColor: "cyan" }));
  warnMissingBins(valid);
}

function artifactOk(kind, ctx) {
  const map = { subs: ctx.subsFile, hosts: ctx.hostsFile, urls: ctx.urlsFile };
  const file = map[kind];
  try {
    const stat = fs.statSync(file);
    return stat.size > 0;
  } catch {
    return false;
  }
}

function failSoftCheck(tool, ctx) {
  const reqs = tool.requires || [];
  for (const r of reqs) {
    if (!artifactOk(r, ctx)) {
      const name = r.toUpperCase();
      console.log(
        neonBox(
          [chalk.yellow(`⚠ Skipping ${tool.label}`),
           `Missing or empty required artifact for this stage: ${name}`,
           chalk.gray(`Tip: run prior stage to produce ${name}.`)],
          { borderColor: "yellow" }
        )
      );
      return false;
    }
  }
  return true;
}

export async function runRecon(argv = []) {
  const flags = parseFlags(argv);
  const dryRun = flags.has("--dry-run");

  // ======= Preset Manager CLI actions (unchanged, plus tags) =======
  if (flags.has("--list-presets")) {
    const filter = flags.get("--filter");
    const tagFilter = (filter && filter.startsWith("tag:")) ? filter.slice(4) : undefined;
    banner("RECON PRESETS", "ANSI Shadow", "fruit");
    const presets = listPresets({ filterTag: tagFilter });
    if (!presets.length) { console.log(chalk.yellow("No custom presets saved yet.")); return; }
    for (const p of presets) showPresetDetails(p);
    return;
  }
  if (flags.has("--show-preset")) {
    const name = flags.get("--show-preset");
    if (!name) return console.log(chalk.red("Usage: gearz recon --show-preset <name>"));
    const p = getPresetByName(name);
    if (!p) return console.log(chalk.red(`Preset '${name}' not found.`));
    banner("RECON PRESET", "ANSI Shadow", "fruit");
    showPresetDetails(p);
    return;
  }
  if (flags.has("--delete-preset")) {
    const name = flags.get("--delete-preset");
    if (!name) return console.log(chalk.red("Usage: gearz recon --delete-preset <name>"));
    const ok = await prompts({ type: "confirm", name: "y", message: `Delete preset '${name}'?`, initial: false });
    if (!ok.y) return console.log(chalk.yellow("↩ Cancelled."));
    const deleted = deletePreset(name);
    console.log(deleted ? chalk.green(`🗑 Deleted preset '${name}'.`) : chalk.yellow(`Preset '${name}' not found.`));
    return;
  }
  if (flags.has("--rename-preset")) {
    const oldName = flags.get("--rename-preset");
    const newName = flags.get("--to");
    if (!oldName || !newName) return console.log(chalk.red("Usage: gearz recon --rename-preset <old> --to <new>"));
    const ok = renamePreset(oldName, newName);
    console.log(ok ? chalk.green(`✏️  Renamed preset '${oldName}' → '${newName}'.`) : chalk.red(`Preset '${oldName}' not found.`));
    return;
  }
  if (flags.has("--tag-preset")) {
    const name = flags.get("--tag-preset");
    const tags = flags.get("--tags");
    if (!name || !tags) return console.log(chalk.red("Usage: gearz recon --tag-preset <name> --tags tag1,tag2"));
    const ok = tagPreset(name, tags);
    console.log(ok ? chalk.green(`🏷  Updated tags for '${name}'.`) : chalk.red(`Preset '${name}' not found.`));
    return;
  }
  if (flags.has("--export-presets")) {
    const out = flags.get("--export-presets");
    if (!out) return console.log(chalk.red("Usage: gearz recon --export-presets <file>"));
    exportPresets(out);
    console.log(chalk.green(`📤 Exported presets → ${out}`));
    return;
  }
  if (flags.has("--import-presets")) {
    const file = flags.get("--import-presets");
    if (!file) return console.log(chalk.red("Usage: gearz recon --import-presets <file> [--overwrite]"));
    try {
      const res = importPresets(file, { merge: true, overwrite: flags.has("--overwrite") });
      console.log(chalk.green(`📥 Imported ${res.imported} presets${res.overwritten ? `, overwritten: ${res.overwritten}` : ""}.`));
    } catch (e) {
      console.log(chalk.red(`❌ Import failed: ${e.message}`));
    }
    return;
  }

  // ======= Normal Recon =======
  banner("RECON OPS", "ANSI Shadow", "summer");
  prompts.override({ onCancel: () => { console.log(chalk.yellow("\n↩ Cancelled.\n")); return true; } });

  let ids = [];
  let usingPreset = null;

  if (flags.has("--use-preset")) {
    const name = flags.get("--use-preset");
    const p = name ? getPresetByName(name) : null;
    if (!p) {
      console.log(chalk.red(`Preset '${name || "(missing)"}' not found.`));
      return;
    }
    const { valid, invalid } = validateIds(p.ids || []);
    if (invalid.length) {
      console.log(neonBox([chalk.red(`❌ Unknown tools in preset: ${invalid.join(", ")}`)], { borderColor: "red" }));
    }
    ids = valid;
    usingPreset = p.name;
    showPresetDetails(p);
  } else {
    const modeAns = await prompts({
      type: "select",
      name: "mode",
      message: "Recon mode:",
      choices: [
        ...Object.keys(RECON_PRESETS).map(k => ({ title: k, value: k })),
        { title: "🎛  Custom (pick tools)", value: "custom" },
        { title: "📦 Use custom preset…", value: "use" },
      ],
      initial: 0,
    });
    if (!modeAns || !modeAns.mode) return;

    if (modeAns.mode === "use") {
      const presets = listPresets({ filterTag: (flags.get("--filter")||"").startsWith("tag:") ? flags.get("--filter").slice(4) : undefined });
      if (!presets.length) { console.log(chalk.yellow("No custom presets saved yet.")); return; }
      const picked = await prompts({
        type: "autocomplete",
        name: "name",
        message: "Choose a preset:",
        choices: presets.map(p => ({ title: p.name, value: p.name })),
        suggest: (input, choices) => Promise.resolve(
          choices.filter(c => c.title.toLowerCase().includes((input||"").toLowerCase()))
        )
      });
      if (!picked || !picked.name) return;
      const p = getPresetByName(picked.name);
      const { valid } = validateIds(p.ids || []);
      ids = valid;
      usingPreset = p.name;
      showPresetDetails(p);
    } else if (modeAns.mode === "custom") {
      const choices = TOOLS
        .filter(t => ["Passive","Active","URLs"].includes(t.cat))
        .map(t => ({ title: `${t.label} ${chalk.gray(`— ${t.desc}`)}`, value: t.id }));
      const res = await prompts({
        type: "multiselect",
        name: "ids",
        message: "Choose recon tools:",
        choices,
        min: 1,
      });
      if (!res || !Array.isArray(res.ids)) return;
      ids = res.ids;

      const saveAns = await prompts({ type: "confirm", name: "save", message: "Save this selection as a preset?", initial: false });
      if (saveAns.save) {
        const nameAns = await prompts({ type: "text", name: "name", message: "Preset name:", validate: v => v ? true : "Required" });
        if (nameAns && nameAns.name) {
          const notesAns = await prompts({ type: "text", name: "notes", message: "Optional notes:" });
          const tagsAns  = await prompts({ type: "text", name: "tags", message: "Tags (comma-separated):" });
          upsertPreset({ name: nameAns.name, ids, notes: (notesAns?.notes)||"", tags: (tagsAns?.tags)||"" });
          console.log(chalk.green(`✅ Saved preset '${nameAns.name}'.`));
        }
      }
    } else {
      ids = RECON_PRESETS[modeAns.mode] || [];
    }
  }

  if (!ids.length) {
    console.log(chalk.red("❌ No tools selected."));
    return;
  }

  // Domain prompt with optional Scope Board help
  const scope = loadScope();
  const scopeChoices = (scope.inScope || []).map(x => ({ title: x, value: x }));
  let domain = null;

  if (scopeChoices.length && flags.has("--from-scope")) {
    const pick = await prompts({
      type: "autocomplete",
      name: "d",
      message: "Pick target from Scope Board:",
      choices: scopeChoices,
      suggest: (input, choices) => Promise.resolve(
        choices.filter(c => c.title.toLowerCase().includes((input||"").toLowerCase()))
      )
    });
    if (!pick || !pick.d) return;
    domain = pick.d;
  } else {
    const domainAns = await prompts({ type: "text", name: "domain", message: "Target domain:", validate: v => v ? true : "Required" });
    if (!domainAns || !domainAns.domain) return;
    domain = domainAns.domain;
  }

  const okScope = await confirmScope();
  if (!okScope) return;

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runPath = `./runs/${runId}`;
  const ctx = buildCtx(runPath);
  fs.mkdirSync(runPath, { recursive: true });
  copyScopeToRun(runPath); // keep scope alongside run artifacts

  const resolvedCmds = ids.map(id => {
    const t = TOOLS.find(x => x.id === id);
    return t ? { id, t, cmd: t.build(domain, ctx) } : null;
    }).filter(Boolean);

  console.log(neonBox([
    `🎯 ${domain}`,
    `🎮 Run: ${runId}`,
    usingPreset ? `📦 Preset: ${usingPreset}` : `🧰 Tools: ${ids.join(", ")}`,
    dryRun ? "🧪 DRY RUN (no commands executed)" : ""
  ].filter(Boolean)));
  divider();

  if (dryRun) {
    resolvedCmds.forEach(x => console.log(chalk.gray(x.cmd)));
    console.log(chalk.cyan("Dry run complete. No commands executed."));
    return;
  }

  for (const x of resolvedCmds) {
    const { t, cmd } = x;

    const bin = t.label.split(" ")[0];
    if (!binExists(bin)) { console.log(chalk.yellow(`↷ Skipping ${t?.label || x.id} (missing binary)\n`)); divider(); continue; }
    if (!failSoftCheck(t, ctx)) { divider(); continue; }

    console.log(chalk.cyan(`$ ${cmd}\n`));
    try {
      const { logPath } = await runTool(cmd, { runId, logName: t.id });
      console.log(chalk.green(`✔ ${t.label} ok`), chalk.gray(`→ ${logPath}\n`));
    } catch (e) {
      console.log(chalk.red(`✖ ${t?.label || x.id} failed: ${e.message}\n`));
    }
    divider();
  }

  console.log(chalk.green("Recon complete."), chalk.gray(`Logs: ${runPath}\n`));
}
