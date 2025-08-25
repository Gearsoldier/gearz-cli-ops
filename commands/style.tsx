import inquirer from "inquirer";
import { saveConfig } from "../utils/config.js";

export const runStyleMode = async () => {
  const { theme } = await inquirer.prompt([
    { type: "list", name: "theme", message: "Choose your terminal style:", choices: ["hacker-green", "matrix-rain", "noir-purple", "blood-red"] }
  ]);

  saveConfig({ theme });
  console.log(`🎨 Theme set to ${theme}`);
};
