// utils/scope.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const scopePath = path.resolve(rootDir, "scope.json");

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJsonSafe(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export function loadScope() {
  const data = readJsonSafe(scopePath, { inScope: [], outScope: [], notes: "", updatedAt: null });
  data.inScope = Array.from(new Set((data.inScope || []).map(s => String(s).trim()).filter(Boolean)));
  data.outScope = Array.from(new Set((data.outScope || []).map(s => String(s).trim()).filter(Boolean)));
  return data;
}

export function saveScope({ inScope = [], outScope = [], notes = "" }) {
  const now = new Date().toISOString();
  writeJsonSafe(scopePath, {
    inScope: Array.from(new Set(inScope.map(s => String(s).trim()).filter(Boolean))),
    outScope: Array.from(new Set(outScope.map(s => String(s).trim()).filter(Boolean))),
    notes: String(notes || ""),
    updatedAt: now,
  });
}

export function clearScope() {
  writeJsonSafe(scopePath, { inScope: [], outScope: [], notes: "", updatedAt: new Date().toISOString() });
}

export function exportScope(filePath) {
  const data = loadScope();
  writeJsonSafe(path.resolve(filePath), data);
}

export function importScope(filePath, { overwrite = true } = {}) {
  const src = readJsonSafe(path.resolve(filePath), null);
  if (!src || !Array.isArray(src.inScope) || !Array.isArray(src.outScope)) throw new Error("Invalid scope file");
  if (overwrite) {
    saveScope(src);
  } else {
    // merge
    const cur = loadScope();
    saveScope({
      inScope: Array.from(new Set([...(cur.inScope || []), ...(src.inScope || [])])),
      outScope: Array.from(new Set([...(cur.outScope || []), ...(src.outScope || [])])),
      notes: (cur.notes || "") + (src.notes ? ("\n" + src.notes) : ""),
    });
  }
}

export function copyScopeToRun(runPath) {
  const s = loadScope();
  try {
    fs.mkdirSync(runPath, { recursive: true });
    fs.writeFileSync(path.join(runPath, "scope.json"), JSON.stringify(s, null, 2));
    fs.writeFileSync(path.join(runPath, "in-scope.txt"), (s.inScope || []).join("\n"));
    fs.writeFileSync(path.join(runPath, "out-of-scope.txt"), (s.outScope || []).join("\n"));
  } catch { /* ignore */ }
}

export function seedSubsFromScope(runPath) {
  try {
    const inFile = path.join(runPath, "in-scope.txt");
    const subsFile = path.join(runPath, "subs.txt");
    if (!fs.existsSync(inFile)) return 0;
    const lines = fs.readFileSync(inFile, "utf-8")
      .split("\n").map(s => s.trim()).filter(Boolean)
      .filter(s => /[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)); // rough domain check
    if (!lines.length) return 0;

    const existing = fs.existsSync(subsFile)
      ? fs.readFileSync(subsFile, "utf-8").split("\n").map(s=>s.trim()).filter(Boolean)
      : [];
    const merged = Array.from(new Set([...lines, ...existing]));
    fs.writeFileSync(subsFile, merged.join("\n") + "\n");
    return lines.length;
  } catch {
    return 0;
  }
}
