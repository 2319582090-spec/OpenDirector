export const RUN_MODES = {
  plan: {
    id: "plan",
    label: "剧本步骤",
    summary: "先用 GPT-5.4 生成剧本、角色、场景、道具和分镜，确认后再交给 LibTV。",
  },
  libtv: {
    id: "libtv",
    label: "LibTV 主链",
    summary: "GPT-5.4 负责剧本和调度，LibTV 负责真实视频生成与项目画布。",
  },
  local: {
    id: "local",
    label: "本地模式",
    summary: "本地模板 + macOS say + Remotion/FFmpeg，不调用外部生成 API。",
  },
  api: {
    id: "api",
    label: "API 增强",
    summary: "优先使用已配置 API，失败时自动回退到本地链路。",
  },
};

export function normalizeRunMode(value, fallback = "api") {
  if (value === "plan" || value === "libtv" || value === "local" || value === "api") {
    return value;
  }
  return fallback;
}

export function getRunModeMeta(value, fallback = "api") {
  return RUN_MODES[normalizeRunMode(value, fallback)];
}
