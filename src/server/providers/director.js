import { env } from "../config.js";
import {
  buildFallbackStory,
  createScenePlan,
  extractFirstJsonObject,
  normalizeDurationSeconds,
  sanitizeStory,
} from "../utils/story.js";
import { buildCreativeWorkspace } from "../workspace-steps.js";

function buildPrompt({ idea, style, targetSeconds, plan }) {
  return [
    `请把用户想法整理成一个 ${targetSeconds} 秒中文短片的导演简报。`,
    `用户原始想法：${idea}`,
    `风格：${style}`,
    `镜头数量：${plan.sceneCount}`,
    `每个镜头时长：${plan.sceneDurationSeconds} 秒`,
    "输出必须是 JSON，不要代码块，不要额外解释。",
    "JSON 结构：",
    JSON.stringify(
      {
        title: "短片标题",
        summary: "一句话故事梗概",
        narration: "整条片子的中文旁白草案",
        libtvTask: "给 LibTV 的任务摘要，保留用户原始意图，不堆砌提示词",
        characters: [
          {
            id: "character-1",
            name: "角色/演员名称",
            description: "角色设定、外形、气质、服装、表演方向",
            libtvPrompt: "给 LibTV 生成角色设定图的任务",
          },
        ],
        locations: [
          {
            id: "location-1",
            name: "场景名称",
            description: "空间、氛围、灯光、时代和美术方向",
            libtvPrompt: "给 LibTV 生成场景概念图的任务",
          },
        ],
        props: [
          {
            id: "prop-1",
            name: "道具名称",
            description: "道具外观、材质、叙事作用",
            libtvPrompt: "给 LibTV 生成道具设定图的任务",
          },
        ],
        scenes: [
          {
            id: 1,
            title: "镜头标题",
            durationSeconds: plan.sceneDurationSeconds,
            visualPrompt: "简短镜头画面说明",
            visualDescription: "给人看的中文分镜说明",
            voiceover: "该镜头旁白",
          },
        ],
        shots: [
          {
            id: "shot-1",
            name: "分镜名称",
            description: "分镜画面、角色动作、景别、情绪",
            camera: "镜头运动和景别",
            voiceover: "该分镜旁白",
            durationSeconds: plan.sceneDurationSeconds,
            libtvPrompt: "给 LibTV 生成分镜故事板或单镜头预览的任务",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

async function callOpenRouter(prompt) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("未配置 OPENROUTER_API_KEY");
  }

  const baseUrl = env.OPENROUTER_BASE_URL.replace(/\/$/u, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "你是 AI 导演工作台的剧本和调度 agent。只输出 JSON。",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1800,
      temperature: 0.7,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`GPT-5.4 调用失败：${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").join("\n");
  }
  throw new Error("GPT-5.4 没有返回文本内容");
}

export async function generateDirectorBrief({ idea, style = "电影感", durationSeconds = 60 }) {
  const targetSeconds = normalizeDurationSeconds(durationSeconds);
  const plan = createScenePlan(targetSeconds, "dashscope");
  const fallback = buildFallbackStory({
    idea,
    style,
    targetSeconds,
    sceneCount: plan.sceneCount,
    sceneDurationSeconds: plan.sceneDurationSeconds,
  });
  const prompt = buildPrompt({ idea, style, targetSeconds, plan });
  const content = await callOpenRouter(prompt);
  const parsed = extractFirstJsonObject(content);
  const story = sanitizeStory({ ...parsed, source: `openrouter:${env.OPENROUTER_MODEL}` }, fallback, plan);
  const workspace = buildCreativeWorkspace({
    candidate: parsed,
    story,
    idea,
    style,
  });

  return {
    story: {
      ...story,
      libtvTask: String(parsed?.libtvTask || idea).trim(),
    },
    workspace,
    plan: {
      ...plan,
      targetSeconds,
    },
    provider: `openrouter:${env.OPENROUTER_MODEL}`,
  };
}
