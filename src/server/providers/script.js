import { env } from "../config.js";
import {
  buildFallbackStory,
  createScenePlan,
  extractFirstJsonObject,
  normalizeDurationSeconds,
  sanitizeStory,
} from "../utils/story.js";
import { normalizeRunMode } from "../utils/run-mode.js";

async function callChatCompletion({ url, apiKey, model, prompt, extraHeaders = {} }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是一个影视导演工作台里的脚本 agent，只输出 JSON，不输出任何额外解释。",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1800,
      temperature: 0.7,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || "")
      .join("\n")
      .trim();
  }
  throw new Error("脚本模型没有返回文本内容");
}

function buildStoryPrompt({ idea, style, targetSeconds, plan }) {
  return [
    `请把下面的想法改写成一个 ${targetSeconds} 秒的中文短片 JSON 提案。`,
    `想法：${idea}`,
    `风格：${style}`,
    `镜头数量：${plan.sceneCount}`,
    `每个镜头时长：${plan.sceneDurationSeconds} 秒`,
    "必须保持同一个主角、同一个情绪弧线和统一的视觉风格。",
    "输出 JSON，结构严格如下：",
    JSON.stringify(
      {
        title: "短片标题",
        summary: "一句话总结",
        narration: "整条片子的总旁白",
        scenes: [
          {
            id: 1,
            title: "镜头标题",
            durationSeconds: plan.sceneDurationSeconds,
            visualPrompt: "给视频模型的英文提示词，必须包含镜头语义、角色、环境、摄影信息",
            visualDescription: "给人看的中文说明",
            voiceover: "这个镜头对应的中文旁白",
          },
        ],
      },
      null,
      2,
    ),
    "只输出 JSON，不要代码块。",
  ].join("\n");
}

export async function generateStory({ idea, style = "电影感", durationSeconds, runMode = "api" }) {
  const mode = normalizeRunMode(runMode, "api");
  const targetSeconds = normalizeDurationSeconds(durationSeconds);
  const preferredVideo =
    mode === "local"
      ? "fallback"
      : env.DASHSCOPE_API_KEY
        ? "dashscope"
        : env.RUNWAY_API_KEY
          ? "runway"
          : "fallback";
  const plan = createScenePlan(targetSeconds, preferredVideo === "runway" ? "runway" : "dashscope");
  const fallback = buildFallbackStory({
    idea,
    style,
    targetSeconds,
    sceneCount: plan.sceneCount,
    sceneDurationSeconds: plan.sceneDurationSeconds,
  });
  const prompt = buildStoryPrompt({ idea, style, targetSeconds, plan });

  if (mode === "local") {
    return { story: fallback, plan, provider: "local-template" };
  }

  if (env.NOVA_API_KEY) {
    try {
      const content = await callChatCompletion({
        url: `${env.NOVA_BASE_URL.replace(/\/$/u, "")}/chat/completions`,
        apiKey: env.NOVA_API_KEY,
        model: env.NOVA_TEXT_MODEL,
        prompt,
      });
      const parsed = extractFirstJsonObject(content);
      const story = sanitizeStory({ ...parsed, source: `nova:${env.NOVA_TEXT_MODEL}` }, fallback, plan);
      return { story, plan, provider: `nova:${env.NOVA_TEXT_MODEL}` };
    } catch (error) {
      // Continue to OpenRouter fallback.
    }
  }

  if (env.OPENROUTER_API_KEY) {
    try {
      const content = await callChatCompletion({
        url: "https://openrouter.icu/v1/chat/completions",
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        prompt,
      });
      const parsed = extractFirstJsonObject(content);
      const story = sanitizeStory({ ...parsed, source: `openrouter:${env.OPENROUTER_MODEL}` }, fallback, plan);
      return { story, plan, provider: `openrouter:${env.OPENROUTER_MODEL}` };
    } catch (error) {
      // Continue to DashScope fallback.
    }
  }

  if (env.DASHSCOPE_API_KEY) {
    try {
      const content = await callChatCompletion({
        url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        apiKey: env.DASHSCOPE_API_KEY,
        model: env.DASHSCOPE_TEXT_MODEL,
        prompt,
      });
      const parsed = extractFirstJsonObject(content);
      const story = sanitizeStory({ ...parsed, source: `dashscope:${env.DASHSCOPE_TEXT_MODEL}` }, fallback, plan);
      return { story, plan, provider: `dashscope:${env.DASHSCOPE_TEXT_MODEL}` };
    } catch (error) {
      // Continue to local fallback.
    }
  }

  return { story: fallback, plan, provider: "local-template" };
}
