import chalk from "chalk";
import figlet from "figlet";
import readline from "readline";

const themes = ["🕶️ Dark Mode", "💻 Hacker Green", "🌈 Terminal Pride", "☀️ Light Mode"];

export function runStyleMode() {
  console.log(chalk.magenta(figlet.textSync("STYLE MODE", { horizontalLayout: "default" })));
  console.log(chalk.yellow("🎨 Select a theme for your GEARZ CLI session:\n"));

  themes.forEach((theme, index) => {
    console.log(`${chalk.cyan(`[${index + 1}]`)} ${theme}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(chalk.green("\nEnter your choice: "), (answer) => {
    const choice = parseInt(answer);
    if (!isNaN(choice) && choice >= 1 && choice <= themes.length) {
      console.log(chalk.blue(`\n✨ Theme applied: ${themes[choice - 1]}`));
    } else {
      console.log(chalk.red("\n❌ Invalid selection. Try again next time."));
    }
    rl.close();
  });
}
