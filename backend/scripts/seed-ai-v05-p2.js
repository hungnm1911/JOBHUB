import { runAiV05P2Seed } from "../src/database/seed.js";

const args = process.argv.slice(2);

if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write("Usage: node scripts/seed-ai-v05-p2.js --dry-run|--apply\n");
  process.exitCode = 2;
} else {
  try {
    const result = await runAiV05P2Seed({ apply: args[0] === "--apply" });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.verification?.failures.length) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`AI-V05 P2 seed failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
