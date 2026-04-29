import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import http from "node:http";
import { extname } from "node:path";
import { BRAND_NAME, PUBLIC_DIR, GENERATED_DIR, env, ensureDirectories } from "./config.js";
import { createJob, getJob, listJobs } from "./job-store.js";
import { getProviderStatus } from "./provider-status.js";
import { runGenerationJob, syncLibTvJob } from "./pipeline.js";
import { runDirectorCommand, runSectionDirectorCommand } from "./director-agent.js";
import { loadJobs } from "./job-store.js";
import { resolveSafePath } from "./utils/fs.js";
import { normalizeRunMode } from "./utils/run-mode.js";
import {
  ensureWorkspaceForJob,
  selectWorkspaceItemAsset,
  submitWorkspaceItemToLibTv,
  submitWorkspaceSuiteToLibTv,
  syncWorkspaceItemFromLibTv,
  updateWorkspaceItem,
} from "./workspace-steps.js";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".srt": "text/plain; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(body);
}

function sendText(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveFile(request, response, filePath) {
  const stats = await fs.stat(filePath);
  const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
  const range = request.headers.range;

  if (range) {
    const match = String(range).match(/^bytes=(\d*)-(\d*)$/u);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stats.size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stats.size) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stats.size,
    "Accept-Ranges": "bytes",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

async function routeApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/providers/status") {
    return sendJson(response, 200, { ok: true, providers: await getProviderStatus() });
  }

  if (request.method === "GET" && url.pathname === "/api/jobs") {
    const jobs = await listJobs();
    const needsWorkspace = jobs.filter((job) => job.story && !job.workspace).slice(0, 12);
    for (const job of needsWorkspace) {
      await ensureWorkspaceForJob(job.id);
    }
    return sendJson(response, 200, { ok: true, jobs: await listJobs() });
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const jobId = decodeURIComponent(url.pathname.replace("/api/jobs/", ""));
    let job = await getJob(jobId);
    if (!job) {
      return sendJson(response, 404, { ok: false, error: "任务不存在" });
    }
    if (job.story && !job.workspace) {
      job = await ensureWorkspaceForJob(jobId);
    }
    return sendJson(response, 200, { ok: true, job });
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    const raw = await readBody(request);
    const payload = JSON.parse(raw || "{}");
    const idea = String(payload.idea || "").trim();
    const style = String(payload.style || "电影感").trim() || "电影感";
    const durationSeconds = Number(payload.durationSeconds || 60);
    const runMode = normalizeRunMode(payload.runMode, "plan");

    if (!idea) {
      return sendJson(response, 400, { ok: false, error: "请先输入一个想法" });
    }

    const job = await createJob({
      idea,
      style,
      durationSeconds,
      runMode,
    });

    runGenerationJob(job.id).catch((error) => {
      console.error("Generation job failed", error);
    });

    return sendJson(response, 202, {
      ok: true,
      jobId: job.id,
      job,
    });
  }

  const jobSyncMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/sync-libtv$/u);
  if (request.method === "POST" && jobSyncMatch) {
    const jobId = decodeURIComponent(jobSyncMatch[1]);
    const job = await syncLibTvJob(jobId);
    return sendJson(response, 200, {
      ok: true,
      job,
    });
  }

  const directorCommandMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/director-command$/u);
  if (request.method === "POST" && directorCommandMatch) {
    const jobId = decodeURIComponent(directorCommandMatch[1]);
    const payload = JSON.parse((await readBody(request)) || "{}");
    const job = await runDirectorCommand(jobId, {
      command: payload.command,
      mode: payload.mode,
    });
    return sendJson(response, 200, {
      ok: true,
      job,
    });
  }

  const sectionCommandMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/workspace\/([^/]+)\/director-command$/u);
  if (request.method === "POST" && sectionCommandMatch) {
    const jobId = decodeURIComponent(sectionCommandMatch[1]);
    const section = decodeURIComponent(sectionCommandMatch[2]);
    const payload = JSON.parse((await readBody(request)) || "{}");
    const job = await runSectionDirectorCommand(jobId, {
      section,
      command: payload.command,
      mode: payload.mode,
    });
    return sendJson(response, 200, {
      ok: true,
      job,
    });
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/jobs\/[^/]+\/workspace\/step-suite-libtv$/u)) {
    const jobId = decodeURIComponent(url.pathname.split("/")[3]);
    const job = await submitWorkspaceSuiteToLibTv(jobId);
    return sendJson(response, 200, {
      ok: true,
      job,
    });
  }

  const workspaceMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/workspace\/([^/]+)\/([^/]+)\/([^/]+)$/u);
  if (request.method === "POST" && workspaceMatch) {
    const [, rawJobId, rawSection, rawItemId, action] = workspaceMatch;
    const jobId = decodeURIComponent(rawJobId);
    const section = decodeURIComponent(rawSection);
    const itemId = decodeURIComponent(rawItemId);
    const payload = JSON.parse((await readBody(request)) || "{}");

    if (action === "save") {
      const job = await updateWorkspaceItem(jobId, { section, itemId, item: payload.item || {} });
      return sendJson(response, 200, { ok: true, job });
    }

    if (action === "submit-libtv") {
      const job = await submitWorkspaceItemToLibTv(jobId, { section, itemId, item: payload.item || null });
      return sendJson(response, 200, { ok: true, job });
    }

    if (action === "sync-libtv") {
      const job = await syncWorkspaceItemFromLibTv(jobId, { section, itemId });
      return sendJson(response, 200, { ok: true, job });
    }

    if (action === "select-asset") {
      const job = await selectWorkspaceItemAsset(jobId, {
        section,
        itemId,
        assetType: payload.asset?.type,
        assetUrl: payload.asset?.url,
      });
      return sendJson(response, 200, { ok: true, job });
    }
  }

  return sendJson(response, 404, { ok: false, error: "接口不存在" });
}

async function routeMedia(request, response, url) {
  const relative = decodeURIComponent(url.pathname.replace(/^\/media\//u, ""));
  const safePath = resolveSafePath(GENERATED_DIR, relative);
  await serveFile(request, response, safePath);
}

async function routePublic(request, response, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = resolveSafePath(PUBLIC_DIR, requestPath.slice(1));
  await serveFile(request, response, safePath);
}

async function bootstrap() {
  await ensureDirectories();
  await loadJobs();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        response.end();
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        await routeApi(request, response, url);
        return;
      }

      if (url.pathname.startsWith("/media/")) {
        await routeMedia(request, response, url);
        return;
      }

      await routePublic(request, response, url);
    } catch (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { ok: false, error: "页面或资源不存在" });
        return;
      }
      console.error(error);
      sendJson(response, 500, { ok: false, error: error.message || "服务器错误" });
    }
  });

  server.listen(env.PORT, env.HOST, async () => {
    const host = env.HOST === "0.0.0.0" ? "127.0.0.1" : env.HOST;
    console.log(`${BRAND_NAME} 正在运行：http://${host}:${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exitCode = 1;
});
