const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function writeFileIfMissing(filePath, content) {
  if (!fileExists(filePath)) {
    writeFile(filePath, content);
  }
}

function readJson(filePath, fallback = null) {
  if (!fileExists(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listDirectories(dirPath) {
  if (!fileExists(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readText(filePath, fallback = "") {
  if (!fileExists(filePath)) {
    return fallback;
  }

  return fs.readFileSync(filePath, "utf8");
}

function appendText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf8");
}

module.exports = {
  appendText,
  ensureDir,
  fileExists,
  listDirectories,
  readJson,
  readText,
  writeFile,
  writeFileIfMissing,
  writeJson,
};

