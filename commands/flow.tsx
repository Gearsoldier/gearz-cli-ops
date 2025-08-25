import inquirer from "inquirer";
import { runCommand } from "../utils/exec.js";

export async function runFlow() {
  console.log("🧠 Welcome to GEARZ Flow Mode — Guided Attack Path\n");

  const { target } = await inquirer.prompt([
    {
      type: "input",
      name: "target",
      message: "🎯 Enter target domain or IP:",
      default: "scanme.nmap.org"
    }
  ]);

  const steps = [
    { name: "🔍 Subdomain Scan (subfinder)", cmd: `subfinder -d ${target}` },
    { name: "🕳️ Port Scan (nmap -F)", cmd: `nmap -F ${target}` },
    { name: "🧬 JS Endpoint Extract (LinkFinder)", cmd: `python3 LinkFinder.py -i https://${target}/ -o cli` },
    { name: "💣 Fuzz Hidden Params (ffuf)", cmd: `ffuf -w /usr/share/wordlists/dirb/common.txt -u https://${target}/FUZZ` }
  ];

  for (const step of steps) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `➡️ Run ${step.name}?`,
        default: true
      }
    ]);

    if (confirm) {
      console.log(`⚙️  Executing: ${step.cmd}`);
      await runCommand(step.cmd);
    }
  }

  console.log("\n✅ Flow complete. Ready to export report or build payloads.");
}
