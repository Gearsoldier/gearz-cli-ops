// utils/tools.js
import fs from "fs";

// Categories
export const TOOL_CATEGORIES = {
  Passive: "🛰  Passive Recon",
  Active: "🎮 Active Recon",
  URLs: "📜 URL & JS Harvest",
  Vulns: "💥 Vulnerability Scanners",
  Bruteforce: "🗂  Dir & File Discovery",
};

// Shared filenames per run
export function buildCtx(runPath) {
  return {
    runPath,
    subsFile: `${runPath}/subs.txt`,
    hostsFile: `${runPath}/hosts.txt`,
    hostsScopedFile: `${runPath}/hosts_scoped.txt`,
    urlsFile: `${runPath}/urls.txt`,
    jsDir: `${runPath}/js`,
    rootsFile: `${runPath}/scope_urls.txt`,
  };
}

/**
 * Env-driven options:
 *  - export XBB="User-Agent: BugBounty-Harman"   ← Harman requires user-agent note
 *  - export RPS=10
 *  - export GEARZ_SKIP="/feedback,/support"
 *  - export KATANA_TIMEOUT=600
 *  - export NUCLEI_TIMEOUT=900
 *  - export NUCLEI_SEV="medium,high,critical"
 *  - export DALFOX_WORKERS=120
 *  - export DALFOX_TIMEOUT=8
 */
const H = '${XBB:+-H "$XBB"}';
const RL_KATANA = '${RPS:+-rl $RPS}';
const RL_NUCLEI = '${RPS:+-rate-limit $RPS}';
const RL_FFUF   = '${RPS:+-rate $RPS}';
const KATANA_TO = '${KATANA_TIMEOUT:-600}';
const NUCLEI_TO = '${NUCLEI_TIMEOUT:-900}';
// Default now includes medium per our init guidance
const NUCLEI_SEV = '${NUCLEI_SEV:-medium,high,critical}';

// Build a skip filter (comma-separated tokens → single regex)
const SKIP_RE = '${GEARZ_SKIP:+$(echo "$GEARZ_SKIP" | sed "s#,#|#g" | sed "s#/#\\\\/#g")}';
function skipPipe(fileExpr) {
  return `if [ -z "$GEARZ_SKIP" ]; then cat ${fileExpr}; else cat ${fileExpr} | grep -vE "${SKIP_RE}"; fi`;
}

// Detect if the "domain" parameter is actually a file path (e.g., runs/$RUN/scope.txt)
function domainIsFile(domain) {
  try { return fs.existsSync(domain) && fs.statSync(domain).isFile(); }
  catch { return false; }
}

/**
 * Generate a shell snippet that iterates over a domains file, safely.
 * If input is a literal domain (not a file), echo it as a single line.
 */
function domainsSource(domain) {
  if (domainIsFile(domain)) {
    return `cat ${domain}`;
  }
  return `echo ${domain}`;
}

/**
 * TOOLS registry
 * requires: "subs" | "hosts" | "urls"
 */
export const TOOLS = [
  // ───────── Passive → subs.txt
  {
    id: "subfinder", cat: "Passive", label: "subfinder", desc: "Passive subdomain finder",
    build: (domain, ctx) => {
      // Use -dL if a file of domains, otherwise -d
      if (domainIsFile(domain)) {
        return `subfinder -dL ${domain} -silent | sort -u | tee ${ctx.subsFile}`;
      }
      return `subfinder -d ${domain} -silent | sort -u | tee ${ctx.subsFile}`;
    }
  },

  {
    id: "amass", cat: "Passive", label: "amass", desc: "Deep subdomain enum",
    build: (domain, ctx) => {
      if (domainIsFile(domain)) {
        return `amass enum -passive -df ${domain} | sort -u | tee -a ${ctx.subsFile}`;
      }
      return `amass enum -passive -d ${domain} | sort -u | tee -a ${ctx.subsFile}`;
    }
  },

  {
    id: "assetfinder", cat: "Passive", label: "assetfinder", desc: "Related domains",
    build: (domain, ctx) => {
      if (domainIsFile(domain)) {
        // Loop through each domain in the file
        return `xargs -a ${domain} -I{} assetfinder {} | sort -u | tee -a ${ctx.subsFile}`;
      }
      return `assetfinder ${domain} | sort -u | tee -a ${ctx.subsFile}`;
    }
  },

  {
    id: "crtsh", cat: "Passive", label: "curl (crt.sh)", desc: "Cert transparency",
    build: (domain, ctx) => {
      if (domainIsFile(domain)) {
        return `while read -r d; do curl -s ${H} "https://crt.sh/?q=%25.$d&output=json" | jq -r '.[].name_value' 2>/dev/null; done < ${domain} | sed 's/\\*\\.//g' | sort -u | tee -a ${ctx.subsFile}`;
      }
      return `curl -s ${H} "https://crt.sh/?q=%25.${domain}&output=json" | jq -r '.[].name_value' | sed 's/\\*\\.//g' | sort -u | tee -a ${ctx.subsFile}`;
    }
  },

  // ───────── Active → hosts.txt
  { id: "httpx", cat: "Active", label: "httpx", desc: "Probe live hosts", requires: ["subs"],
    build: (_d, ctx) => `cat ${ctx.subsFile} | httpx -silent -status-code -title -ip ${H} | tee ${ctx.hostsFile}` },

  { id: "naabu", cat: "Active", label: "naabu", desc: "Fast port scan", requires: ["subs"],
    build: (_d, ctx) => `naabu -list ${ctx.subsFile} -no-color | tee ${ctx.runPath}/naabu.txt` },

  { id: "nmap", cat: "Active", label: "nmap", desc: "Service detection", requires: ["subs"],
    build: (_d, ctx) => `nmap -Pn -sV -T4 -iL ${ctx.subsFile} -oN ${ctx.runPath}/nmap.txt` },

  // ───────── URLs & JS → urls.txt (+ js dir)
  {
    id: "gau", cat: "URLs", label: "gau", desc: "URLs from archives",
    build: (domain, ctx) => {
      if (fs.existsSync(ctx.rootsFile)) {
        return `awk '{print $0}' ${ctx.rootsFile} | gau | sort -u | tee ${ctx.urlsFile}`;
      }
      // Feed domains list appropriately
      if (domainIsFile(domain)) {
        // modern gau flag is --subs (not -subs)
        return `${domainsSource(domain)} | xargs -I{} gau --subs {} | sort -u | tee ${ctx.urlsFile}`;
      }
      return `gau --subs ${domain} | sort -u | tee ${ctx.urlsFile}`;
    }
  },

  {
    id: "waybackurls", cat: "URLs", label: "waybackurls", desc: "Wayback URLs",
    build: (domain, ctx) => {
      if (fs.existsSync(ctx.rootsFile)) {
        return `while read -r u; do printf "%s\\n" "$u" | waybackurls; done < ${ctx.rootsFile} | sort -u | tee -a ${ctx.urlsFile}`;
      }
      return `${domainsSource(domain)} | waybackurls | sort -u | tee -a ${ctx.urlsFile}`;
    }
  },

  // Katana: prefer scoped hosts if present; guard with timeout and missing-output check
  { id: "katana", cat: "URLs", label: "katana", desc: "High‑perf crawler", requires: ["hosts"],
    build: (_d, ctx) => {
      const out = `${ctx.runPath}/katana.txt`;
      return `HF="${ctx.hostsFile}"; [ -s "${ctx.hostsScopedFile}" ] && HF="${ctx.hostsScopedFile}"; ` +
             `timeout ${KATANA_TO}s katana -list "$HF" -jc -aff -fs -d 1 -ct 10 ${RL_KATANA} ${H} -o ${out} || echo "[katana] timed out after ${KATANA_TO}s"; ` +
             `if [ -s "${out}" ]; then ${skipPipe(out)} | sort -u | tee -a ${ctx.urlsFile}; else echo "[katana] no output file (${out})"; fi`;
    }
  },

  // Download JS then parse endpoints.
  { id: "linkfinder", cat: "URLs", label: "python3 (LinkFinder)", desc: "Endpoints in JS",
    build: (_d, ctx) =>
      `mkdir -p ${ctx.jsDir}; ` +
      // Use awk to avoid grep's ERE quirks around '?'
      `${skipPipe(ctx.urlsFile)} | awk 'tolower(\$0) ~ /\\.js(\\?|$)/' | sort -u > ${ctx.runPath}/js_urls.txt; ` +
      `while read -r u; do [ -z "$u" ] && continue; f="${ctx.jsDir}/$(echo "$u" | sed 's#https\\?://##; s#[^A-Za-z0-9._-]#_#g')"; curl -sSL ${H} "$u" -o "$f"; done < ${ctx.runPath}/js_urls.txt; ` +
      `if python3 -c "import linkfinder" 2>/dev/null; then ` +
        `if ls ${ctx.jsDir}/*.js >/dev/null 2>&1; then ` +
          `python3 -m linkfinder -i ${ctx.jsDir}/*.js -o cli | sort -u | tee ${ctx.runPath}/linkfinder.txt; ` +
        `else ` +
          `echo "[linkfinder] no JS files to analyze" | tee ${ctx.runPath}/linkfinder.txt; ` +
        `fi; ` +
      `else ` +
        `echo "[linkfinder] python module not installed (pip install 'git+https://github.com/GerbenJavado/LinkFinder.git')" | tee ${ctx.runPath}/linkfinder.txt; ` +
      `fi`
  },

  // ───────── Vulns — strict http-only with timeout, single rate-limit flag
  {
    id: "nuclei", cat: "Vulns", label: "nuclei", desc: "Template vuln scan (scoped/fast)", requires: ["hosts"],
    build: (_d, ctx) =>
      `HF="${ctx.hostsFile}"; [ -s "${ctx.hostsScopedFile}" ] && HF="${ctx.hostsScopedFile}"; ` +
      `echo "[nuclei] targets → $HF"; ` +
      `timeout ${NUCLEI_TO}s nuclei -l "$HF" ${H} ${RL_NUCLEI} -type http -severity ${NUCLEI_SEV} ` +
      `-c 50 -bulk-size 25 -timeout 5 -retries 1 -stats -stats-interval 10 ` +
      `| tee ${ctx.runPath}/nuclei.txt; ` +
      `RC=$?; [ $RC -ne 0 ] && echo "[nuclei] exited with code $RC (timeout or early stop)"; true`
  },

  // Dalfox (default, polite)
  {
    id: "dalfox", cat: "Vulns", label: "dalfox", desc: "XSS scanning (URLs)", requires: ["urls"],
    build: (_d, ctx) =>
      // Use awk to detect '?' (no grep warnings)
      `${skipPipe(ctx.urlsFile)} | awk 'index($0,"?")' > ${ctx.runPath}/urls_with_params.txt; ` +
      `dalfox file ${ctx.runPath}/urls_with_params.txt ${H} --silence --mass | tee ${ctx.runPath}/dalfox.txt`
  },

  // Dalfox FAST variant for the preset
  {
    id: "dalfox_fast", cat: "Vulns", label: "dalfox (fast)", desc: "XSS quick triage", requires: ["urls"],
    build: (_d, ctx) =>
      `${skipPipe(ctx.urlsFile)} | awk 'index($0,"?")' > ${ctx.runPath}/urls_with_params.txt; ` +
      `DALFOX_W=\${DALFOX_WORKERS:-120}; DALFOX_TO=\${DALFOX_TIMEOUT:-8}; ` +
      `dalfox file ${ctx.runPath}/urls_with_params.txt ${H} --silence --mass --only-poc v ` +
      `--skip-mining-all --skip-bav --fast-scan -w "$DALFOX_W" --timeout "$DALFOX_TO" ` +
      `| tee ${ctx.runPath}/dalfox.txt`
  },

  // ───────── Bruteforce (off by default for Harman; kept for targeted use)
  {
    id: "ffuf", cat: "Bruteforce", label: "ffuf", desc: "Dir & file fuzz", requires: ["hosts"],
    build: (_d, ctx) =>
      `URL=$(awk '{print $1}' ${ctx.hostsFile} | head -n1); ` +
      `if [ -z "$URL" ]; then echo "No hosts found in ${ctx.hostsFile}. Run Active stage first." >&2; exit 1; fi; ` +
      `ffuf -w /usr/share/seclists/Discovery/Web-Content/raft-small-words.txt -u "$URL/FUZZ" ${H} ${RL_FFUF} -mc 200,302,401 | tee ${ctx.runPath}/ffuf.txt`
  },

  { id: "dirsearch", cat: "Bruteforce", label: "dirsearch", desc: "Content discovery", requires: ["hosts"],
    build: (_d, ctx) => `dirsearch -l ${ctx.hostsFile} -x 404 -o ${ctx.runPath}/dirsearch.txt` },

  {
    id: "feroxbuster", cat: "Bruteforce", label: "feroxbuster", desc: "Recursive brute", requires: ["hosts"],
    build: (_d, ctx) =>
      `URL=$(awk '{print $1}' ${ctx.hostsFile} | head -n1); ` +
      `if [ -z "$URL" ]; then echo "No hosts found in ${ctx.hostsFile}. Run Active stage first." >&2; exit 1; fi; ` +
      `feroxbuster -u "$URL" -w /usr/share/seclists/Discovery/Web-Content/raft-small-words.txt -r | tee ${ctx.runPath}/ferox.txt`
  },
];

// Presets
export const PRESETS = {
  "👾 Passive Sweep":     ["subfinder","amass","assetfinder","crtsh"],
  "🚀 Active Mapping":    ["httpx","naabu","nmap"],
  "🧩 URL & JS Harvest":  ["gau","waybackurls","katana","linkfinder"],
  "💣 Vuln Quick Triage": ["nuclei","dalfox","sqlmap"],
  "🪓 Bust It Open":      ["ffuf","dirsearch","feroxbuster"],

  // Your one‑click preset
  "🧩 URL & JS Harvest + Fast Dalfox": ["gau","waybackurls","katana","linkfinder","dalfox_fast"],
};
