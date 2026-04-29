import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GENERATED_DIR, JOBS_DIR } from "./config.js";
import { ensureDir, writeJson, readJson } from "./utils/fs.js";

const jobs = new Map();
let loaded = false;

function createId() {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function jobFilePath(jobId) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

export function jobDirectory(jobId) {
  return path.join(GENERATED_DIR, jobId);
}

export function toMediaUrl(jobId, relativePath) {
  const segments = String(relativePath)
    .split(path.sep)
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/media/${encodeURIComponent(jobId)}/${segments}`;
}

async function persistJob(job) {
  await writeJson(jobFilePath(job.id), job);
}

export async function loadJobs() {
  if (loaded) {
    return jobs;
  }

  await ensureDir(JOBS_DIR);
  const files = await fs.readdir(JOBS_DIR);
  for (const fileName of files) {
    if (!fileName.endsWith(".json")) continue;
    const payload = await readJson(path.join(JOBS_DIR, fileName));
    if (payload?.id) {
      jobs.set(payload.id, payload);
    }
  }
  loaded = true;
  return jobs;
}

export async function createJob(input) {
  await loadJobs();

  const id = createId();
  const now = new Date().toISOString();
  const job = {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input,
    progress: {
      stage: "queued",
      percent: 0,
      label: "任务已创建，等待开始",
    },
    providers: {
      script: null,
      libtv: null,
      voice: null,
      video: null,
      timeline: "remotion",
      export: "ffmpeg",
    },
    plan: null,
    story: null,
    workspace: null,
    assets: {
      jobDirUrl: `/media/${encodeURIComponent(id)}/`,
      introCard: null,
      outroCard: null,
      narrationAudio: null,
      subtitles: null,
      finalVideo: null,
      sceneVideos: [],
      libtvImages: [],
      libtvVideos: [],
    },
    external: {
      libtv: null,
    },
    logs: [],
    error: null,
  };

  jobs.set(id, job);
  await ensureDir(jobDirectory(id));
  await persistJob(job);
  return job;
}

export async function getJob(jobId) {
  await loadJobs();
  return jobs.get(jobId) || null;
}

export async function listJobs() {
  await loadJobs();
  return [...jobs.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function mutateJob(jobId, mutator) {
  const current = await getJob(jobId);
  if (!current) {
    throw new Error(`任务不存在：${jobId}`);
  }

  const next = structuredClone(current);
  await mutator(next);
  next.updatedAt = new Date().toISOString();
  jobs.set(jobId, next);
  await persistJob(next);
  return next;
}

export async function appendJobLog(jobId, stage, message, meta = {}) {
  return mutateJob(jobId, (job) => {
    job.logs.push({
      at: new Date().toISOString(),
      stage,
      message,
      ...meta,
    });
  });
}
