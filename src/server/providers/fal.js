import { env, VIDEO_SIZE } from "../config.js";
import { downloadFile } from "../utils/fs.js";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const POLL_INTERVAL_MS = 7000;
const DEFAULT_TIMEOUT_MS = 1000 * 60 * 20;

function getFalHeaders() {
  if (!env.FAL_API_KEY) {
    throw new Error("未配置 FAL_API_KEY");
  }

  return {
    Authorization: `Key ${env.FAL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function normalizeFalModel(modelId) {
  return String(modelId || "").replace(/^\/+|\/+$/gu, "");
}

function modelQueueUrl(modelId) {
  return `${FAL_QUEUE_BASE}/${normalizeFalModel(modelId)}`;
}

function buildAspectRatio() {
  return `${VIDEO_SIZE.width}:${VIDEO_SIZE.height}`;
}

function extractErrorMessage(payload, fallback) {
  return (
    payload?.detail ||
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    fallback
  );
}

async function submitFalRequest(modelId, input) {
  const response = await fetch(modelQueueUrl(modelId), {
    method: "POST",
    headers: getFalHeaders(),
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`fal 提交任务失败：${extractErrorMessage(payload, response.statusText)}`);
  }

  const requestId = payload?.request_id;
  if (!requestId) {
    throw new Error("fal 没有返回 request_id");
  }

  return {
    requestId,
    statusUrl: payload?.status_url || `${modelQueueUrl(modelId)}/requests/${requestId}/status`,
    responseUrl: payload?.response_url || `${modelQueueUrl(modelId)}/requests/${requestId}`,
  };
}

async function pollFalResult({ statusUrl, responseUrl }) {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const statusResponse = await fetch(statusUrl, {
      headers: getFalHeaders(),
    });
    const statusPayload = await statusResponse.json().catch(() => ({}));

    if (!statusResponse.ok) {
      throw new Error(`fal 轮询失败：${extractErrorMessage(statusPayload, statusResponse.statusText)}`);
    }

    const status = statusPayload?.status;
    if (status === "COMPLETED") {
      const resultResponse = await fetch(responseUrl, {
        headers: getFalHeaders(),
      });
      const resultPayload = await resultResponse.json().catch(() => ({}));
      if (!resultResponse.ok) {
        throw new Error(`fal 获取结果失败：${extractErrorMessage(resultPayload, resultResponse.statusText)}`);
      }
      return resultPayload;
    }

    if (status === "FAILED") {
      throw new Error(`fal 任务失败：${extractErrorMessage(statusPayload, "unknown error")}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("fal 任务超时");
}

function extractVideoUrl(payload) {
  return (
    payload?.video?.url ||
    payload?.videos?.[0]?.url ||
    payload?.output?.video?.url ||
    payload?.output?.videos?.[0]?.url ||
    null
  );
}

function extractImageUrl(payload) {
  return (
    payload?.images?.[0]?.url ||
    payload?.image?.url ||
    payload?.output?.images?.[0]?.url ||
    payload?.output?.image?.url ||
    null
  );
}

export async function generateFalVideo({ prompt, durationSeconds, outputPath }) {
  const modelId = env.FAL_VIDEO_MODEL;
  const { requestId, statusUrl, responseUrl } = await submitFalRequest(modelId, {
    prompt,
    duration: durationSeconds,
    aspect_ratio: buildAspectRatio(),
    resolution: "720p",
  });

  const payload = await pollFalResult({ statusUrl, responseUrl });
  const remoteUrl = extractVideoUrl(payload);
  if (!remoteUrl) {
    throw new Error("fal 已完成，但没有返回视频地址");
  }

  await downloadFile(remoteUrl, outputPath);
  return {
    provider: "fal",
    taskId: requestId,
    remoteUrl,
    model: modelId,
  };
}

export async function generateFalImage({ prompt, outputPath }) {
  const modelId = env.FAL_IMAGE_MODEL;
  const { requestId, statusUrl, responseUrl } = await submitFalRequest(modelId, {
    prompt,
    aspect_ratio: buildAspectRatio(),
    output_format: "png",
    num_images: 1,
  });

  const payload = await pollFalResult({ statusUrl, responseUrl });
  const remoteUrl = extractImageUrl(payload);
  if (!remoteUrl) {
    throw new Error("fal 已完成，但没有返回图片地址");
  }

  await downloadFile(remoteUrl, outputPath);
  return {
    provider: "fal-image",
    taskId: requestId,
    remoteUrl,
    model: modelId,
  };
}
