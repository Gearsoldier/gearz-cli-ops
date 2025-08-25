import inquirer from "inquirer";
import { runCommand } from "../utils/exec.js";

export const runPayloadBuilder = async () => {
  const { type, target } = await inquirer.prompt([
    { type: "list", name: "type", message: "Select payload type:", choices: ["XSS", "SQLi", "SSRF", "RCE"] },
    { type: "input", name: "target", message: "Target path (e.g., /login):", default: "/example" }
  ]);

  console.log(`💣 Building ${type} payload for ${target}...`);

  // Demo payload
  console.log(`💡 Suggestion: <script>alert('XSS')</script>`);
};
