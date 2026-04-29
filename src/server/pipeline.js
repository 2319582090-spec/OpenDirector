import {
  env,
  ensureDirectories,
} from "./config.js";
import {
  appendJobLog,
  getJob,
  jobDirectory,
  mutateJob,
} from "./job-store.js";
import { generateDirectorBrief } from "./providers/director.js";
import {
  createLibTvSession,
  downloadLibTvAssets,
  extractLibTvResult,
  queryLibTvSession,
} from "./providers/libtv.js";
import { getRunModeMeta, normalizeRunMode } from "./utils/run-mode.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLibTvMessage({ idea, style, durationSeconds }) {
  return [
    "请新建一个任务，根据下面用户原始需求直接生成一条可预览的完整短片成片。",
    `用户原始想法：${idea}`,
    `目标风格：${style}`,
    `目标片长：${durationSeconds} 秒`,
    "请完成剧本、分镜、视频生成和最终成片输出，并在完成后返回可访问的视频结果。",
  ].join("\n");
}

function finalFilmMessageFromJob(job) {
  const story = job.story || {};
  const workspace = job.workspace || {};
  const selectedReferenceLines = [];
  const list = (items = []) =>
    items
      .map((item, index) => `${index + 1}. ${item.name || item.title || item.id}：${item.description || item.libtvPrompt || ""}`)
      .join("\n");
  const collectSelected = (sectionLabel, items = []) => {
    for (const item of items) {
      const image = item.selectedAssets?.image?.remoteUrl || item.selectedAssets?.image?.url;
      const video = item.selectedAssets?.video?.remoteUrl || item.selectedAssets?.video?.url;
      if (image) selectedReferenceLines.push(`${sectionLabel}/${item.name || item.id} 选用参考图：${image}`);
      if (video) selectedReferenceLines.push(`${sectionLabel}/${item.name || item.id} 选用参考视频：${video}`);
    }
  };
  collectSelected("角色/演员", workspace.characters || []);
  collectSelected("场景", workspace.locations || []);
  collectSelected("道具", workspace.props || []);
  collectSelected("分镜", workspace.shots || []);
  const shots = (workspace.shots || [])
    .map((shot, index) => {
      return [
        `${index + 1}. ${shot.name || shot.title || shot.id}`,
        shot.description ? `画面：${shot.description}` : "",
        shot.camera ? `镜头：${shot.camera}` : "",
        shot.voiceover ? `旁白：${shot.voiceover}` : "",
      ]
        .filter(Boolean)
        .join("；");
    })
    .join("\n");

  return [
    "请根据下面 AI 导演工作台的完整上下文，生成一条可预览的完整短片成片。",
    `用户原始想法：${job.input?.idea || ""}`,
    `目标风格：${job.input?.style || "电影感"}`,
    `目标片长：${job.input?.durationSeconds || 60} 秒`,
    `标题：${story.title || ""}`,
    `故事梗概：${story.summary || ""}`,
    `整片旁白：${story.narration || ""}`,
    `角色/演员：\n${list(workspace.characters || [])}`,
    `场景：\n${list(workspace.locations || [])}`,
    `道具：\n${list(workspace.props || [])}`,
    `分镜：\n${shots}`,
    selectedReferenceLines.length ? `用户选用的素材参考：\n${selectedReferenceLines.join("\n")}` : "",
    "请自动完成：视频生成、中文配音、配乐、剪辑串联、节奏控制和最终成片输出。",
    "完成后请返回可访问的视频链接。",
  ].join("\n");
}

async function setProgress(jobId, patch) {
  return mutateJob(jobId, (job) => {
    job.progress = {
      ...job.progress,
      ...patch,
    };
  });
}

async function applyLibTvResult(jobId, result) {
  const outputDir = jobDirectory(jobId);
  const { videoAssets, imageAssets } = await downloadLibTvAssets({
    jobId,
    outputDir,
    videos: result.videos,
    images: result.images,
  });

  return mutateJob(jobId, (draft) => {
    draft.assets.libtvVideos = videoAssets;
    draft.assets.libtvImages = imageAssets;
    const outputVideos = videoAssets.filter((asset) => /\/output\/.+\/result\.mp4(?:\?|$)/iu.test(asset.remoteUrl || ""));
    const playableVideo =
      [...outputVideos].reverse().find((asset) => !asset.downloadError) ||
      videoAssets.find((asset) => !asset.downloadError) ||
      videoAssets[0];
    if (playableVideo) {
      draft.assets.finalVideo = {
        fileName: playableVideo.fileName,
        url: playableVideo.url,
        remoteUrl: playableVideo.remoteUrl,
      };
      draft.providers.video = "libtv";
      draft.status = "completed";
      draft.error = null;
      draft.progress = {
        stage: "completed",
        percent: 100,
        label: "LibTV 成片已同步完成",
      };
    } else {
      draft.status = "waiting_libtv";
      draft.progress = {
        stage: "libtv_waiting",
        percent: 80,
        label: "LibTV 已返回素材，但还没有发现视频结果",
      };
    }
  });
}

async function pollLibTvUntilReady(jobId) {
  const deadline = Date.now() + env.LIBTV_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    const libtv = job?.external?.libtv;
    if (!libtv?.sessionId) {
      throw new Error("任务缺少 LibTV sessionId");
    }

    const data = await queryLibTvSession(libtv.sessionId, libtv.lastSeq || 0);
    const result = extractLibTvResult(data.messages);
    await mutateJob(jobId, (draft) => {
      draft.external.libtv = {
        ...draft.external.libtv,
        lastSeq: Math.max(draft.external.libtv?.lastSeq || 0, result.maxSeq || 0),
        lastCheckedAt: new Date().toISOString(),
        resultUrls: [...new Set([...(draft.external.libtv?.resultUrls || []), ...result.urls])],
      };
    });

    if (result.videos.length > 0) {
      await appendJobLog(jobId, "libtv", `发现 ${result.videos.length} 条视频结果，开始下载到本地`);
      await applyLibTvResult(jobId, result);
      await appendJobLog(jobId, "completed", "最终视频已同步到网页工作台");
      return true;
    }

    await appendJobLog(jobId, "libtv", "LibTV 仍在生成，继续等待");
    await setProgress(jobId, {
      stage: "libtv_polling",
      percent: 55,
      label: "LibTV 正在生成成片",
    });
    await sleep(env.LIBTV_POLL_INTERVAL_MS);
  }

  await mutateJob(jobId, (draft) => {
    draft.status = "waiting_libtv";
    draft.progress = {
      stage: "libtv_waiting",
      percent: 75,
      label: "LibTV 生成时间较长，可稍后同步结果",
    };
  });
  await appendJobLog(jobId, "libtv", "轮询超时，保留画布链接，稍后可手动同步");
  return false;
}

export async function submitFinalLibTvJob(jobId, message = "") {
  await ensureDirectories();
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  await setProgress(jobId, {
    stage: "libtv_final_submit",
    percent: 58,
    label: "正在把完整成片指令交给 LibTV",
  });

  const libtvMessage = String(message || "").trim() || finalFilmMessageFromJob(job);
  const libtv = await createLibTvSession(libtvMessage);
  await mutateJob(jobId, (draft) => {
    draft.status = "running";
    draft.providers.libtv = "agent-im";
    draft.external.libtv = {
      ...libtv,
      state: "submitted",
      lastSeq: 0,
      lastCheckedAt: null,
      resultUrls: [],
      finalTask: libtvMessage,
    };
    draft.progress = {
      stage: "libtv_final_polling",
      percent: 62,
      label: "LibTV 正在配音配乐并串成成片",
    };
  });
  await appendJobLog(jobId, "libtv-final", "完整成片指令已提交给 LibTV");

  pollLibTvUntilReady(jobId).catch(async (error) => {
    console.error("Final LibTV polling failed", error);
    await mutateJob(jobId, (draft) => {
      draft.status = "failed";
      draft.error = { message: error.message };
      draft.progress = {
        stage: "failed",
        percent: draft.progress?.percent || 0,
        label: "成片生成失败，请查看日志",
      };
    });
    await appendJobLog(jobId, "failed", error.message);
  });

  return getJob(jobId);
}

export async function syncLibTvJob(jobId) {
  await ensureDirectories();
  const job = await getJob(jobId);
  const libtv = job?.external?.libtv;
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }
  if (!libtv?.sessionId) {
    throw new Error("这个任务没有 LibTV 会话");
  }

  await setProgress(jobId, {
    stage: "libtv_sync",
    percent: 82,
    label: "正在同步 LibTV 最新结果",
  });
  const data = await queryLibTvSession(libtv.sessionId, 0);
  const result = extractLibTvResult(data.messages);
  await mutateJob(jobId, (draft) => {
    draft.external.libtv = {
      ...draft.external.libtv,
      lastSeq: Math.max(draft.external.libtv?.lastSeq || 0, result.maxSeq || 0),
      lastCheckedAt: new Date().toISOString(),
      resultUrls: result.urls,
    };
  });

  if (!result.urls.length) {
    await mutateJob(jobId, (draft) => {
      if (draft.assets?.finalVideo?.url) {
        draft.status = "completed";
        draft.progress = {
          stage: "completed",
          percent: 100,
          label: "LibTV 成片已同步完成",
        };
      } else {
        draft.status = "waiting_libtv";
        draft.progress = {
          stage: "libtv_waiting",
          percent: 80,
          label: "暂时还没有同步到 LibTV 结果",
        };
      }
    });
    await appendJobLog(jobId, "libtv", "手动同步完成，但还没有发现结果 URL");
    return getJob(jobId);
  }

  await applyLibTvResult(jobId, result);
  await appendJobLog(jobId, "libtv", "手动同步完成");
  return getJob(jobId);
}

export async function runGenerationJob(jobId) {
  await ensureDirectories();
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  const runMode = normalizeRunMode(job.input.runMode, "libtv");
  const runModeMeta = getRunModeMeta(runMode, "libtv");

  try {
    await mutateJob(jobId, (draft) => {
      draft.status = "running";
      draft.error = null;
      draft.input.runMode = runMode;
    });
    await appendJobLog(jobId, "queued", `任务进入后台执行（${runModeMeta.label}）`);

    await setProgress(jobId, {
      stage: "director",
      percent: 10,
      label: "GPT-5.4 正在生成导演简报",
    });
    const { story, plan, provider, workspace } = await generateDirectorBrief({
      idea: job.input.idea,
      style: job.input.style,
      durationSeconds: job.input.durationSeconds,
    });
    await mutateJob(jobId, (draft) => {
      draft.story = story;
      draft.plan = plan;
      draft.workspace = workspace;
      draft.providers.script = provider;
    });
    await appendJobLog(jobId, "director", `导演简报生成完成，来源：${provider}`);

    if (runMode !== "libtv") {
      await mutateJob(jobId, (draft) => {
        draft.status = "ready";
        draft.progress = {
          stage: "director_ready",
          percent: 45,
          label: "剧本和可视化步骤已生成，可以继续生成素材或成片",
        };
      });
      return;
    }

    await setProgress(jobId, {
      stage: "libtv_submit",
      percent: 35,
      label: "正在把任务交给 LibTV",
    });
    const libtvMessage = buildLibTvMessage({
      idea: job.input.idea,
      style: job.input.style,
      durationSeconds: job.input.durationSeconds,
    });
    const libtv = await createLibTvSession(libtvMessage);
    await mutateJob(jobId, (draft) => {
      draft.providers.libtv = "agent-im";
      draft.external.libtv = {
        ...libtv,
        state: "submitted",
        lastSeq: 0,
        lastCheckedAt: null,
        resultUrls: [],
      };
    });
    await appendJobLog(jobId, "libtv", "LibTV 会话已创建，开始等待生成结果");

    await pollLibTvUntilReady(jobId);
  } catch (error) {
    await mutateJob(jobId, (draft) => {
      draft.status = "failed";
      draft.error = {
        message: error.message,
      };
      draft.progress = {
        stage: "failed",
        percent: draft.progress?.percent || 0,
        label: "任务失败，请查看错误信息",
      };
    });
    await appendJobLog(jobId, "failed", error.message);
  }
}
