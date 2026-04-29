import { env, VIDEO_SIZE } from "../config.js";
import { downloadFile } from "../utils/fs.js";

function extractRunwayOutputUrl(payload) {
  if (typeof payload?.output === "string") return payload.output;
  if (Array.isArray(payload?.output)) return payload.output[0];
  if (payload?.output?.video_url) return payload.output.video_url;
  if (payload?.output?.url) return payload.output.url;
  return null;
}

async function createRunwayTask(prompt, durationSeconds) {
  const response = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RUNWAY_API_KEY}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: env.RUNWAY_VIDEO_MODEL,
      promptText: prompt,
      ratio: VIDEO_SIZE.ratio,
      duration: durationSeconds,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`Runway 创建视频任务失败：${message}`);
  }

  const taskId = payload?.id;
  if (!taskId) {
    throw new Error("Runway 没有返回任务 ID");
  }

  return taskId;
}

async function pollRunwayTask(taskId) {
  const deadline = Date.now() + 1000 * 60 * 20;
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${env.RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || response.statusText;
      throw new Error(`Runway 轮询失败：${message}`);
    }

    if (payload?.status === "SUCCEEDED") {
      const outputUrl = extractRunwayOutputUrl(payload);
      if (!outputUrl) {
        throw new Error("Runway 已成功但没有返回视频地址");
      }
      return outputUrl;
    }

    if (payload?.status === "FAILED" || payload?.status === "CANCELLED") {
      const message = payload?.failure || payload?.error?.message || payload?.status;
      throw new Error(`Runway 视频生成失败：${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 7000));
  }

  throw new Error("Runway 视频生成超时");
}

export async function generateRunwayVideo({ prompt, durationSeconds, outputPath }) {
  if (!env.RUNWAY_API_KEY) {
    throw new Error("未配置 RUNWAY_API_KEY");
  }
  const taskId = await createRunwayTask(prompt, durationSeconds);
  const videoUrl = await pollRunwayTask(taskId);
  await downloadFile(videoUrl, outputPath);
  return {
    provider: "runway",
    taskId,
    remoteUrl: videoUrl,
  };
}
