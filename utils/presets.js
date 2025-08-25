// utils/presets.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const presetPath = path.resolve(rootDir, "presets.json");

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

export function loadPresetStore() {
  const data = readJsonSafe(presetPath, { presets: [] });
  if (!data || !Array.isArray(data.presets)) return { presets: [] };
  // normalize tags
  for (const p of data.presets) {
    if (!Array.isArray(p.tags)) p.tags = [];
  }
  return data;
}

export function savePresetStore(data) {
  // ensure tags arrays
  for (const p of data.presets || []) {
    if (!Array.isArray(p.tags)) p.tags = [];
  }
  writeJsonSafe(presetPath, data);
}

export function listPresets({ filterTag } = {}) {
  const all = loadPresetStore().presets;
  if (!filterTag) return all;
  return all.filter(p => (p.tags || []).map(t=>String(t).toLowerCase()).includes(String(filterTag).toLowerCase()));
}

export function getPresetByName(name) {
  const all = listPresets();
  return all.find(p => p.name.toLowerCase() === String(name).toLowerCase());
}

export function upsertPreset({ name, ids, notes, tags }) {
  const store = loadPresetStore();
  const now = new Date().toISOString();
  const existingIdx = store.presets.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  const normTags = Array.isArray(tags) ? tags : (typeof tags === "string" ? tags.split(",").map(s=>s.trim()).filter(Boolean) : []);
  if (existingIdx >= 0) {
    store.presets[existingIdx] = {
      ...store.presets[existingIdx],
      ids: Array.from(new Set(ids)),
      notes: notes ?? store.presets[existingIdx].notes,
      tags: normTags.length ? Array.from(new Set(normTags)) : (store.presets[existingIdx].tags || []),
      updatedAt: now,
    };
  } else {
    store.presets.push({
      name,
      ids: Array.from(new Set(ids)),
      notes: notes || "",
      tags: Array.from(new Set(normTags)),
      createdAt: now,
      updatedAt: now,
    });
  }
  savePresetStore(store);
}

export function renamePreset(oldName, newName) {
  const store = loadPresetStore();
  const idx = store.presets.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
  if (idx < 0) return false;
  store.presets[idx].name = newName;
  store.presets[idx].updatedAt = new Date().toISOString();
  savePresetStore(store);
  return true;
}

export function deletePreset(name) {
  const store = loadPresetStore();
  const before = store.presets.length;
  store.presets = store.presets.filter(p => p.name.toLowerCase() !== name.toLowerCase());
  savePresetStore(store);
  return store.presets.length < before;
}

export function tagPreset(name, tagsCSV) {
  const store = loadPresetStore();
  const idx = store.presets.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (idx < 0) return false;
  const tags = (tagsCSV || "").split(",").map(s=>s.trim()).filter(Boolean);
  store.presets[idx].tags = Array.from(new Set([...(store.presets[idx].tags || []), ...tags]));
  store.presets[idx].updatedAt = new Date().toISOString();
  savePresetStore(store);
  return true;
}

export function exportPresets(filePath) {
  const store = loadPresetStore();
  writeJsonSafe(path.resolve(filePath), store);
}

export function importPresets(filePath, { merge = true, overwrite = false } = {}) {
  const src = readJsonSafe(path.resolve(filePath), null);
  if (!src || !Array.isArray(src.presets)) throw new Error("Invalid preset file");
  if (!merge) {
    savePresetStore(src);
    return { imported: src.presets.length, merged: false, overwritten: 0 };
  }
  const store = loadPresetStore();
  let overwritten = 0;
  for (const p of src.presets) {
    const existing = store.presets.find(x => x.name.toLowerCase() === p.name.toLowerCase());
    if (existing) {
      if (overwrite) {
        existing.ids = Array.from(new Set(p.ids || []));
        existing.notes = p.notes || existing.notes || "";
        existing.tags = Array.from(new Set(p.tags || []));
        existing.updatedAt = new Date().toISOString();
        overwritten++;
      }
    } else {
      store.presets.push({
        name: p.name,
        ids: Array.from(new Set(p.ids || [])),
        notes: p.notes || "",
        tags: Array.from(new Set(p.tags || [])),
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      });
    }
  }
  savePresetStore(store);
  return { imported: src.presets.length, merged: true, overwritten };
}
