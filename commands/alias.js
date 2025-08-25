// commands/alias.js
import fs from "fs";
import path from "path";
import chalk from "chalk";
import prompts from "prompts";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aliasFile = path.resolve(__dirname, "../aliases.json");

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJsonSafe(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function loadAliases() {
  return readJsonSafe(aliasFile, {});
}

function saveAlias(name, command) {
  const aliases = loadAliases();
  aliases[name] = command;
  writeJsonSafe(aliasFile, aliases);
}

function removeAlias(name) {
  const aliases = loadAliases();
  if (!(name in aliases)) return false;
  delete aliases[name];
  writeJsonSafe(aliasFile, aliases);
  return true;
}

function clearAliases() {
  writeJsonSafe(aliasFile, {});
}

function listAliases() {
  const aliases = loadAliases();
  if (Object.keys(aliases).length === 0) {
    console.log(chalk.yellow("⚠️  No aliases saved yet."));
    return;
  }
  console.log(chalk.green("🔗 Saved Aliases:\n"));
  for (const [name, cmd] of Object.entries(aliases)) {
    console.log(`${chalk.cyan(name)}: ${chalk.yellow(cmd)}`);
  }
}

export async function runAliasCommand(args = []) {
  const sub = args[0];

  if (sub === "--add" && args.length >= 3) {
    const name = args[1];
    const command = args.slice(2).join(" ");
    saveAlias(name, command);
    console.log(chalk.green(`✅ Alias saved as '${name}'`));
    return;
  }

  if (sub === "--remove" && args.length >= 2) {
    const name = args[1];
    const ok = removeAlias(name);
    if (ok) console.log(chalk.green(`🗑  Removed alias '${name}'`));
    else console.log(chalk.yellow(`⚠️  Alias '${name}' not found.`));
    return;
  }

  if (sub === "--clear") {
    const ans = await prompts({
      type: "confirm",
      name: "yes",
      message: "This will delete ALL aliases. Continue?",
      initial: false,
    });
    if (!ans.yes) {
      console.log(chalk.yellow("↩ Cancelled. No changes made."));
      return;
    }
    clearAliases();
    console.log(chalk.green("🧹 Cleared all aliases."));
    return;
  }

  // default: list
  listAliases();
}
