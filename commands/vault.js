import chalk from "chalk";
import fs from "fs";
import path from "path";
import readline from "readline";
import figlet from "figlet";

const VAULT_FILE = path.resolve("vault.json");

export function runVault() {
  console.log(chalk.green(figlet.textSync("GEARZ VAULT", { horizontalLayout: "default" })));
  console.log(chalk.cyan("🔐 Accessing your payload vault...\n"));

  if (!fs.existsSync(VAULT_FILE)) {
    fs.writeFileSync(VAULT_FILE, JSON.stringify([]));
  }

  const vault = JSON.parse(fs.readFileSync(VAULT_FILE, "utf8"));

  if (vault.length === 0) {
    console.log(chalk.gray("🗃️ Vault is empty. Add your first entry:\n"));
    addNewEntry();
  } else {
    console.log(chalk.yellow("📦 Vault contents:\n"));
    vault.forEach((entry, index) => {
      console.log(`${chalk.cyan(`[${index + 1}]`)} ${entry.title} (${entry.date})`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(
      chalk.green("\n➕ Add new entry? (y/n): "),
      (answer) => {
        if (answer.trim().toLowerCase() === "y") {
          rl.close();
          addNewEntry();
        } else {
          console.log(chalk.gray("\n🛑 Exiting vault.\n"));
          rl.close();
        }
      }
    );
  }
}

function addNewEntry() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(chalk.yellow("🔖 Title: "), (title) => {
    rl.question(chalk.yellow("📋 Content: "), (content) => {
      const vault = JSON.parse(fs.readFileSync(VAULT_FILE, "utf8"));
      vault.push({
        title,
        content,
        date: new Date().toISOString()
      });
      fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
      console.log(chalk.green("\n✅ Entry saved to vault."));
      rl.close();
    });
  });
}
