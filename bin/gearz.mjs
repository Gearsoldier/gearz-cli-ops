#!/usr/bin/env node

// bin/gearz.mjs
import { runAliasCommand } from "../commands/alias.js";
import { runFlowCommand } from "../commands/flow.js";
import { runTimelineCommand } from "../commands/timeline.js";
import { runUpdateCommand } from "../commands/update.js";
import { runInit } from "../commands/init.js";
import { runVisualize } from "../commands/visualize.js";
import { runRecon } from "../commands/recon.js";
import { runScope } from "../commands/scope.js"; // existing
import { runFindingsCommand } from "../commands/findings.js"; // NEW

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "alias":
      await runAliasCommand(args.slice(1));
      break;
    case "flow":
      await runFlowCommand(args.slice(1));
      break;
    case "timeline":
      await runTimelineCommand(args.slice(1));
      break;
    case "update":
      await runUpdateCommand();
      break;
    case "visualize":
      await runVisualize();
      break;
    case "recon":
      await runRecon(args.slice(1));
      break;
    case "scope":
      await runScope(args.slice(1));
      break;
    case "findings": // NEW: manual findings aggregation
      await runFindingsCommand(args.slice(1));
      break;
    case "init":
    default:
      await runInit();
      break;
  }
}

main().catch((e) => {
  console.error("❌ Unhandled error:", e);
  process.exit(1);
});
