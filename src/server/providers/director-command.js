import { env } from "../config.js";
import { buildCreativeWorkspace } from "../workspace-steps.js";
import {
  buildFallbackStory,
  createScenePlan,
  extractFirstJsonObject,
  sanitizeStory,
} from "../utils/story.js";

function compactAssets(item = {}) {
  const selectedImage = item.selectedAssets?.image?.remoteUrl || item.selectedAssets?.image?.url || "";
  const selectedVideo = item.selectedAssets?.video?.remoteUrl || item.selectedAssets?.video?.url || "";
  const imageUrls = [
    selectedImage,
    ...(item.assets?.images || []).map((asset) => asset.remoteUrl || asset.url),
    ...(item.libtv?.resultUrls || []).filter((url) => /\.(png|jpe?g|webp)(?:\?|$)/iu.test(url)),
  ].filter(Boolean);
  const videoUrls = [
    selectedVideo,
    ...(item.assets?.videos || []).map((asset) => asset.remoteUrl || asset.url),
    ...(item.libtv?.resultUrls || []).filter((url) => /\.(mp4|mov|webm)(?:\?|$)/iu.test(url)),
  ].filter(Boolean);
  return {
    imageCount: imageUrls.length,
    videoCount: videoUrls.length,
    referenceImages: [...new Set(imageUrls)].slice(0, 2),
    referenceVideos: [...new Set(videoUrls)].slice(0, 1),
  };
}

function compactItem(item = {}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    libtvPrompt: item.libtvPrompt,
    durationSeconds: item.durationSeconds,
    voiceover: item.voiceover,
    camera: item.camera,
    status: item.status,
    assets: compactAssets(item),
  };
}

function compactWorkspace(workspace = {}) {
  return {
    characters: (workspace.characters || []).map(compactItem),
    locations: (workspace.locations || []).map(compactItem),
    props: (workspace.props || []).map(compactItem),
    shots: (workspace.shots || []).map(compactItem),
  };
}

function buildPrompt({ job, command }) {
  const context = {
    input: job.input,
    story: job.story,
    workspace: compactWorkspace(job.workspace || {}),
    finalVideo: job.assets?.finalVideo?.remoteUrl || job.assets?.finalVideo?.url || null,
  };

  return [
    "你是 AI 导演 Agent 的上下文调度器。用户会用自然语言修改短片，你要把它变成可执行的导演工作台状态。",
    "你只负责调度：剧本、角色/演员、场景、道具、分镜、配音、配乐、剪辑、最终成片应该如何串起来。",
    "LibTV 负责实际生成、配音、配乐、剪辑和成片；GPT 负责整理上下文和下一步指令。",
    "保留现有卡片 id。用户没有要求改变的内容尽量保留。用户要求改变的地方要改到对应卡片里。",
    "如果已有素材链接，把它们作为参考写进 libtvFinalTask，但不要强行要求本地路径。",
    "输出必须是 JSON，不要代码块，不要额外解释。",
    `用户最新自然语言指令：${command}`,
    "当前项目上下文：",
    JSON.stringify(context, null, 2),
    "JSON 结构：",
    JSON.stringify(
      {
        directorReply: "用一句话告诉用户你调度了什么",
        story: {
          title: "短片标题",
          summary: "故事梗概",
          narration: "整条片子的旁白草案",
          libtvTask: "给 LibTV 的成片任务摘要",
          scenes: [
            {
              id: 1,
              title: "镜头标题",
              durationSeconds: 8,
              visualPrompt: "镜头画面说明",
              visualDescription: "给人看的分镜说明",
              voiceover: "该镜头旁白",
            },
          ],
        },
        workspace: {
          characters: [
            {
              id: "character-1",
              name: "角色/演员名称",
              description: "角色设定",
              libtvPrompt: "交给 LibTV 生成角色参考的任务",
            },
          ],
          locations: [
            {
              id: "location-1",
              name: "场景名称",
              description: "场景设定",
              libtvPrompt: "交给 LibTV 生成场景参考的任务",
            },
          ],
          props: [
            {
              id: "prop-1",
              name: "道具名称",
              description: "道具设定",
              libtvPrompt: "交给 LibTV 生成道具参考的任务",
            },
          ],
          shots: [
            {
              id: "shot-1",
              name: "分镜名称",
              description: "分镜设定",
              camera: "镜头运动和景别",
              voiceover: "旁白",
              durationSeconds: 8,
              libtvPrompt: "交给 LibTV 生成分镜或镜头预览的任务",
            },
          ],
        },
        libtvFinalTask: "给 LibTV 的完整成片任务：包含故事、角色、场景、道具、分镜、配音、配乐、剪辑节奏、最终输出要求；要求返回可访问视频链接",
        nextActions: ["下一步动作"],
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
          content: "你是 AI 导演工作台的上下文调度 agent。只输出 JSON。",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2600,
      temperature: 0.55,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`GPT-5.4 调度失败：${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").join("\n");
  }
  throw new Error("GPT-5.4 没有返回调度文本");
}

function sameCreativeText(a = {}, b = {}) {
  return (
    String(a.name || "") === String(b.name || "") &&
    String(a.description || "") === String(b.description || "") &&
    String(a.libtvPrompt || "") === String(b.libtvPrompt || "")
  );
}

function preserveGeneratedState(nextWorkspace, previousWorkspace = {}) {
  const sections = ["characters", "locations", "props", "shots"];
  for (const section of sections) {
    const previousItems = previousWorkspace[section] || [];
    const byId = new Map(previousItems.map((item) => [item.id, item]));
    nextWorkspace[section] = (nextWorkspace[section] || []).map((item) => {
      const previous = byId.get(item.id);
      if (!previous) return item;
      if (sameCreativeText(item, previous)) {
        return {
          ...item,
          status: previous.status,
          libtv: previous.libtv,
          assets: previous.assets,
          selectedAssets: previous.selectedAssets,
        };
      }
      return {
        ...item,
        status: "draft",
        libtv: null,
        assets: { images: [], videos: [] },
      };
    });
  }
  return nextWorkspace;
}

function collectReferenceLines(workspace = {}) {
  const lines = [];
  for (const [section, items] of Object.entries(compactWorkspace(workspace))) {
    for (const item of items) {
      for (const url of item.assets.referenceImages || []) {
        lines.push(`${section}/${item.name} 参考图：${url}`);
      }
      for (const url of item.assets.referenceVideos || []) {
        lines.push(`${section}/${item.name} 参考视频：${url}`);
      }
    }
  }
  return lines;
}

export async function generateDirectorCommandPlan({ job, command }) {
  const prompt = buildPrompt({ job, command });
  const content = await callOpenRouter(prompt);
  const parsed = extractFirstJsonObject(content);
  const targetSeconds = Number(job.input?.durationSeconds || 60);
  const plan = job.plan || createScenePlan(targetSeconds, "dashscope");
  const fallback = job.story || buildFallbackStory({
    idea: job.input?.idea,
    style: job.input?.style,
    targetSeconds,
    sceneCount: plan.sceneCount,
    sceneDurationSeconds: plan.sceneDurationSeconds,
  });
  const story = sanitizeStory(parsed.story || parsed, fallback, plan);
  const workspace = preserveGeneratedState(
    buildCreativeWorkspace({
      candidate: parsed.workspace || parsed,
      story,
      idea: job.input?.idea,
      style: job.input?.style,
    }),
    job.workspace,
  );
  const referenceLines = collectReferenceLines(workspace);
  const libtvFinalTask = [
    String(parsed.libtvFinalTask || story.libtvTask || job.input?.idea || "").trim(),
    "",
    "最终输出要求：请用 LibTV 完成配音、配乐、节奏剪辑、镜头串联，并输出一条可预览的完整成片视频链接。",
    "配音：使用中文旁白，情绪贴合故事。",
    "配乐：根据故事氛围自动选择，不要盖住旁白。",
    "剪辑：按分镜顺序串联，保持角色、场景、道具一致。",
    referenceLines.length ? `可用参考素材：\n${referenceLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    directorReply: String(parsed.directorReply || "已根据你的自然语言指令重新调度。").trim(),
    story: {
      ...story,
      libtvTask: String(parsed.story?.libtvTask || story.libtvTask || job.input?.idea || "").trim(),
    },
    workspace,
    libtvFinalTask,
    nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
    provider: `openrouter:${env.OPENROUTER_MODEL}`,
  };
}
