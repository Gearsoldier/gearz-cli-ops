// commands/update.js
import chalk from "chalk";
import figlet from "figlet";
import { exec } from "child_process";

export async function runUpdateCommand() {
  console.log(chalk.cyan(figlet.textSync("GEARZ UPDATER", { horizontalLayout: "default" })));
  console.log(chalk.yellow("🔄 Checking for updates..."));

  exec("git pull origin main", (error, stdout, stderr) => {
    if (error) {
      console.error(chalk.red(`❌ Update failed: ${error.message}`));
      return;
    }
    if (stderr) {
      console.error(chalk.red(`⚠️ Error: ${stderr}`));
      return;
    }
    console.log(chalk.green("✅ Update complete:\n"));
    console.log(chalk.gray(stdout));
  });
}
