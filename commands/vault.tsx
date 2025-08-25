import fs from "fs";
import inquirer from "inquirer";

const VAULT_FILE = "./vault/notes.json";

export const runVault = async () => {
  if (!fs.existsSync("./vault")) fs.mkdirSync("./vault");

  const { action } = await inquirer.prompt([
    { type: "list", name: "action", message: "Vault Action:", choices: ["Save Note", "View Notes"] }
  ]);

  if (action === "Save Note") {
    const { content } = await inquirer.prompt([{ type: "input", name: "content", message: "Enter your payload or note:" }]);
    const data = fs.existsSync(VAULT_FILE) ? JSON.parse(fs.readFileSync(VAULT_FILE)) : [];
    data.push({ content, timestamp: Date.now() });
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2));
    console.log("✅ Saved to vault.");
  } else {
    const data = fs.existsSync(VAULT_FILE) ? JSON.parse(fs.readFileSync(VAULT_FILE)) : [];
    console.log("🔐 Vault Contents:");
    data.forEach((item, i) => console.log(`${i + 1}. ${item.content}`));
  }
};
