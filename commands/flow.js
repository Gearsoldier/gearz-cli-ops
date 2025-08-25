// commands/flow.js
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import runTool from "../utils/runTool.js";
import { banner, neonBox, divider, center } from "../utils/ui.js";
import { TOOLS, TOOL_CATEGORIES, PRESETS, buildCtx } from "../utils/tools.js";
import { spawnSync } from "child_process";
import { copyScopeToRun, seedSubsFromScope, loadScope } from "../utils/scope.js";
import { aggregateFindings } from "./findings.js";

// Load .env.gearz into process.env so runs pick config even if the user forgets to `source`
function loadEnvFile(file = ".env.gearz") {
  try {
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (let raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const [, key, rhs] = m;
      let val = rhs.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* fail-soft */
  }
}

// Expand $VARS and ${VARS} from the current environment inside user input
function expandEnv(str = "") {
  if (typeof str !== "string" || !str) return str;
  let out = str.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, k) => process.env[k] ?? "");
  out = out.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => process.env[k] ?? "");
  return out;
}

function choicesByCategory(cats) {
  const all = TOOLS.filter((t) => cats.includes(t.cat));
  const grouped = {};
  all.forEach((t) => (grouped[t.cat] = (grouped[t.cat] || []).concat(t)));
  const choices = [];
  for (const cat of cats) {
    choices.push(new inquirer.Separator(`--- ${TOOL_CATEGORIES[cat]} ---`));
    (grouped[cat] || []).forEach((t) => {
      choices.push({
        name: `${t.label.padEnd(16)} ${chalk.gray(t.desc)}`,
        value: t.id,
        short: t.label,
      });
    });
  }
  return choices;
}

function binExists(bin) {
  const r = spawnSync("bash", ["-lc", `command -v ${bin} >/dev/null 2>&1 && echo OK || echo NO`], { encoding: "utf8" });
  return r.stdout.trim() === "OK";
}

async function ask(def) {
  try {
    return await inquirer.prompt(def);
  } catch (e) {
    if (e && (e.name === "ExitPromptError" || e.isTtyError)) {
      console.log(chalk.yellow("\n↩ Cancelled. Nothing was run.\n"));
      return null;
    }
    throw e;
  }
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
      console.log(
        neonBox(
          [
            chalk.yellow(`⚠ Skipping ${tool.label}`),
            `Missing or empty required artifact for this stage: ${r.toUpperCase()}`,
            chalk.gray(`Tip: run prior stage to produce ${r}.`),
          ],
          { borderColor: "yellow" }
        )
      );
      return false;
    }
  }
  return true;
}

function binFromLabel(label) {
  return (label || "").split(" ")[0];
}
function parseFlags(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const get = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { flags, get };
}

function enforceStageOrder(planIds) {
  const byCat = { Passive: [], Active: [], URLs: [], Vulns: [], Bruteforce: [] };
  for (const id of planIds) {
    const t = TOOLS.find((x) => x.id === id);
    if (t && byCat[t.cat]) byCat[t.cat].push(id);
  }
  return [
    ...byCat.Passive,
    ...byCat.Active,
    ...byCat.URLs,
    ...byCat.Vulns,
    ...byCat.Bruteforce,
  ];
}

export async function runFlowCommand(argv = []) {
  // Auto-load env file for this process
  loadEnvFile(".env.gearz");

  const { flags, get } = parseFlags(argv);
  const dryRun = flags.has("--dry-run");
  const noScope = flags.has("--no-scope");
  const providedRun = get("--run");
  const delayBetweenToolsMs = Number(process.env.RATE_DELAY_MS || 0); // <-- single declaration

  banner("FLOW MODE", "ANSI Shadow", "vice");
  console.log(center(chalk.gray("Guide → Chain Builder → Review/Edit → Execute → Findings\n")));

  // Scope board
  const scope = loadScope();
  const scopeChoices = (scope.inScope || []).map((x) => ({ name: x, value: x }));

  let runId = providedRun || new Date().toISOString().replace(/[:.]/g, "-");
  let runPath = `./runs/${runId}`;
  const ctx = buildCtx(runPath);

  const domainPrompt = await ask([
    {
      name: "pickFromScope",
      type: scopeChoices.length ? "confirm" : null,
      message: `Pick target from Scope Board? (${scopeChoices.length} item${scopeChoices.length === 1 ? "" : "s"})`,
      default: true,
    },
    {
      name: "domain",
      type: (prev) => (prev === true && scopeChoices.length ? "list" : "input"),
      message: (prev) =>
        prev === true && scopeChoices.length
          ? "Choose target domain(s) from Scope Board (comma-separated):"
          : "🎯 Target domain or path to scope file:",
      choices: scopeChoices,
      filter: (v) => (Array.isArray(v) ? v[0] : v),
      validate: (v) => (!!v ? true : "Required"),
    },
    { name: "inscope", message: "✅ I confirm this target is public and in scope.", type: "confirm", default: false },
  ]);
  if (!domainPrompt || !domainPrompt.domain) return;
  if (!domainPrompt.inscope) {
    console.log(chalk.yellow("↩ Cancelled. Scope not confirmed."));
    return;
  }

  // Expand $RUN etc. in the provided path
  const domain = expandEnv(domainPrompt.domain);

  // Prepare run dir
  fs.mkdirSync(runPath, { recursive: true });
  if (!noScope) {
    copyScopeToRun(runPath);
    const seeded = seedSubsFromScope(runPath);
    if (seeded) console.log(neonBox([`📥 Seeded subs.txt with ${seeded} entr${seeded === 1 ? "y" : "ies"} from Scope Board.`]));
  }

  console.log(
    neonBox([chalk.cyan(`Run: ${runId}`), `Target: ${domain}`, `scope: ${domain}`], { borderColor: "cyan" })
  );

  // Pick tools
  const usePreset = await ask([{ name: "use", type: "confirm", message: "Use a preset?", default: true }]);
  let plan = [];
  if (usePreset?.use) {
    const presetNames = Object.keys(PRESETS);
    const picked = await ask([
      {
        name: "preset",
        type: "list",
        message: "Choose preset:",
        choices: presetNames,
        default: "🧩 URL & JS Harvest + Fast Dalfox",
      },
    ]);
    if (!picked || !picked.preset) return;
    plan = PRESETS[picked.preset].slice();
  } else {
    const s1 = await ask([
      {
        name: "s1",
        type: "checkbox",
        message: "Stage 1: Discover subdomains (→ subs.txt)",
        choices: choicesByCategory(["Passive"]),
        pageSize: 18,
      },
    ]);
    if (!s1) return;
    const s2 = await ask([
      {
        name: "s2",
        type: "checkbox",
        message: "Stage 2: Probe live hosts (→ hosts.txt)",
        choices: choicesByCategory(["Active"]),
        pageSize: 18,
      },
    ]);
    if (!s2) return;
    const s3 = await ask([
      {
        name: "s3",
        type: "checkbox",
        message: "Stage 3: Harvest URLs/JS (→ urls.txt, js/)",
        choices: choicesByCategory(["URLs"]),
        pageSize: 18,
      },
    ]);
    if (!s3) return;
    const s4 = await ask([
      {
        name: "s4",
        type: "checkbox",
        message: "Stage 4: Quick vuln triage & bruteforce",
        choices: choicesByCategory(["Vulns", "Bruteforce"]),
        pageSize: 18,
      },
    ]);
    if (!s4) return;
    plan = [...(s1.s1 || []), ...(s2.s2 || []), ...(s3.s3 || []), ...(s4.s4 || [])];
  }
  if (!plan.length) {
    console.log(chalk.red("❌ No tools selected."));
    return;
  }

  // Review / Edit loop
  while (true) {
    const resolved = plan.map((id) => {
      const t = TOOLS.find((x) => x.id === id);
      return t ? t.build(domain, ctx) : "";
    });
    divider();
    console.log(chalk.white("Execution Plan:"));
    console.log(chalk.gray(resolved.join("\n")));
    divider();

    const editAns = await ask({
      name: "edit",
      type: "list",
      message: "Edit a stage before running? (or press Enter to continue)",
      choices: [
        { name: "No (looks good)", value: "none" },
        { name: "Stage 1 — Passive", value: "s1" },
        { name: "Stage 2 — Active", value: "s2" },
        { name: "Stage 3 — URLs/JS", value: "s3" },
        { name: "Stage 4 — Vulns/Brute", value: "s4" },
        { name: "Start over (wipe selections)", value: "reset" },
      ],
      default: "none",
    });

    if (!editAns || editAns.edit === "none") break;
    if (editAns.edit === "reset") {
      plan = [];
      continue;
    }

    const stageMap = { s1: ["Passive"], s2: ["Active"], s3: ["URLs"], s4: ["Vulns", "Bruteforce"] };
    const newSel = await ask([
      {
        name: "pick",
        type: "checkbox",
        message: `Edit ${editAns.edit.toUpperCase()}:`,
        choices: choicesByCategory(stageMap[editAns.edit]),
        pageSize: 18,
      },
    ]);
    if (!newSel) return;

    const keep = plan.filter(
      (id) => !stageMap[editAns.edit].includes((TOOLS.find((t) => t.id === id) || {}).cat)
    );
    plan = enforceStageOrder([...keep, ...(newSel.pick || [])]);
  }

  // Enforce final order
  plan = enforceStageOrder(plan);

  // Missing binaries notice
  const missing = plan
    .map((id) => binFromLabel((TOOLS.find((t) => t.id === id) || {}).label))
    .filter((bin) => bin && !binExists(bin));
  if (missing.length) {
    console.log(
      neonBox(
        [chalk.yellow("⚠ Some binaries appear missing and will be skipped:"), chalk.gray(missing.join(", "))],
        { borderColor: "yellow" }
      )
    );
  }

  if (dryRun) {
    console.log(chalk.cyan("Dry run complete. No commands executed."));
    return;
  }

  // Execute with optional inter-tool delay (uses the single declaration above)
  for (const id of plan) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) continue;

    const bin = binFromLabel(t.label);
    if (bin && !binExists(bin)) {
      console.log(chalk.yellow(`↷ Skipping ${t.label} (missing binary)\n`));
      divider();
      continue;
    }
    if (!failSoftCheck(t, ctx)) {
      divider();
      continue;
    }

    const cmd = t.build(domain, ctx);
    console.log(chalk.magentaBright(`▶ ${t.label}`), chalk.gray(`— ${t.desc}`));
    console.log(chalk.cyan(`$ ${cmd}\n`));

    try {
      const { logPath } = await runTool(cmd, {
        runId,
        logName: t.id,
        retries: Number(process.env.GEARZ_RETRIES ?? 2),
        backoffMs: Number(process.env.GEARZ_BACKOFF_MS ?? 1500),
        backoffFactor: Number(process.env.GEARZ_BACKOFF_FACTOR ?? 1.6),
      });
      console.log(chalk.green(`✔ done`), chalk.gray(`(log → ${logPath})\n`));
    } catch (e) {
      console.log(chalk.red(`✖ failed: ${e.message}\n`));
    }
    divider();
    if (delayBetweenToolsMs > 0) {
      await new Promise((r) => setTimeout(r, delayBetweenToolsMs));
    }
  }

  // Findings summary
  const summary = aggregateFindings(runPath);
  console.log(
    neonBox(
      [
        chalk.green("Flow complete."),
        `Artifacts: ${runPath}`,
        "",
        chalk.white("Findings summary:"),
        `  • Unique params: ${summary.params}`,
        `  • Endpoints: ${summary.endpoints}`,
        `  • Nuclei High/Critical: ${summary.nuclei_high_critical}`,
        `  • Interesting paths: ${summary.interesting_paths}`,
        "",
        chalk.gray("Open: ") + chalk.cyan(`${runPath}/findings/`),
      ],
      { borderColor: "green" }
    )
  );
}
