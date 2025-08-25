// utils/ui.js
import boxen from "boxen";
import chalk from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";

export const termWidth = () => (process.stdout.columns || 80);
export const divider = (w = Math.min(72, termWidth() - 4)) =>
  console.log(chalk.gray("─".repeat(w)));

export function center(text) {
  const width = termWidth();
  return text
    .split("\n")
    .map((line) => {
      const len = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      const pad = Math.max(0, Math.floor((width - len) / 2));
      return " ".repeat(pad) + line;
    })
    .join("\n");
}

const THEMES = {
  atlas: gradient.atlas,
  summer: gradient.summer,   // gold/green
  vice: gradient.vice,       // pink/blue
  fruit: gradient.fruit,     // magenta/orange
  pastel: gradient.pastel,
};

export function banner(title = "GEARZ OPS", font = "ANSI Shadow", theme = "atlas") {
  let ascii;
  try {
    ascii = figlet.textSync(title, { font, horizontalLayout: "fitted" });
  } catch {
    ascii = figlet.textSync(title, { horizontalLayout: "fitted" });
  }
  const paint = THEMES[theme] || THEMES.atlas;
  console.log(center(paint(ascii)));
}

export function neonBox(lines, opts = {}) {
  const content = Array.isArray(lines) ? lines.join("\n") : String(lines);
  return boxen(content, {
    padding: { top: 1, right: 3, bottom: 1, left: 3 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: opts.borderColor || "cyan",
    float: "center",
    ...opts,
  });
}

export function infoList(items) {
  const body = items.map((l) => chalk.gray("• ") + chalk.white(l)).join("\n");
  console.log(neonBox(body, { borderColor: "gray" }));
}
