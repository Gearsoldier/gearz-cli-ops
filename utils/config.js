import fs from "fs";

const CONFIG_PATH = ".gearzrc";

export const saveConfig = (data) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
};

export const loadConfig = () => {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH));
};
