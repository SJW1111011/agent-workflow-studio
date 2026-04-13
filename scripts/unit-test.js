const path = require("path");
const { spawnSync } = require("child_process");

const vitestCli = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
const result = spawnSync(process.execPath, [vitestCli, "run", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error && result.error.stack ? result.error.stack : result.error);
  process.exitCode = 1;
} else if (typeof result.status === "number") {
  process.exitCode = result.status;
} else {
  process.exitCode = 1;
}
