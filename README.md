# GEARZ OPS — Retro Recon CLI

> A cinematic, hacker-core terminal suite for **real** bug bounty hunts.  
> Keep your neon banners, chain your tools, log every move, ship reports fast.

![banner](./.github/gearz-banner.png)

---

## ✨ What is GEARZ OPS?

**GEARZ OPS** is a purpose-built CLI that drives a complete bounty workflow with a *retro gamer aesthetic*:

- **Flow Mode** (guided 4-stage chain)  
- **Recon Mode** (quick presets)  
- **Timeline** (command history & run notes)  
- **Visualize** (ASCII kill chain)  
- **Fail-soft execution** (missing tools don’t crash the run)  
- **Dry-run** planning (see the exact commands before you fire)

The tool writes clean run artifacts to `runs/<runId>/` so you can triage, share, and report with receipts.

> ⚠️ **Scope first. Safety always.** GEARZ only acts on *public, in-scope* assets. If a target isn’t confirmed, the CLI warns and skips.

---

## 🕹 Aesthetic & Themes

Each screen uses neon banners from `utils/ui.js`:
- **Init** → `atlas`
- **Flow** → `vice`
- **Recon** → `summer`
- **Visualize** → `fruit`

No `console.clear()` anywhere. Output stacks for screenshots.

---

## 🧭 The 4-Stage Flow (bounty-tested)

**Stage 1 — Passive → `subs.txt`**  
`subfinder`, `amass`, `assetfinder`, `crtsh` (etc.)

**Stage 2 — Active → `hosts.txt`**  
`httpx`, `naabu`, `nmap`

**Stage 3 — URLs/JS → `urls.txt` (+ `js/`)**  
`gau`, `waybackurls`, `katana`, `linkfinder`

**Stage 4 — Vulns/Fuzz → logs**  
`nuclei`, `dalfox`, `ffuf`, `dirsearch`, `feroxbuster`

GEARZ orchestrates tools from `utils/tools.js` so Flow/Recon stay clean.

---

## 📦 Requirements

- **Node 18+** (built-in `fetch`)  
- UNIX-like shell (Linux/macOS/WSL). Windows users: run in **WSL**.  
- Optional third-party binaries on your `$PATH` (GEARZ detects and skips missing ones):
  - Passive: `subfinder`, `amass`, `assetfinder`, curl for crt.sh
  - Active: `httpx`, `naabu`, `nmap`
  - URLs/JS: `gau`, `waybackurls`, `katana`, `linkfinder` (Py)
  - Vulns/Fuzz: `nuclei`, `dalfox`, `ffuf`, `dirsearch`, `feroxbuster`

> Tip: GEARZ won’t crash if a binary is missing — it neon-warns, then continues.

---

## 🚀 Install & First Run

```bash
# WSL example
cd /mnt/e/gearz-cli-ops
npm i

# sanity banners
node bin/gearz.mjs init
node bin/gearz.mjs visualize

# create a run id (UTC)
export RUN="$(date -u +'%Y-%m-%dT%H-%M-%S-%3NZ')"

# dry-run plan (no scanning yet)
node bin/gearz.mjs flow --run "$RUN" --dry-run
Artifacts will land under:

runs/<runId>/
  ├─ subs.txt
  ├─ hosts.txt
  ├─ urls.txt
  ├─ *.log     (per-tool logs)
  └─ js/       (extracted JS, optional)
🧪 Free “Recon Mode” (fast presets)

# show recon presets and pick
node bin/gearz.mjs recon --run "$RUN" --dry-run
Presets and command strings live in utils/tools.js. Add your own chains there, not in Flow/Recon.

🧱 Scope Board (simple)
You can seed a scope file and pass it to Flow:

echo "example.com" > runs/$RUN/scope.txt
node bin/gearz.mjs flow --run "$RUN" --scope "runs/$RUN/scope.txt" --dry-run
GEARZ will refuse to target domains outside your provided scope.

📜 Timeline & Screenshots
Everything you run is logged:

node bin/gearz.mjs timeline --run "$RUN"
Use the stacked output for social content and internal notes. No destructive clears.

🕵️ Triage Routine (copy/paste)

# top 50 live hosts
sed -n '1,50p' "runs/$RUN/hosts.txt"

# interesting URLs (params)
grep -E '\?.*=' "runs/$RUN/urls.txt" | sort -u | sed -n '1,100p'

# quick nuclei on live hosts (example)
nuclei -l "runs/$RUN/hosts.txt" -o "runs/$RUN/nuclei-quick.log"
🛡 Fail-Soft Behavior
Missing binary? Neon warning → tool skipped → run continues.

Empty dependency file? Downstream stage auto-skips with an explanation.

SIGINT / Ctrl-C? Prompts exit cleanly; no crashes.

🧰 Extend GEARZ (the right way)
Add all tool strings & presets in utils/tools.js only.

Flow/Recon just orchestrate categories.

Logs must tee to runs/<runId>/<tool>.log.

Never write ad-hoc commands in commands/flow.js or commands/recon.js.

🧩 Troubleshooting
WSL pathing

which subfinder || echo "Install subfinder and export PATH"
Permissions

chmod +x bin/gearz.mjs
Node version

node -v   # ensure 18+
No output files?
Run with --dry-run first to confirm the plan. Then drop --dry-run.

🗺 Roadmap
Scope importer & labels

Findings markdown generator (timeline --report)

Tighter presets & tags

Optional AI mentor (paid desktop edition)

This repo is the free CLI (no AI). The paid desktop adds an on-screen assistant and one-click “Run in Shell”.

🔐 Ethics
Only test in-scope assets you have permission to assess. You are responsible for your use of this software.

📝 License
MIT — see LICENSE.

🙌 Contributing
PRs welcome. Keep the retro vibe; no console.clear(); keep commands centralized in utils/tools.js.

👤 Author
Gear
