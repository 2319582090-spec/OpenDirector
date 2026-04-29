const DEFAULT_STYLE = "电影感";

export function normalizeDurationSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 45) return 30;
    if (value <= 75) return 60;
    return 90;
  }

  const normalized = String(value ?? "").trim();
  if (["30", "30秒", "30 秒"].includes(normalized)) return 30;
  if (["60", "1分钟", "1 分钟", "60秒", "60 秒"].includes(normalized)) return 60;
  if (["90", "90秒", "90 秒", "1分30秒", "1 分 30 秒"].includes(normalized)) return 90;
  return 60;
}

export function createScenePlan(targetSeconds, strategy = "auto") {
  if (strategy === "runway") {
    if (targetSeconds === 30) return { sceneCount: 3, sceneDurationSeconds: 10 };
    if (targetSeconds === 60) return { sceneCount: 6, sceneDurationSeconds: 10 };
    return { sceneCount: 9, sceneDurationSeconds: 10 };
  }

  if (targetSeconds === 30) return { sceneCount: 3, sceneDurationSeconds: 10 };
  if (targetSeconds === 60) return { sceneCount: 4, sceneDurationSeconds: 15 };
  return { sceneCount: 6, sceneDurationSeconds: 15 };
}

export function extractFirstJsonObject(text) {
  const source = String(text ?? "").trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型返回结果中没有可解析的 JSON");
  }
  return JSON.parse(source.slice(start, end + 1));
}

export function buildFallbackStory({
  idea,
  style = DEFAULT_STYLE,
  targetSeconds,
  sceneCount,
  sceneDurationSeconds,
}) {
  const safeIdea = String(idea || "一个想法").trim();
  const title = `${safeIdea.slice(0, 18)} · ${style}网页版预告片`;
  const summary = `这是一支 ${targetSeconds} 秒的 ${style} 风格样片提案，围绕“${safeIdea}”展开，用网页工作台直接串起脚本、旁白、视频和导出。`;

  const beats = [
    {
      name: "开场",
      visual: "先建立世界观和情绪，把主角和环境放进一个能立刻记住的画面里。",
      voice: "故事从一个很清晰的起点开始，观众先被带进气氛，而不是被说明书式叙述淹没。",
    },
    {
      name: "推进",
      visual: "让主角开始行动，目标逐渐浮现，同时把阻力抬起来。",
      voice: "角色在往前走，观众也开始知道这件事为什么值得看下去。",
    },
    {
      name: "转折",
      visual: "情绪突然收紧，把前面的铺垫压成一个真正的转折点。",
      voice: "这里不只是变化，而是让前面的期待变成更具体的冲突。",
    },
    {
      name: "抬升",
      visual: "镜头更大，情绪更满，逐渐进入提案片该有的高潮感。",
      voice: "画面开始变得更有规模，节奏也更像一支真正的预告片。",
    },
    {
      name: "兑现",
      visual: "给出情绪或剧情上的兑现，让观众感到这个想法已经具备成片可能。",
      voice: "这一段负责把价值说透，让人感觉它不是概念，而是可以继续投产的项目。",
    },
    {
      name: "收尾",
      visual: "最后停在一个带余韵的画面上，像品牌片一样干净地收住。",
      voice: "最后留下一句能被记住的话，让成片在情绪上真正落地。",
    },
  ];

  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const beat = beats[index] || beats[beats.length - 1];
    return {
      id: index + 1,
      title: `镜头 ${index + 1} · ${beat.name}`,
      durationSeconds: sceneDurationSeconds,
      visualPrompt: `${style} cinematic video, ${safeIdea}, shot ${index + 1}, ${beat.visual} 16:9, premium lighting, clear subject, strong composition, no text, no watermark.`,
      visualDescription: `${beat.visual} 整体风格偏 ${style}，并持续围绕“${safeIdea}”保持角色与空间一致性。`,
      voiceover: beat.voice,
    };
  });

  return {
    title,
    summary,
    narration: scenes.map((scene) => scene.voiceover).join(" "),
    scenes,
    source: "local-template",
  };
}

function sanitizeScene(rawScene, index, fallbackScene, sceneDurationSeconds) {
  return {
    id: rawScene?.id ?? index + 1,
    title: String(rawScene?.title || fallbackScene.title || `镜头 ${index + 1}`).trim(),
    durationSeconds: Number(rawScene?.durationSeconds || sceneDurationSeconds),
    visualPrompt: String(rawScene?.visualPrompt || rawScene?.prompt || fallbackScene.visualPrompt).trim(),
    visualDescription: String(rawScene?.visualDescription || rawScene?.description || fallbackScene.visualDescription).trim(),
    voiceover: String(rawScene?.voiceover || rawScene?.narration || fallbackScene.voiceover).trim(),
  };
}

export function sanitizeStory(candidate, fallback, plan) {
  const scenes = Array.isArray(candidate?.scenes) ? candidate.scenes : [];
  const nextScenes = [];
  for (let index = 0; index < plan.sceneCount; index += 1) {
    nextScenes.push(
      sanitizeScene(
        scenes[index],
        index,
        fallback.scenes[index],
        plan.sceneDurationSeconds,
      ),
    );
  }

  return {
    title: String(candidate?.title || fallback.title).trim(),
    summary: String(candidate?.summary || fallback.summary).trim(),
    narration: String(candidate?.narration || nextScenes.map((scene) => scene.voiceover).join(" ")).trim(),
    scenes: nextScenes,
    source: candidate?.source || fallback.source,
  };
}

export function createSubtitleTracks(story, introSeconds = 2, outroSeconds = 2) {
  const subtitles = [];
  let current = introSeconds;
  for (const scene of story.scenes) {
    subtitles.push({
      start: current,
      end: current + scene.durationSeconds,
      text: scene.voiceover,
    });
    current += scene.durationSeconds;
  }
  return {
    subtitles,
    totalVisualSeconds: introSeconds + story.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) + outroSeconds,
  };
}
