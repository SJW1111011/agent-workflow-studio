const fs = require("fs");
const path = require("path");

const compiledModulePath = path.join(__dirname, "..", "..", "dist", "lib", "fs-utils.js");

if (!fs.existsSync(compiledModulePath)) {
  throw new Error(
    "Missing compiled TypeScript output for src/lib/fs-utils. Run `npm run build` from the repository root."
  );
}

module.exports = require(compiledModulePath);

