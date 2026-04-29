import fs from "node:fs";
import path from "node:path";
import { env, PROJECT_ROOT } from "./config.js";
import { commandExists } from "./utils/ffmpeg.js";

export async function getProviderStatus() {
  const [ffmpegReady, ffprobeReady, sayReady] = await Promise.all([
    commandExists("ffmpeg"),
    commandExists("ffprobe"),
    commandExists("say"),
  ]);
  const remotionReady = [
    path.join(PROJECT_ROOT, "node_modules", "@remotion", "bundler"),
    path.join(PROJECT_ROOT, "node_modules", "@remotion", "renderer"),
    path.join(PROJECT_ROOT, "node_modules", "remotion"),
  ].every((targetPath) => fs.existsSync(targetPath));
  const localMissing = [];

  if (!remotionReady) localMissing.push("Remotion");
  if (!ffmpegReady || !ffprobeReady) localMissing.push("FFmpeg / FFprobe");
  if (!sayReady) localMissing.push("macOS say");
  const localReady = localMissing.length === 0;

  return {
    localStudio: {
      state: localReady ? "ready" : "error",
      label: "本地导演引擎",
      detail: localReady
        ? "本地模板、系统语音、Remotion 和 FFmpeg 闭环可用"
        : `本地模式缺少：${localMissing.join("、")}`,
    },
    libtv: {
      state: env.LIBTV_ACCESS_KEY ? "ready" : "missing",
      label: "LibTV",
      detail: env.LIBTV_ACCESS_KEY ? "已配置主视频生成链路" : "缺少 LIBTV_ACCESS_KEY",
      baseUrl: env.LIBTV_BASE_URL,
    },
    openrouterScript: {
      state: env.OPENROUTER_API_KEY ? "ready" : "missing",
      label: "OpenRouter / GPT-5.4",
      detail: env.OPENROUTER_API_KEY ? "可用于剧本生成和上下文调度" : "缺少 OPENROUTER_API_KEY",
      model: env.OPENROUTER_MODEL,
      baseUrl: env.OPENROUTER_BASE_URL,
    },
    dashscopeVideo: {
      state: env.DASHSCOPE_API_KEY ? "ready" : "missing",
      label: "阿里百炼 / 通义万相",
      detail: env.DASHSCOPE_API_KEY ? "已配置视频主链" : "缺少 DASHSCOPE_API_KEY",
      model: env.DASHSCOPE_VIDEO_MODEL,
    },
    falVideo: {
      state: env.FAL_API_KEY ? "ready" : "missing",
      label: "fal.ai Video API",
      detail: env.FAL_API_KEY ? "已配置文生视频备用链" : "缺少 FAL_API_KEY",
      model: env.FAL_VIDEO_MODEL,
    },
    falImage: {
      state: env.FAL_API_KEY ? "ready" : "missing",
      label: "fal.ai Image API",
      detail: env.FAL_API_KEY ? "已配置文生图能力" : "缺少 FAL_API_KEY",
      model: env.FAL_IMAGE_MODEL,
    },
    runwayVideo: {
      state: env.RUNWAY_API_KEY ? "ready" : "missing",
      label: "Runway API",
      detail: env.RUNWAY_API_KEY ? "已配置备用视频链" : "缺少 RUNWAY_API_KEY",
      model: env.RUNWAY_VIDEO_MODEL,
    },
    novaCompatible: {
      state: env.NOVA_API_KEY ? "ready" : "missing",
      label: "2API / Nova Compatible",
      detail: env.NOVA_API_KEY ? "已配置兼容接口，可用于文生图与文生视频" : "缺少 NOVA_API_KEY",
      baseUrl: env.NOVA_BASE_URL,
      models: {
        text: env.NOVA_TEXT_MODEL,
        video: env.NOVA_VIDEO_MODEL,
        image: env.NOVA_IMAGE_MODEL,
      },
    },
    viduVideo: {
      state: env.VIDU_API_KEY ? "ready" : "missing",
      label: "Vidu API",
      detail: env.VIDU_API_KEY ? "已收到视频 provider key，待接入生成链路" : "缺少 VIDU_API_KEY",
      model: env.VIDU_VIDEO_MODEL,
    },
    elevenLabsVoice: {
      state: env.ELEVENLABS_API_KEY ? "ready" : "fallback",
      label: "ElevenLabs",
      detail: env.ELEVENLABS_API_KEY ? "可用于真实旁白" : "未配置 key，将降级到 macOS say",
      voiceId: env.ELEVENLABS_VOICE_ID,
    },
    remotionTimeline: {
      state: remotionReady ? "ready" : "fallback",
      label: "Remotion",
      detail: remotionReady ? "负责卡片模板与时间线层" : "工作台已就位，但 Remotion 运行依赖尚未安装",
    },
    ffmpegExport: {
      state: ffmpegReady && ffprobeReady ? "ready" : "error",
      label: "FFmpeg / FFprobe",
      detail: ffmpegReady && ffprobeReady ? "本机导出链路可用" : "ffmpeg 或 ffprobe 未安装",
    },
  };
}
