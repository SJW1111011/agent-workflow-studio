import * as fs from "node:fs";
import * as path from "node:path";

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath: fs.PathLike): boolean {
  return fs.existsSync(filePath);
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function writeFileIfMissing(filePath: string, content: string): void {
  if (!fileExists(filePath)) {
    writeFile(filePath, content);
  }
}

function readJson<T = unknown>(filePath: string, fallback: T | null = null): T | null {
  if (!fileExists(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown): void {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listDirectories(dirPath: string): string[] {
  if (!fileExists(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function readText(filePath: string, fallback = ""): string {
  if (!fileExists(filePath)) {
    return fallback;
  }

  return fs.readFileSync(filePath, "utf8");
}

function appendText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf8");
}

export {
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
