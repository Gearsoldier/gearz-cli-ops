// commands/scope.js
import prompts from "prompts";
import chalk from "chalk";
import { banner, neonBox, divider } from "../utils/ui.js";
import { loadScope, saveScope, clearScope, exportScope, importScope } from "../utils/scope.js";

export async function runScope(argv = []) {
  const flags = new Set(argv.filter(a => a.startsWith("--")));
  const get = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i+1] : undefined;
  };

  // Quick flags
  if (flags.has("--show")) {
    const s = loadScope();
    banner("SCOPE BOARD", "ANSI Shadow", "pastel");
    const lines = [
      `📝 Notes: ${s.notes ? s.notes : "(none)"}`,
      `✅ In‑Scope (${s.inScope.length})`,
      ...s.inScope.map(x => "  - " + x),
      "",
      `⛔ Out‑of‑Scope (${s.outScope.length})`,
      ...s.outScope.map(x => "  - " + x),
      "",
      s.updatedAt ? chalk.gray(`updated: ${s.updatedAt}`) : ""
    ];
    console.log(neonBox(lines.filter(Boolean)));
    return;
  }

  if (flags.has("--clear")) {
    clearScope();
    console.log(chalk.green("🧹 Cleared scope board."));
    return;
  }

  if (flags.has("--export")) {
    const file = get("--export");
    if (!file) return console.log(chalk.red("Usage: gearz scope --export <file>"));
    exportScope(file);
    console.log(chalk.green(`📤 Exported scope → ${file}`));
    return;
  }

  if (flags.has("--import")) {
    const file = get("--import");
    if (!file) return console.log(chalk.red("Usage: gearz scope --import <file> [--merge]"));
    try {
      importScope(file, { overwrite: !flags.has("--merge") });
      console.log(chalk.green(`📥 Imported scope ${flags.has("--merge") ? "(merged)" : "(overwritten)"}.`));
    } catch (e) {
      console.log(chalk.red(`❌ Import failed: ${e.message}`));
    }
    return;
  }

  // Interactive Board
  banner("SCOPE BOARD", "ANSI Shadow", "pastel");
  const cur = loadScope();

  const ans = await prompts([
    {
      type: "text",
      name: "notes",
      message: "Notes (optional):",
      initial: cur.notes || ""
    },
    {
      type: "list",
      name: "inScope",
      message: "Paste IN‑SCOPE items (comma or newline separated). Press Enter when done:",
      initial: cur.inScope.join(", "),
      separator: /[,\n]/,
    },
    {
      type: "list",
      name: "outScope",
      message: "Paste OUT‑OF‑SCOPE items (comma or newline separated). Press Enter when done:",
      initial: cur.outScope.join(", "),
      separator: /[,\n]/,
    },
  ], { onCancel: () => { console.log(chalk.yellow("\n↩ Cancelled.\n")); return true; } });

  if (!ans) return;

  const clean = (arr) => Array.from(new Set((arr || []).map(s => String(s).trim()).filter(Boolean)));

  saveScope({
    notes: ans.notes || "",
    inScope: clean(ans.inScope),
    outScope: clean(ans.outScope),
  });

  const after = loadScope();
  console.log(
    neonBox([
      chalk.green("✅ Scope saved."),
      `✅ In‑Scope: ${after.inScope.length} item(s)`,
      `⛔ Out‑of‑Scope: ${after.outScope.length} item(s)`,
      chalk.gray("Tip: Flow will seed subs.txt from In‑Scope. Use --no-scope to disable.")
    ], { borderColor: "green" })
  );
  divider();
}
