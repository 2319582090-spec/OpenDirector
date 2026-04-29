import path from "node:path";
import { env } from "../config.js";
import { downloadFile } from "../utils/fs.js";

const PROJECT_CANVAS_BASE = "https://www.liblib.tv/canvas?projectId=";

function requireAccessKey() {
  if (!env.LIBTV_ACCESS_KEY) {
    throw new Error("未配置 LIBTV_ACCESS_KEY");
  }
  return env.LIBTV_ACCESS_KEY;
}

function headers() {
  return {
    Authorization: `Bearer ${requireAccessKey()}`,
    "Content-Type": "application/json",
  };
}

function endpoint(pathname) {
  return `${env.LIBTV_BASE_URL.replace(/\/$/u, "")}${pathname}`;
}

export function buildProjectUrl(projectUuid) {
  return projectUuid ? `${PROJECT_CANVAS_BASE}${projectUuid}` : "";
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(endpoint(pathname), {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || response.statusText;
    throw new Error(`LibTV 请求失败：${message}`);
  }
  return payload?.data || payload;
}

export async function createLibTvSession(message) {
  const data = await requestJson("/openapi/session", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  const projectUuid = data?.projectUuid || "";
  const sessionId = data?.sessionId || "";
  if (!sessionId) {
    throw new Error("LibTV 未返回 sessionId");
  }
  return {
    projectUuid,
    sessionId,
    projectUrl: buildProjectUrl(projectUuid),
  };
}

export async function queryLibTvSession(sessionId, afterSeq = 0) {
  const suffix = Number(afterSeq) > 0 ? `?afterSeq=${Number(afterSeq)}` : "";
  const data = await requestJson(`/openapi/session/${encodeURIComponent(sessionId)}${suffix}`, {
    method: "GET",
  });
  return {
    messages: Array.isArray(data?.messages) ? data.messages : [],
  };
}

function maybeJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectFromObject(value, urls = []) {
  if (!value || typeof value !== "object") return urls;
  if (Array.isArray(value)) {
    for (const item of value) collectFromObject(item, urls);
    return urls;
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && /https?:\/\/.+\.(png|jpe?g|webp|mp4|mov|webm)(\?[^"' <]*)?/iu.test(item)) {
      urls.push(item);
    } else if (item && typeof item === "object") {
      collectFromObject(item, urls);
    } else if ((key === "content" || key === "text") && typeof item === "string") {
      urls.push(...extractUrlsFromText(item));
    }
  }
  return urls;
}

export function extractUrlsFromText(text = "") {
  const matches = String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|webp|mp4|mov|webm)(?:\?[^\s"'<>]*)?/giu);
  return matches || [];
}

export function extractLibTvResult(messages = []) {
  const urls = [];
  let maxSeq = 0;

  for (const message of messages) {
    const seq = Number(message?.seq || message?.sequence || 0);
    if (Number.isFinite(seq)) {
      maxSeq = Math.max(maxSeq, seq);
    }

    const content = message?.content;
    if (typeof content === "string") {
      urls.push(...extractUrlsFromText(content));
      collectFromObject(maybeJson(content), urls);
    } else if (content && typeof content === "object") {
      collectFromObject(content, urls);
    }
  }

  const unique = [...new Set(urls)].filter((url) => {
    try {
      const host = new URL(url).hostname;
      return host.endsWith("liblib.art") || host.endsWith("liblib.tv") || host.endsWith("liblib.cloud");
    } catch {
      return false;
    }
  });
  const videos = unique.filter((url) => /\.(mp4|mov|webm)(?:\?|$)/iu.test(url));
  const images = unique.filter((url) => /\.(png|jpe?g|webp)(?:\?|$)/iu.test(url));
  return {
    urls: unique,
    videos,
    images,
    maxSeq,
  };
}

function fileExtension(url) {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext || ".bin";
  } catch {
    return ".bin";
  }
}

export async function downloadLibTvAssets({ jobId, outputDir, videos = [], images = [], prefix = "libtv" }) {
  const videoAssets = [];
  const imageAssets = [];

  for (const [index, url] of videos.entries()) {
    const fileName = `${prefix}-video-${String(index + 1).padStart(2, "0")}${fileExtension(url)}`;
    const localPath = path.join(outputDir, fileName);
    try {
      await downloadFile(url, localPath, { "User-Agent": "IdeaToFilm/0.1" });
      videoAssets.push({
        fileName,
        remoteUrl: url,
        url: `/media/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`,
      });
    } catch (error) {
      videoAssets.push({
        fileName,
        remoteUrl: url,
        url,
        downloadError: error.message,
      });
    }
  }

  for (const [index, url] of images.entries()) {
    const fileName = `${prefix}-image-${String(index + 1).padStart(2, "0")}${fileExtension(url)}`;
    const localPath = path.join(outputDir, fileName);
    try {
      await downloadFile(url, localPath, { "User-Agent": "IdeaToFilm/0.1" });
      imageAssets.push({
        fileName,
        remoteUrl: url,
        url: `/media/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`,
      });
    } catch (error) {
      imageAssets.push({
        fileName,
        remoteUrl: url,
        url,
        downloadError: error.message,
      });
    }
  }

  return {
    videoAssets,
    imageAssets,
  };
}
