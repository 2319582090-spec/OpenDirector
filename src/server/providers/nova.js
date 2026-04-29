import { env } from "../config.js";
import { downloadFile } from "../utils/fs.js";

function extractUrls(text) {
  if (!text) return [];
  const matches = String(text).match(/https?:\/\/[^\s)"'`<>]+/gu);
  return matches ? [...new Set(matches)] : [];
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").filter(Boolean).join("\n");
  }
  return "";
}

async function createNovaCompletion({ model, prompt }) {
  if (!env.NOVA_API_KEY) {
    throw new Error("未配置 NOVA_API_KEY");
  }

  const response = await fetch(`${env.NOVA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOVA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`Nova AI 请求失败：${message}`);
  }

  return payload;
}

export async function generateNovaImage({ prompt, outputPath }) {
  const payload = await createNovaCompletion({
    model: env.NOVA_IMAGE_MODEL,
    prompt: `Generate an image based on this prompt: ${prompt}`,
  });
  const remoteUrl = extractUrls(extractMessageContent(payload))[0];
  if (!remoteUrl) {
    throw new Error("Nova AI 已返回结果，但没有找到图片地址");
  }

  await downloadFile(remoteUrl, outputPath);
  return {
    provider: "nova-image",
    remoteUrl,
    model: env.NOVA_IMAGE_MODEL,
  };
}

export async function generateNovaVideo({ prompt, outputPath }) {
  const payload = await createNovaCompletion({
    model: env.NOVA_VIDEO_MODEL,
    prompt: `Generate a video based on this prompt: ${prompt}`,
  });
  const remoteUrl = extractUrls(extractMessageContent(payload))[0];
  if (!remoteUrl) {
    throw new Error("Nova AI 已返回结果，但没有找到视频地址");
  }

  await downloadFile(remoteUrl, outputPath);
  return {
    provider: "nova-video",
    remoteUrl,
    model: env.NOVA_VIDEO_MODEL,
  };
}
