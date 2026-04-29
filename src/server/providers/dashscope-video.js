import { env, VIDEO_SIZE } from "../config.js";
import { downloadFile } from "../utils/fs.js";

function extractTaskId(payload) {
  return payload?.output?.task_id || payload?.output?.taskId || payload?.task_id || payload?.taskId;
}

function extractTaskStatus(payload) {
  return (
    payload?.output?.task_status ||
    payload?.output?.taskStatus ||
    payload?.task_status ||
    payload?.taskStatus
  );
}

function extractVideoUrl(payload) {
  return (
    payload?.output?.video_url ||
    payload?.output?.videoUrl ||
    payload?.output?.results?.[0]?.url ||
    payload?.output?.video_urls?.[0] ||
    payload?.output?.result_url ||
    null
  );
}

async function createTask(prompt, durationSeconds) {
  const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: env.DASHSCOPE_VIDEO_MODEL,
      input: { prompt },
      parameters: {
        size: `${VIDEO_SIZE.width}*${VIDEO_SIZE.height}`,
        duration: durationSeconds,
        prompt_extend: true,
        watermark: false,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.code || response.statusText;
    throw new Error(`DashScope 创建视频任务失败：${message}`);
  }

  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error("DashScope 没有返回 task_id");
  }

  return taskId;
}

async function pollTask(taskId) {
  const deadline = Date.now() + 1000 * 60 * 20;
  while (Date.now() < deadline) {
    const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.message || payload?.code || response.statusText;
      throw new Error(`DashScope 轮询失败：${message}`);
    }

    const status = extractTaskStatus(payload);
    if (status === "SUCCEEDED") {
      const videoUrl = extractVideoUrl(payload);
      if (!videoUrl) {
        throw new Error("DashScope 已成功但没有返回视频地址");
      }
      return videoUrl;
    }
    if (status === "FAILED" || status === "CANCELED") {
      const message = payload?.output?.message || payload?.message || `任务状态：${status}`;
      throw new Error(`DashScope 视频生成失败：${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 8000));
  }

  throw new Error("DashScope 视频生成超时");
}

export async function generateDashScopeVideo({ prompt, durationSeconds, outputPath }) {
  if (!env.DASHSCOPE_API_KEY) {
    throw new Error("未配置 DASHSCOPE_API_KEY");
  }

  const taskId = await createTask(prompt, durationSeconds);
  const videoUrl = await pollTask(taskId);
  await downloadFile(videoUrl, outputPath);
  return {
    provider: "dashscope",
    taskId,
    remoteUrl: videoUrl,
  };
}
