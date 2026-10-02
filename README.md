# 🕹️ GEARZ OPS
## Retro recon, organized in your terminal

GEARZ OPS is an experimental Node.js CLI for planning authorized security-tool workflows, running selected tools, and keeping their output together. It combines a neon terminal interface with a shared tool registry, interactive scope notes, command history, and lightweight findings summaries.

**Status: development prototype.** Scope controls are advisory, shell commands use unvalidated input, and tool failures can be masked by pipelines. Read the [safety notes](#safety-and-data-handling) before running any workflow.

## What it does

- **Flow:** build a four-stage plan, review tool selections, and optionally execute them in order
- **Recon:** select a discovery preset or save a custom tool selection
- **Scope Board:** record in-scope and out-of-scope items and copy them into run folders
- **Findings:** collect parameter names, endpoint lines, high/critical Nuclei output, and interesting paths
- **Timeline:** inspect command history and manage stored runs
- **Terminal presentation:** colorful banners and a static ASCII workflow diagram

This repository contains the local CLI. It does not implement an AI assistant or a desktop application. Files for payload, report, style, and vault features exist, but the current entry point does not expose those commands.

## Safety and data handling

- Run tools only against assets you own or have explicit, current authorization to assess. Public availability is not permission.
- **Scope is not enforced end to end.** Confirmation prompts record your acknowledgment; `outScope` entries are not automatically applied as a target filter. Discovery and crawling can produce hosts outside the approved scope.
- **Treat inputs as trusted shell input.** Domains, paths, run IDs, and other values are interpolated into command strings executed with `shell: true`. Do not accept untrusted input, paste shell metacharacters, or expose this CLI as a shared service.
- Review discovered hosts and URLs before active probing, crawling, vulnerability scanning, or content discovery. A preset name does not establish that its actions are allowed.
- Commands and output are stored in `command-history.json` and `runs/`. They can contain private targets, tokens, headers, or findings. Review and redact them before sharing screenshots or files.
- The repository currently tracks dependency files, environment configuration, and historical run artifacts. Their presence does not grant permission to reuse targets or disclose data. Review local configuration and `git status` carefully before committing anything.

## Requirements

- Node.js and npm compatible with [`package-lock.json`](package-lock.json). The locked dependency engine ranges require at least Node.js 20.5; Node 18 is insufficient for Commander 14 and Ink 6.
- Linux or WSL with Bash and GNU-style command-line utilities. Commands use tools such as `timeout`, `xargs -a`, `awk`, `sed`, `sort`, `tee`, and `jq`; macOS may require equivalents and command adjustments.
- An interactive terminal and write access to the repository directory
- Only the third-party tools needed for your chosen workflow, installed separately and available on `PATH`

The registry includes subfinder, Amass, assetfinder, curl/crt.sh, ProjectDiscovery httpx, Naabu, Nmap, gau, waybackurls, Katana, LinkFinder, Nuclei, Dalfox, ffuf, dirsearch, and feroxbuster. Python's HTTPX package is not the ProjectDiscovery executable.

Some entries have additional requirements: LinkFinder expects Python 3 and an importable `linkfinder` module; ffuf and feroxbuster use a hard-coded SecLists wordlist path. Review [`utils/tools.js`](utils/tools.js) before installing or selecting tools.

## Install and inspect

Run commands from the repository root. Some files are resolved relative to the current directory and others relative to the source tree.

```bash
git clone https://github.com/Gearsoldier/gearz-cli-ops.git
cd gearz-cli-ops
npm ci

# Local inspection only; these commands do not launch reconnaissance
node bin/gearz.mjs visualize
node bin/gearz.mjs scope --show
node bin/gearz.mjs alias
```

Use `node bin/gearz.mjs <command>` throughout. The package has no `bin` mapping that installs a global `gearz` command.

**No general help command is implemented.** No command, an unknown command, or `--help` falls through to `init`, which is an interactive setup flow rather than a read-only help screen.

### Optional local setup

`node bin/gearz.mjs init` checks for tool binaries, creates local working directories, and writes `.env.gearz` from interactive answers. It can overwrite an existing configuration file, so back up any settings you need first.

Flow auto-loads the current directory's `.env.gearz`; Recon does not. Review the file before loading it into a shell. Do not source unfamiliar configuration or put secrets in tracked files.

Key settings include:

- `RPS`: passed to selected tools that implement a rate flag; it is not a global request limit
- `KATANA_TIMEOUT`, `NUCLEI_TIMEOUT`, and `NUCLEI_SEV`: selected crawler/scanner settings
- `GEARZ_RETRIES`, `GEARZ_BACKOFF_MS`, and `GEARZ_BACKOFF_FACTOR`: retry behavior for nonzero exits with matching rate-limit or timeout text
- `RATE_DELAY_MS`: delay between Flow tools
- `GEARZ_SKIP`: comma-separated patterns used in selected URL filters, not an authorization boundary
- `XBB`: optional HTTP header used by selected tool commands

## Plan before executing

Flow groups tools into passive discovery, active probing, URL/JavaScript collection, and vulnerability/content-discovery stages.

```bash
# Interactive planning; keep --dry-run while reviewing the command strings
node bin/gearz.mjs flow --run local-plan --dry-run

# Recon planning with an automatically generated run ID
node bin/gearz.mjs recon --dry-run
```

Use a plain, authorized domain when prompted. For an offline planning walkthrough, `example.invalid` is a reserved placeholder; never remove `--dry-run` for that example.

Dry runs skip the selected reconnaissance tool commands, but can still create run folders, copy scope files, seed `subs.txt`, save an interactively requested preset, and perform local binary checks. They are not a no-write mode.

Removing `--dry-run` starts real tool execution. Review every generated command and each tool's options first. The shell pipelines are not a security sandbox.

### Scope Board

`node bin/gearz.mjs scope` opens the interactive editor. The board is stored in `scope.json` with `inScope`, `outScope`, `notes`, and `updatedAt` fields.

- `scope --show`: display the current board
- `scope --export <file>`: write a copy
- `scope --import <file>`: replace the board; add `--merge` to combine entries
- `scope --clear`: immediately replace the board with empty lists

Flow normally copies the board and seeds `subs.txt` from its in-scope entries. `--no-scope` disables that copying/seeding. Recon's `--from-scope` offers a target picker.

Flow does **not** parse a `--scope` flag. Some tool builders accept a file path entered at the target prompt, but that is input expansion rather than allowlist enforcement. Recon also does not honor `--run`; it creates a new timestamped run.

## Commands and artifacts

The active entry point supports `init`, `flow`, `recon`, `scope`, `findings`, `timeline`, `alias`, `visualize`, and `update`.

Useful inspection and reporting commands:

```bash
# List saved custom presets; this is not a list of built-in presets
node bin/gearz.mjs recon --list-presets

# Replace the placeholder with an existing local run ID
node bin/gearz.mjs timeline --run RUN_ID
node bin/gearz.mjs findings --run RUN_ID
```

`findings` writes or replaces files under the chosen run's `findings/` directory. Flow also aggregates findings after execution. These summaries use simple text matching, not a validated vulnerability-report format.

Depending on the tools selected, a run may contain:

- `subs.txt`, `hosts.txt`, and `urls.txt`: intermediate discovery output
- `<tool>.log`: streamed stdout and stderr
- Tool-specific files such as `nuclei.txt`, `dalfox.txt`, and `linkfinder.txt`
- `js/`: downloaded JavaScript when that collection step runs
- `scope.json`, `in-scope.txt`, and `out-of-scope.txt`: copied scope notes
- `findings/`: derived text files and `summary.json`

Timeline includes archive, restore, history cleanup, and permanent-delete actions. Read its prompts carefully and keep backups of anything you need. The `update` command runs `git pull origin main` in the current working directory; it is not just an update check.

## Current limitations

- **Partial tool checks:** a missing primary executable or a missing declared input can cause a step to be skipped. Secondary dependencies and every input format are not checked.
- **Exit status reliability:** pipelines lack comprehensive `pipefail` handling, and some commands deliberately end successfully after an error. A green completion message does not establish that a tool succeeded.
- **Tool compatibility:** external tool versions are not pinned, and generated flags may need updates. Inspect logs and verify behavior against the version installed.
- **Data flow:** some presets start downstream stages without producing required inputs. A tool may therefore skip or use previously prepared artifacts.
- **Registry mismatch:** the built-in vulnerability preset references `sqlmap`, but no matching tool entry is registered.
- **Target filtering:** Katana and Nuclei prefer a nonempty `hosts_scoped.txt` if one exists; the current Flow/Recon code does not generate that filtered file.
- **Validation:** there is no automated test suite or lint/build script. `npm test` is the default placeholder that deliberately exits with an error. Installation and interactive tool execution still need separate verification.

## Project map

- [`bin/gearz.mjs`](bin/gearz.mjs): command dispatch
- [`commands/flow.js`](commands/flow.js): staged planning and execution
- [`commands/recon.js`](commands/recon.js): reconnaissance presets and selection
- [`utils/tools.js`](utils/tools.js): tool command builders and built-in presets
- [`utils/runTool.js`](utils/runTool.js): execution, logs, history, and retries
- [`utils/scope.js`](utils/scope.js): scope storage and run copies
- [`utils/presets.js`](utils/presets.js): custom preset storage
- [`commands/findings.js`](commands/findings.js): lightweight aggregation
- [`commands/timeline.js`](commands/timeline.js): run and history management

## Contributing

Keep the retro terminal style and preserve readable, stacked output. Centralize shared tool definitions in `utils/tools.js`; keep orchestration in the command modules. Use synthetic fixtures and reserved domains when documenting or testing changes, and describe any external tools or network activity required to reproduce an issue.

## License status

`package.json` declares ISC, but the repository has no first-party `LICENSE` file. The earlier README's MIT statement conflicts with that metadata. The maintainer needs to clarify the intended license; this documentation does not choose or grant new license terms. Third-party dependencies retain their own licenses.

## Author

Gear
