import { env, ensureDirectories } from "./config.js";
import {
  appendJobLog,
  getJob,
  jobDirectory,
  mutateJob,
} from "./job-store.js";
import {
  createLibTvSession,
  downloadLibTvAssets,
  extractLibTvResult,
  queryLibTvSession,
} from "./providers/libtv.js";

const ACTIVE_STATES = new Set(["submitted", "polling"]);
const DOWNLOAD_LIMITS = {
  characters: { images: 4, videos: 1 },
  locations: { images: 4, videos: 1 },
  props: { images: 4, videos: 1 },
  shots: { images: 4, videos: 3 },
};

export const WORKSPACE_SECTIONS = {
  characters: {
    label: "角色/演员",
    prefix: "character",
    action: "生成角色设定图、演员造型参考、表情与服装方向",
  },
  locations: {
    label: "场景",
    prefix: "location",
    action: "生成场景概念图、空间气氛、灯光与色彩参考",
  },
  props: {
    label: "道具",
    prefix: "prop",
    action: "生成关键道具设定图、材质、细节与叙事用途",
  },
  shots: {
    label: "分镜",
    prefix: "shot",
    action: "生成分镜故事板或单镜头预览，保持角色、场景和道具一致",
  },
};

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asId(value, fallback) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/giu, "-")
    .replace(/^-+|-+$/gu, "") || fallback;
}

function mediaBucket(candidate = {}) {
  return {
    images: Array.isArray(candidate.images) ? candidate.images : [],
    videos: Array.isArray(candidate.videos) ? candidate.videos : [],
  };
}

function selectedAssetBucket(candidate = {}) {
  return {
    image: candidate.image || null,
    video: candidate.video || null,
  };
}

function normalizeItem(raw, fallback, section, index) {
  const meta = WORKSPACE_SECTIONS[section];
  const id = asId(raw?.id || fallback?.id, `${meta.prefix}-${index + 1}`);
  const item = {
    id,
    name: asText(raw?.name || raw?.title, fallback?.name || `${meta.label} ${index + 1}`),
    description: asText(
      raw?.description || raw?.summary || raw?.visualDescription,
      fallback?.description || "",
    ),
    libtvPrompt: asText(
      raw?.libtvPrompt || raw?.visualPrompt || raw?.prompt,
      fallback?.libtvPrompt || fallback?.prompt || fallback?.description || "",
    ),
    notes: asText(raw?.notes, fallback?.notes || ""),
    locked: Boolean(raw?.locked ?? fallback?.locked ?? false),
    status: asText(raw?.status, fallback?.status || "draft"),
    libtv: raw?.libtv || fallback?.libtv || null,
    assets: mediaBucket(raw?.assets || fallback?.assets || {}),
    selectedAssets: selectedAssetBucket(raw?.selectedAssets || fallback?.selectedAssets || {}),
  };

  if (raw?.durationSeconds || fallback?.durationSeconds) {
    item.durationSeconds = Number(raw?.durationSeconds || fallback?.durationSeconds);
  }
  if (raw?.voiceover || fallback?.voiceover) {
    item.voiceover = asText(raw?.voiceover, fallback?.voiceover || "");
  }
  if (raw?.camera || fallback?.camera) {
    item.camera = asText(raw?.camera, fallback?.camera || "");
  }
  return item;
}

function normalizeItems(rawItems, fallbackItems, section) {
  const source = Array.isArray(rawItems) && rawItems.length ? rawItems : fallbackItems;
  return source.map((raw, index) => normalizeItem(raw, fallbackItems[index] || {}, section, index));
}

function fallbackCharacters({ idea, style }) {
  return [
    {
      id: "character-1",
      name: "主角",
      description: `承载“${idea}”核心情绪的人物，造型要能一眼看出故事处境和性格压力。`,
      libtvPrompt: `根据“${idea}”生成主角角色设定图，${style}风格，清晰面部、服装、表情和全身造型参考。`,
    },
    {
      id: "character-2",
      name: "关键关系人",
      description: "推动冲突或转折的人物，与主角形成明显关系张力。",
      libtvPrompt: `根据“${idea}”生成关键关系人的演员造型参考，与主角风格统一但气质形成对比。`,
    },
  ];
}

function fallbackLocations({ idea, style }) {
  return [
    {
      id: "location-1",
      name: "主场景",
      description: `故事最重要的发生空间，要能支撑“${idea}”的情绪和动作。`,
      libtvPrompt: `为“${idea}”生成主场景概念图，${style}风格，电影灯光，空间关系清晰，无文字水印。`,
    },
    {
      id: "location-2",
      name: "转折场景",
      description: "承接剧情转折或高潮的空间，视觉上要比主场景更有压迫或释放感。",
      libtvPrompt: `为“${idea}”生成转折场景概念图，和主场景世界观一致，但情绪更强。`,
    },
  ];
}

function fallbackProps({ idea, style }) {
  return [
    {
      id: "prop-1",
      name: "核心道具",
      description: `能推动“${idea}”剧情的关键物件，最好能成为观众记住故事的视觉符号。`,
      libtvPrompt: `根据“${idea}”生成核心道具设定图，${style}风格，材质细节清楚，适合影视分镜使用。`,
    },
    {
      id: "prop-2",
      name: "情绪道具",
      description: "用于表达人物关系、回忆或秘密的辅助物件。",
      libtvPrompt: `根据“${idea}”生成情绪道具参考图，和核心道具形成叙事关联，画面干净无文字。`,
    },
  ];
}

function fallbackShots({ story, idea, style }) {
  const scenes = Array.isArray(story?.scenes) && story.scenes.length ? story.scenes : [];
  if (!scenes.length) {
    return [
      {
        id: "shot-1",
        name: "开场镜头",
        description: `建立“${idea}”的世界观和核心情绪。`,
        libtvPrompt: `为“${idea}”生成开场分镜故事板，${style}风格，16:9，电影构图。`,
      },
    ];
  }

  return scenes.map((scene, index) => ({
    id: `shot-${scene.id || index + 1}`,
    name: scene.title || `分镜 ${index + 1}`,
    description: scene.visualDescription || scene.visualPrompt || `围绕“${idea}”的第 ${index + 1} 个镜头。`,
    libtvPrompt: scene.visualPrompt || `为“${idea}”生成第 ${index + 1} 个分镜故事板，${style}风格。`,
    durationSeconds: scene.durationSeconds,
    voiceover: scene.voiceover || "",
    camera: "电影镜头语言，主体明确，运动和景别写清楚。",
  }));
}

export function buildCreativeWorkspace({ candidate = {}, story = {}, idea = "", style = "电影感" }) {
  const safeIdea = asText(idea, story.summary || "一个短片想法");
  const safeStyle = asText(style, "电影感");
  const fallback = {
    characters: fallbackCharacters({ idea: safeIdea, style: safeStyle }),
    locations: fallbackLocations({ idea: safeIdea, style: safeStyle }),
    props: fallbackProps({ idea: safeIdea, style: safeStyle }),
    shots: fallbackShots({ story, idea: safeIdea, style: safeStyle }),
  };

  return {
    version: 1,
    characters: normalizeItems(candidate.characters, fallback.characters, "characters"),
    locations: normalizeItems(candidate.locations || candidate.scenes, fallback.locations, "locations"),
    props: normalizeItems(candidate.props, fallback.props, "props"),
    shots: normalizeItems(candidate.shots || candidate.storyboard, fallback.shots, "shots"),
  };
}

function ensureWorkspace(draft) {
  if (!draft.workspace) {
    draft.workspace = buildCreativeWorkspace({
      story: draft.story || {},
      idea: draft.input?.idea || "",
      style: draft.input?.style || "电影感",
    });
  }
  for (const section of Object.keys(WORKSPACE_SECTIONS)) {
    if (!Array.isArray(draft.workspace[section])) {
      draft.workspace[section] = [];
    }
  }
  return draft.workspace;
}

function findItem(workspace, section, itemId) {
  return workspace?.[section]?.find((item) => item.id === itemId) || null;
}

function assertSection(section) {
  if (!WORKSPACE_SECTIONS[section]) {
    throw new Error("未知的创作步骤");
  }
}

function recalculateJobState(draft) {
  const workspace = ensureWorkspace(draft);
  const active = Object.keys(WORKSPACE_SECTIONS).some((section) =>
    workspace[section].some((item) => ACTIVE_STATES.has(item.status)),
  );

  if (active) {
    draft.status = "running";
    draft.progress = {
      stage: "workspace_libtv",
      percent: 66,
      label: "LibTV 正在生成步骤素材",
    };
    return;
  }

  if (draft.assets?.finalVideo?.url) {
    draft.status = "completed";
    draft.progress = {
      stage: "completed",
      percent: 100,
      label: "成片和步骤素材已同步到工作台",
    };
    return;
  }

  if (draft.status !== "failed") {
    draft.status = "waiting_libtv";
    draft.progress = {
      stage: "workspace_ready",
      percent: 72,
      label: "步骤素材可继续同步或重新生成",
    };
  }
}

export function buildLibTvWorkspaceMessage({ job, section, item }) {
  const meta = WORKSPACE_SECTIONS[section];
  const story = job.story || {};
  return [
    `请作为 LibTV 创作执行器，只处理这个 AI 导演项目里的「${meta.label}」步骤。`,
    `项目标题：${story.title || "未命名短片"}`,
    `用户原始想法：${job.input?.idea || ""}`,
    `整体风格：${job.input?.style || "电影感"}`,
    `当前步骤目标：${meta.action}`,
    `卡片名称：${item.name}`,
    `卡片设定：${item.description}`,
    `给 LibTV 的原始任务：${item.libtvPrompt || item.description}`,
    "请生成可用于继续制作短片的图片或视频素材；如果是角色/场景/道具，优先返回清晰参考图；如果是分镜，优先返回故事板图片或短镜头预览。",
    "完成后请在会话里返回可访问的图片或视频链接。",
  ].join("\n");
}

export async function ensureWorkspaceForJob(jobId) {
  return mutateJob(jobId, (draft) => {
    ensureWorkspace(draft);
  });
}

function collectEditedItem(payload = {}) {
  const item = payload.item || {};
  return {
    name: asText(item.name),
    description: asText(item.description),
    libtvPrompt: asText(item.libtvPrompt),
    notes: asText(item.notes),
    durationSeconds: item.durationSeconds ? Number(item.durationSeconds) : undefined,
    voiceover: asText(item.voiceover),
    camera: asText(item.camera),
  };
}

export async function updateWorkspaceItem(jobId, { section, itemId, item = {} }) {
  assertSection(section);
  return mutateJob(jobId, (draft) => {
    const workspace = ensureWorkspace(draft);
    const current = findItem(workspace, section, itemId);
    if (!current) {
      throw new Error("没有找到这张创作卡片");
    }
    const edited = collectEditedItem({ item });
    for (const [key, value] of Object.entries(edited)) {
      if (value !== undefined && value !== "") {
        current[key] = value;
      }
    }
  });
}

async function getWorkspaceItemSnapshot(jobId, section, itemId) {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }
  const workspace = job.workspace || buildCreativeWorkspace({
    story: job.story || {},
    idea: job.input?.idea || "",
    style: job.input?.style || "电影感",
  });
  const item = findItem(workspace, section, itemId);
  if (!item) {
    throw new Error("没有找到这张创作卡片");
  }
  return { job, item };
}

function assetPrefix(section, itemId) {
  return `${section}-${String(itemId).replace(/[^a-z0-9_-]+/giu, "-")}`;
}

function limitedResultForSection(section, result) {
  const limits = DOWNLOAD_LIMITS[section] || { images: 4, videos: 2 };
  return {
    videos: result.videos.slice(0, limits.videos),
    images: result.images.slice(0, limits.images),
  };
}

function findAssetByUrl(assets = [], url = "") {
  return assets.find((asset) => asset.url === url || asset.remoteUrl === url) || null;
}

function preserveSelectedAssets(item) {
  const images = item.assets?.images || [];
  const videos = item.assets?.videos || [];
  const selectedImage = item.selectedAssets?.image;
  const selectedVideo = item.selectedAssets?.video;
  const imageStillExists = selectedImage && findAssetByUrl(images, selectedImage.url || selectedImage.remoteUrl || selectedImage);
  const videoStillExists = selectedVideo && findAssetByUrl(videos, selectedVideo.url || selectedVideo.remoteUrl || selectedVideo);

  item.selectedAssets = {
    image: imageStillExists || images[0] || null,
    video: videoStillExists || videos[0] || null,
  };
}

export async function syncWorkspaceItemFromLibTv(jobId, { section, itemId }) {
  assertSection(section);
  await ensureDirectories();

  const { job, item } = await getWorkspaceItemSnapshot(jobId, section, itemId);
  if (!item.libtv?.sessionId) {
    throw new Error("这张卡片还没有提交给 LibTV");
  }

  const data = await queryLibTvSession(item.libtv.sessionId, 0);
  const result = extractLibTvResult(data.messages);
  const selected = limitedResultForSection(section, result);
  const { videoAssets, imageAssets } = await downloadLibTvAssets({
    jobId,
    outputDir: jobDirectory(jobId),
    videos: selected.videos,
    images: selected.images,
    prefix: assetPrefix(section, itemId),
  });

  await mutateJob(jobId, (draft) => {
    const workspace = ensureWorkspace(draft);
    const current = findItem(workspace, section, itemId);
    if (!current) return;
    current.libtv = {
      ...current.libtv,
      lastSeq: Math.max(current.libtv?.lastSeq || 0, result.maxSeq || 0),
      lastCheckedAt: new Date().toISOString(),
      resultUrls: result.urls,
    };
    current.assets = {
      images: imageAssets,
      videos: videoAssets,
    };
    preserveSelectedAssets(current);
    if (result.urls.length > 0) {
      current.status = "completed";
    } else if (ACTIVE_STATES.has(current.status)) {
      current.status = "polling";
    } else {
      current.status = "waiting";
    }
    recalculateJobState(draft);
  });

  if (result.urls.length > 0) {
    await appendJobLog(jobId, "libtv-step", `${WORKSPACE_SECTIONS[section].label}「${item.name}」已同步到素材`);
  }
  return getJob(jobId);
}

export async function selectWorkspaceItemAsset(jobId, { section, itemId, assetType, assetUrl }) {
  assertSection(section);
  if (!["image", "video"].includes(assetType)) {
    throw new Error("只能选用图片或视频素材");
  }
  const key = assetType === "image" ? "images" : "videos";
  await mutateJob(jobId, (draft) => {
    const workspace = ensureWorkspace(draft);
    const item = findItem(workspace, section, itemId);
    if (!item) {
      throw new Error("没有找到这张创作卡片");
    }
    const selected = findAssetByUrl(item.assets?.[key] || [], assetUrl);
    if (!selected) {
      throw new Error("这条素材不在当前卡片里");
    }
    item.selectedAssets = {
      ...selectedAssetBucket(item.selectedAssets || {}),
      [assetType]: selected,
    };
  });
  await appendJobLog(jobId, "asset-select", `已选用「${itemId}」的一条${assetType === "video" ? "视频" : "图片"}素材`);
  return getJob(jobId);
}

export async function pollWorkspaceItemUntilReady(jobId, { section, itemId }) {
  const meta = WORKSPACE_SECTIONS[section];
  const deadline = Date.now() + env.LIBTV_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const job = await syncWorkspaceItemFromLibTv(jobId, { section, itemId });
    const workspace = job.workspace || {};
    const item = findItem(workspace, section, itemId);
    if (item?.status === "completed") {
      return true;
    }
    await appendJobLog(jobId, "libtv-step", `${meta.label}「${item?.name || itemId}」仍在生成`);
    await new Promise((resolve) => setTimeout(resolve, env.LIBTV_POLL_INTERVAL_MS));
  }

  await mutateJob(jobId, (draft) => {
    const workspace = ensureWorkspace(draft);
    const item = findItem(workspace, section, itemId);
    if (item) {
      item.status = "waiting";
      item.libtv = {
        ...item.libtv,
        lastCheckedAt: new Date().toISOString(),
      };
    }
    recalculateJobState(draft);
  });
  await appendJobLog(jobId, "libtv-step", `${meta.label} 生成时间较长，可稍后手动同步`);
  return false;
}

export async function submitWorkspaceItemToLibTv(jobId, { section, itemId, item }) {
  assertSection(section);
  await ensureDirectories();
  if (item) {
    await updateWorkspaceItem(jobId, { section, itemId, item });
  } else {
    await mutateJob(jobId, (draft) => {
      ensureWorkspace(draft);
    });
  }

  const { job, item: currentItem } = await getWorkspaceItemSnapshot(jobId, section, itemId);
  const message = buildLibTvWorkspaceMessage({ job, section, item: currentItem });
  const libtv = await createLibTvSession(message);

  await mutateJob(jobId, (draft) => {
    const workspace = ensureWorkspace(draft);
    const target = findItem(workspace, section, itemId);
    if (!target) return;
    target.libtv = {
      ...libtv,
      state: "submitted",
      lastSeq: 0,
      lastCheckedAt: null,
      resultUrls: [],
    };
    target.status = "submitted";
    target.assets = { images: [], videos: [] };
    draft.providers.libtv = "agent-im";
    recalculateJobState(draft);
  });
  await appendJobLog(jobId, "libtv-step", `${WORKSPACE_SECTIONS[section].label}「${currentItem.name}」已提交给 LibTV`);

  pollWorkspaceItemUntilReady(jobId, { section, itemId }).catch((error) => {
    console.error("Workspace LibTV polling failed", error);
  });

  return getJob(jobId);
}

export async function submitWorkspaceSuiteToLibTv(jobId) {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  await mutateJob(jobId, (draft) => {
    ensureWorkspace(draft);
  });

  const latest = await getJob(jobId);
  const targets = Object.keys(WORKSPACE_SECTIONS).flatMap((section) =>
    (latest.workspace?.[section] || []).map((item) => ({ section, itemId: item.id })),
  );

  for (const target of targets) {
    await submitWorkspaceItemToLibTv(jobId, target);
  }

  await appendJobLog(jobId, "libtv-step", "已把角色、场景、道具、分镜全组交给 LibTV 生成");
  return getJob(jobId);
}

export async function submitWorkspaceSectionToLibTv(jobId, section) {
  assertSection(section);
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  await mutateJob(jobId, (draft) => {
    ensureWorkspace(draft);
  });

  const latest = await getJob(jobId);
  const items = latest.workspace?.[section] || [];
  if (!items.length) {
    throw new Error(`${WORKSPACE_SECTIONS[section].label} 还没有可生成的卡片`);
  }

  for (const item of items) {
    await submitWorkspaceItemToLibTv(jobId, { section, itemId: item.id });
  }

  const orderText = section === "shots" ? "，已按文字分镜顺序提交" : "";
  await appendJobLog(jobId, "libtv-step", `${WORKSPACE_SECTIONS[section].label}整组已交给 LibTV${orderText}`);
  return getJob(jobId);
}
