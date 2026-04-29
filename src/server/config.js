import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
export const STORAGE_DIR = path.join(PROJECT_ROOT, "storage");
export const GENERATED_DIR = path.join(STORAGE_DIR, "generated");
export const JOBS_DIR = path.join(STORAGE_DIR, "jobs");
export const REMOTION_ENTRY = path.join(PROJECT_ROOT, "src/server/remotion/entry.jsx");
export const DOTENV_PATH = path.join(PROJECT_ROOT, ".env.local");

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const rawLine of raw.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/gu, "");
  }
  return values;
}

const dotenvValues = parseDotEnv(DOTENV_PATH);

function envValue(key, fallback = "") {
  return process.env[key] || dotenvValues[key] || fallback;
}

export const env = {
  HOST: envValue("HOST", "0.0.0.0"),
  PORT: Number(envValue("PORT", "8123")),
  OPENROUTER_BASE_URL: envValue("OPENROUTER_BASE_URL", "https://openrouter.icu/v1"),
  OPENROUTER_API_KEY: envValue("OPENROUTER_API_KEY"),
  OPENROUTER_MODEL: envValue("OPENROUTER_MODEL", "gpt-5.4"),
  LIBTV_ACCESS_KEY: envValue("LIBTV_ACCESS_KEY"),
  LIBTV_BASE_URL: envValue("OPENAPI_IM_BASE", envValue("IM_BASE_URL", "https://im.liblib.tv")),
  LIBTV_POLL_INTERVAL_MS: Number(envValue("LIBTV_POLL_INTERVAL_MS", "8000")),
  LIBTV_POLL_TIMEOUT_MS: Number(envValue("LIBTV_POLL_TIMEOUT_MS", "180000")),
  DASHSCOPE_API_KEY: envValue("DASHSCOPE_API_KEY"),
  DASHSCOPE_TEXT_MODEL: envValue("DASHSCOPE_TEXT_MODEL", "qwen-plus"),
  DASHSCOPE_VIDEO_MODEL: envValue("DASHSCOPE_VIDEO_MODEL", "wan2.6-t2v"),
  FAL_API_KEY: envValue("FAL_API_KEY"),
  FAL_VIDEO_MODEL: envValue("FAL_VIDEO_MODEL", "bytedance/seedance-2.0/fast/text-to-video"),
  FAL_IMAGE_MODEL: envValue("FAL_IMAGE_MODEL", "fal-ai/nano-banana"),
  RUNWAY_API_KEY: envValue("RUNWAY_API_KEY"),
  RUNWAY_VIDEO_MODEL: envValue("RUNWAY_VIDEO_MODEL", "gen4.5"),
  NOVA_API_KEY: envValue("NOVA_API_KEY"),
  NOVA_BASE_URL: envValue("NOVA_BASE_URL", "https://us.novaiapi.com/v1"),
  NOVA_TEXT_MODEL: envValue("NOVA_TEXT_MODEL", "[次]grok-3"),
  NOVA_VIDEO_MODEL: envValue("NOVA_VIDEO_MODEL", "grok-imagine-1.0-video"),
  NOVA_IMAGE_MODEL: envValue("NOVA_IMAGE_MODEL", "nano-banana"),
  VIDU_API_KEY: envValue("VIDU_API_KEY"),
  VIDU_VIDEO_MODEL: envValue("VIDU_VIDEO_MODEL", "vidu-q1"),
  ELEVENLABS_API_KEY: envValue("ELEVENLABS_API_KEY"),
  ELEVENLABS_VOICE_ID: envValue("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
};

export const VIDEO_SIZE = { width: 1280, height: 720, ratio: "1280:720" };
export const FPS = 30;
export const BRAND_NAME = "OpenDirector";

export async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(PUBLIC_DIR, { recursive: true }),
    fsp.mkdir(STORAGE_DIR, { recursive: true }),
    fsp.mkdir(GENERATED_DIR, { recursive: true }),
    fsp.mkdir(JOBS_DIR, { recursive: true }),
  ]);
}
