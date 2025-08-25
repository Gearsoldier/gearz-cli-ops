import chalk from "chalk";
import figlet from "figlet";

export function runReport() {
  console.log(chalk.green(figlet.textSync("BUG REPORT", { horizontalLayout: "default" })));
  console.log(chalk.yellow("📜 Generating ASCII-style bounty report..."));

  const mockReport = `
  🔍 Vulnerability: IDOR
  💥 Impact: Sensitive user data exposure
  🧪 PoC: curl -X GET https://target.com/api/user/123
  🛡️ Mitigation: Implement access control checks on user IDs
  `;

  console.log(chalk.cyan(mockReport));
}
