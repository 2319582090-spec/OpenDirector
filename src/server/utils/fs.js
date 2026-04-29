import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";

export async function ensureDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  return targetDir;
}

export async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

export async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function downloadFile(url, outputPath, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`下载文件失败：${response.status} ${response.statusText}`);
  }
  await ensureDir(path.dirname(outputPath));
  await pipeline(response.body, createWriteStream(outputPath));
  return outputPath;
}

export function resolveSafePath(baseDir, ...segments) {
  const resolved = path.resolve(baseDir, ...segments);
  const normalizedBase = path.resolve(baseDir);
  if (resolved !== normalizedBase && !resolved.startsWith(`${normalizedBase}${path.sep}`)) {
    throw new Error("Invalid path");
  }
  return resolved;
}
