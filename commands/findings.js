// commands/findings.js
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { banner, neonBox, divider } from "../utils/ui.js";

function latestRunId(runsDir) {
  const items = fs.readdirSync(runsDir).filter((d) => fs.statSync(path.join(runsDir, d)).isDirectory());
  return items.sort().slice(-1)[0];
}

function readLines(p) {
  try { return fs.readFileSync(p, "utf8").split("\n").filter(Boolean); } catch { return []; }
}

function uniq(xs) { return Array.from(new Set(xs)); }

export function aggregateFindings(runPath) {
  const fdir = path.join(runPath, "findings");
  fs.mkdirSync(fdir, { recursive: true });

  const urlsFile = path.join(runPath, "urls.txt");
  const linkfinderFile = path.join(runPath, "linkfinder.txt");
  const nucleiFile = path.join(runPath, "nuclei.txt");
  const ffufFile = path.join(runPath, "ffuf.txt");
  const dirsearchFile = path.join(runPath, "dirsearch.txt");

  // Params
  const params = [];
  readLines(urlsFile).forEach((u) => {
    const q = u.split("?")[1];
    if (!q) return;
    q.split("&").forEach((p) => {
      const name = p.split("=")[0];
      if (name) params.push(name);
    });
  });
  const uniqParams = uniq(params).sort();
  fs.writeFileSync(path.join(fdir, "unique_params.txt"), uniqParams.join("\n"));

  // Endpoints from LinkFinder
  const endpoints = uniq(readLines(linkfinderFile)).sort();
  fs.writeFileSync(path.join(fdir, "endpoints.txt"), endpoints.join("\n"));

  // High/Critical nuclei hits
  const highCrit = uniq(
    readLines(nucleiFile).filter((l) => /\b(high|critical)\b/i.test(l))
  );
  fs.writeFileSync(path.join(fdir, "nuclei_high_critical.txt"), highCrit.join("\n"));

  // Interesting paths from ffuf/dirsearch
  const interestingPaths = uniq(
    readLines(ffufFile)
      .concat(readLines(dirsearchFile))
      .filter((l) => /\/[A-Za-z0-9._\-\/]+/.test(l))
  );
  fs.writeFileSync(path.join(fdir, "interesting_paths.txt"), interestingPaths.join("\n"));

  // Summary
  const summary = {
    params: uniqParams.length,
    endpoints: endpoints.length,
    nuclei_high_critical: highCrit.length,
    interesting_paths: interestingPaths.length,
  };
  fs.writeFileSync(path.join(fdir, "summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}

export async function runFindingsCommand(args = []) {
  const runsDir = path.resolve(process.cwd(), "runs");
  const idx = args.indexOf("--run");
  const chosen = idx >= 0 ? args[idx + 1] : null;
  const rid = chosen || latestRunId(runsDir);
  if (!rid) {
    console.log(chalk.yellow("No runs found."));
    return;
  }
  const runPath = path.join(runsDir, rid);
  banner("FINDINGS", "ANSI Shadow", "fruit");
  const s = aggregateFindings(runPath);

  console.log(
    neonBox(
      [
        chalk.white(`📁 runs/${rid}/findings`),
        "",
        `🔎 Unique params: ${chalk.cyan(s.params)}`,
        `🔗 Endpoints (LinkFinder): ${chalk.cyan(s.endpoints)}`,
        `🚨 Nuclei High/Critical: ${chalk.cyan(s.nuclei_high_critical)}`,
        `🧭 Interesting paths: ${chalk.cyan(s.interesting_paths)}`,
        "",
        chalk.gray("Use these files to drive targeted follow‑ups (dalfox/sqlmap/fuzz)."),
      ],
      { borderColor: "magenta" }
    )
  );
  divider();
}
