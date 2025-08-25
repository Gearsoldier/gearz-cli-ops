// commands/visualize.js
import chalk from "chalk";
import { banner, neonBox } from "../utils/ui.js";

export function runVisualize() {
  banner("KILL CHAIN", "ANSI Shadow");
  console.log(
    neonBox(
      [
        chalk.yellow("🛰  Recon   →  🎯 Payload  →  🧠 Exploit  →  💣 Report"),
        chalk.gray("ASCII visual (v1.0)"),
        "",
        "    ┌─────┐     ┌──────┐     ┌─────────┐     ┌──────┐",
        "    │Recon│───▶│Payload│───▶│Exploit  │───▶│Report│",
        "    └─────┘     └──────┘     └─────────┘     └──────┘",
      ],
      { borderColor: "magenta" }
    )
  );
}
