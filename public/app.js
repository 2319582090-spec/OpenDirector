const sectionMeta = {
  characters: { label: "角色/演员", short: "角色图", hint: "演员造型、人物气质、服装表情", placeholder: "例如：女主更有港风气质，红唇黑发，雨夜里有一点疏离感。" },
  locations: { label: "场景", short: "场景图", hint: "空间、美术、灯光、氛围", placeholder: "例如：便利店灯光更冷，窗外雨更重，货架要有反光和纵深。" },
  props: { label: "道具", short: "道具图", hint: "关键物件、材质、叙事作用", placeholder: "例如：旧打火机要有划痕和姓名缩写，成为关键线索。" },
  shots: { label: "分镜", short: "图片分镜/视频镜头", hint: "文字分镜、图片分镜、镜头视频", placeholder: "例如：按四个镜头推进，先远景建立雨夜，再特写打火机，最后留第三人反转。" },
};

const state = {
  providers: {},
  jobs: [],
  currentJobId: null,
  pollTimer: null,
  pollJobId: null,
};

const elements = {
  providerStrip: document.querySelector("#provider-strip"),
  form: document.querySelector("#generate-form"),
  submitButton: document.querySelector("#submit-button"),
  jobsList: document.querySelector("#jobs-list"),
  resultPanel: document.querySelector("#result-panel"),
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentJob() {
  return state.jobs.find((job) => job.id === state.currentJobId) || state.jobs[0] || null;
}

function statusText(status) {
  const map = {
    queued: "排队中",
    running: "生成中",
    ready: "可编辑",
    waiting_libtv: "等待 LibTV",
    completed: "已完成",
    failed: "失败",
  };
  return map[status] || "待开始";
}

function itemStatusText(status) {
  const map = {
    draft: "草稿",
    submitted: "已提交",
    polling: "生成中",
    waiting: "稍后同步",
    completed: "已返回",
    failed: "失败",
  };
  return map[status] || "草稿";
}

function sectionResultSummary(job, section) {
  const items = job?.workspace?.[section] || [];
  const done = items.filter((item) => item.status === "completed").length;
  if (!items.length) return "还没生成";
  if (done) return `${done}/${items.length} 已有素材`;
  return `${items.length} 张草稿，待生成素材`;
}

function firstNames(job, section) {
  const items = job?.workspace?.[section] || [];
  return items
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean)
    .join("、");
}

function tone(status) {
  if (status === "ready" || status === "completed") return "ready";
  if (status === "running" || status === "queued" || status === "waiting_libtv" || status === "fallback") return "working";
  return "error";
}

function itemTone(status) {
  if (status === "completed") return "ready";
  if (status === "submitted" || status === "polling" || status === "waiting") return "working";
  if (status === "failed") return "error";
  return "draft";
}

function hasActiveWorkspace(job) {
  const workspace = job?.workspace || {};
  return Object.keys(sectionMeta).some((section) =>
    (workspace[section] || []).some((item) => ["submitted", "polling"].includes(item.status)),
  );
}

function shouldPoll(job) {
  return Boolean(job && (["running", "queued"].includes(job.status) || hasActiveWorkspace(job)));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `请求失败 ${response.status}`);
  }
  return payload;
}

async function loadProviders() {
  const payload = await fetchJson("/api/providers/status");
  state.providers = payload.providers || {};
}

async function loadJobs() {
  const payload = await fetchJson("/api/jobs");
  state.jobs = payload.jobs || [];
  if (!state.currentJobId && state.jobs[0]) {
    state.currentJobId = state.jobs[0].id;
  }
}

function upsertJob(job) {
  const index = state.jobs.findIndex((item) => item.id === job.id);
  if (index === -1) {
    state.jobs.unshift(job);
  } else {
    state.jobs[index] = job;
  }
}

async function loadJob(jobId) {
  if (!jobId) return;
  const payload = await fetchJson(`/api/jobs/${encodeURIComponent(jobId)}`);
  const job = payload.job;
  upsertJob(job);
  render();
  if (shouldPoll(job)) {
    startPolling(job.id);
  } else {
    stopPolling();
  }
}

function startPolling(jobId) {
  if (state.pollTimer && state.pollJobId === jobId) return;
  stopPolling();
  state.pollJobId = jobId;
  state.pollTimer = window.setInterval(() => {
    loadJob(jobId).catch((error) => {
      console.error(error);
      stopPolling();
    });
  }, 5000);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
  }
  state.pollTimer = null;
  state.pollJobId = null;
}

function renderProviders() {
  const pick = ["openrouterScript", "libtv", "ffmpegExport", "localStudio"];
  elements.providerStrip.innerHTML = pick
    .map((key) => state.providers[key])
    .filter(Boolean)
    .map((provider) => {
      const extra = provider.model || provider.baseUrl || "";
      return `
        <span class="provider-chip ${tone(provider.state)}" title="${escapeHtml(provider.detail || "")}">
          <strong>${escapeHtml(provider.label)}</strong>
          <span>${escapeHtml(provider.state)}</span>
          ${extra ? `<small>${escapeHtml(extra)}</small>` : ""}
        </span>
      `;
    })
    .join("");
}

function renderJobs() {
  if (!state.jobs.length) {
    elements.jobsList.innerHTML = `<p class="empty-text">还没有任务。</p>`;
    return;
  }
  elements.jobsList.innerHTML = state.jobs
    .slice(0, 8)
    .map((job) => {
      const active = job.id === state.currentJobId ? "active" : "";
      return `
        <button class="job-item ${active}" data-job-id="${escapeHtml(job.id)}" type="button">
          <span>${escapeHtml(formatDate(job.createdAt))}</span>
          <strong>${escapeHtml(job.story?.title || job.input?.idea || "未命名任务")}</strong>
          <small>${escapeHtml(statusText(job.status))} · ${escapeHtml(job.progress?.label || "")}</small>
        </button>
      `;
    })
    .join("");
}

function renderStory(job) {
  if (!job?.story) {
    return `<p class="empty-text">GPT-5.4 简报生成后会显示在这里。</p>`;
  }
  const scenes = job.story.scenes || [];
  return `
    <article class="block">
      <span class="eyebrow">GPT-5.4 Director Brief</span>
      <h2>${escapeHtml(job.story.title || "导演简报")}</h2>
      <p>${escapeHtml(job.story.summary || "")}</p>
    </article>
    <article class="block">
      <h3>旁白草案</h3>
      <p>${escapeHtml(job.story.narration || "")}</p>
    </article>
    <div class="scene-grid">
      ${scenes
        .map(
          (scene) => `
            <article class="scene-card">
              <span>镜头 ${escapeHtml(scene.id)}</span>
              <strong>${escapeHtml(scene.title)}</strong>
              <p>${escapeHtml(scene.visualDescription || scene.visualPrompt || "")}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderScriptBoard(job) {
  if (!job?.story) {
    return `
      <section class="panel-block script-board" id="script-board">
        <div class="section-head">
          <h2>剧本</h2>
        </div>
        <p class="empty-text">提交想法后，GPT-5.4 会把剧本、旁白和文字分镜生成在这里。</p>
      </section>
    `;
  }
  const scenes = job.story.scenes || [];
  return `
    <section class="panel-block script-board" id="script-board">
      <div class="section-head wrap">
        <div>
          <h2>剧本</h2>
          <p>GPT-5.4 生成，可用上面的导演指令继续改。</p>
        </div>
      </div>
      <article class="script-summary">
        <span class="eyebrow">Title</span>
        <h3>${escapeHtml(job.story.title || "未命名")}</h3>
        <p>${escapeHtml(job.story.summary || "")}</p>
      </article>
      <article class="script-summary">
        <span class="eyebrow">Voiceover</span>
        <p>${escapeHtml(job.story.narration || "")}</p>
      </article>
      <div class="storyboard-text-list">
        ${scenes
          .map(
            (scene, index) => `
              <article class="storyboard-text-card">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(scene.title || `分镜 ${index + 1}`)}</strong>
                <p>${escapeHtml(scene.visualDescription || scene.visualPrompt || "")}</p>
                ${scene.voiceover ? `<small>旁白：${escapeHtml(scene.voiceover)}</small>` : ""}
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function sectionCount(job, section) {
  return job?.workspace?.[section]?.length || 0;
}

function doneCount(job, section) {
  return (job?.workspace?.[section] || []).filter((item) => item.status === "completed").length;
}

function renderFlowOverview(job) {
  const steps = [
    { key: "script", label: "剧本", done: Boolean(job?.story), total: 1 },
    { key: "characters", label: "角色图", done: doneCount(job, "characters"), total: sectionCount(job, "characters") },
    { key: "locations", label: "场景图", done: doneCount(job, "locations"), total: sectionCount(job, "locations") },
    { key: "props", label: "道具图", done: doneCount(job, "props"), total: sectionCount(job, "props") },
    { key: "shotText", label: "文字分镜", done: sectionCount(job, "shots"), total: sectionCount(job, "shots") || 1 },
    { key: "shotImages", label: "图片分镜", done: doneCount(job, "shots"), total: sectionCount(job, "shots") },
    { key: "shotVideos", label: "视频镜头", done: (job?.workspace?.shots || []).filter((item) => (item.assets?.videos || []).length > 0).length, total: sectionCount(job, "shots") },
    { key: "final", label: "剪辑成片", done: Boolean(job?.assets?.finalVideo?.url), total: 1 },
  ];
  return `
    <section class="panel-block flow-panel">
      <div class="section-head">
        <h2>全流程</h2>
      </div>
      <div class="flow-list">
        ${steps
          .map((step, index) => {
            const total = step.total || 1;
            const done = typeof step.done === "boolean" ? (step.done ? 1 : 0) : step.done;
            const stateClass = done >= total ? "ready" : done > 0 ? "working" : "draft";
            return `
              <article class="flow-step ${stateClass}">
                <span>${index + 1}</span>
                <strong>${escapeHtml(step.label)}</strong>
                <small>${escapeHtml(String(done))}/${escapeHtml(String(total))}</small>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderResultOverview(job) {
  if (!job?.story && !job?.workspace) {
    return "";
  }
  const finalVideo = job?.assets?.finalVideo?.url;
  const cards = [
    {
      label: "剧本",
      target: "script-board",
      state: job.story ? "已生成" : "等待生成",
      body: job.story?.title ? `《${job.story.title}》${job.story.summary ? `：${job.story.summary}` : ""}` : "输入想法后先在这里看到剧本。",
      ready: Boolean(job.story),
    },
    {
      label: "角色/演员",
      target: "workspace-section-characters",
      state: sectionResultSummary(job, "characters"),
      body: firstNames(job, "characters") || "角色卡会显示在下面。",
      ready: doneCount(job, "characters") > 0,
    },
    {
      label: "场景",
      target: "workspace-section-locations",
      state: sectionResultSummary(job, "locations"),
      body: firstNames(job, "locations") || "场景卡会显示在下面。",
      ready: doneCount(job, "locations") > 0,
    },
    {
      label: "道具",
      target: "workspace-section-props",
      state: sectionResultSummary(job, "props"),
      body: firstNames(job, "props") || "道具卡会显示在下面。",
      ready: doneCount(job, "props") > 0,
    },
    {
      label: "分镜",
      target: "workspace-section-shots",
      state: sectionResultSummary(job, "shots"),
      body: firstNames(job, "shots") || "文字分镜会显示在下面。",
      ready: doneCount(job, "shots") > 0,
    },
    {
      label: "成片",
      target: "final-output",
      state: finalVideo ? "已返回视频" : "待串成成片",
      body: finalVideo ? "最终视频已经可以播放。" : "素材确认后，用导演指令串成成片。",
      ready: Boolean(finalVideo),
    },
  ];

  const nextHint = finalVideo
    ? "现在可以播放最终视频，也可以继续用自然语言改剧本、素材或剪辑。"
    : job.story && !doneCount(job, "characters") && !doneCount(job, "shots")
      ? "现在已经有剧本和分镜草稿。下一步建议点“生成全部素材”，把角色图、场景图、道具图和分镜视频跑出来。"
      : "继续选用满意的素材，再点“串成成片”输出最终视频。";

  return `
    <section class="panel-block result-overview">
      <div class="section-head wrap">
        <div>
          <h2>当前结果总览</h2>
          <p>${escapeHtml(nextHint)}</p>
        </div>
        <div class="overview-actions">
          <button class="secondary-button" data-action="submit-step-suite" type="button">生成全部素材</button>
          <button class="primary-button" data-action="director-final" type="button">串成成片</button>
        </div>
      </div>
      <div class="overview-grid">
        ${cards
          .map(
            (card) => `
              <article class="overview-card ${card.ready ? "ready" : ""}">
                <div class="overview-card-head">
                  <span>${escapeHtml(card.label)}</span>
                  <a href="#${escapeHtml(card.target)}">查看</a>
                </div>
                <strong>${escapeHtml(card.state)}</strong>
                <p>${escapeHtml(card.body)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderDirectorConsole(job) {
  if (!job) {
    return "";
  }
  const reply = job.external?.directorAgent?.lastReply || "你可以直接用一句话调整任何步骤。";
  return `
    <section class="panel-block director-console">
      <div class="section-head wrap">
        <div>
          <h2>导演指令</h2>
          <p>用自然语言改剧本、角色、场景、道具、分镜、配音、配乐和剪辑节奏。</p>
        </div>
      </div>
      <textarea
        id="director-command"
        data-command-input="global"
        rows="4"
        placeholder="例如：女主更有港风气质，便利店更冷一点，打火机要成为关键道具，最后音乐压低，结尾留一个第三人反转。"
      ></textarea>
      <div class="director-actions">
        <button class="secondary-button" data-action="director-revise" type="button">只调整步骤</button>
        <button class="secondary-button" data-action="director-steps" type="button">调整并生成素材</button>
        <button class="primary-button" data-action="director-final" type="button">串成成片</button>
      </div>
      <p class="director-reply">${escapeHtml(reply)}</p>
    </section>
  `;
}

function renderItemAssets(section, item) {
  const images = item.assets?.images || [];
  const videos = item.assets?.videos || [];
  const urls = item.libtv?.resultUrls || [];
  if (!images.length && !videos.length && !urls.length) {
    return `<p class="empty-text">这张卡片的 LibTV 素材会显示在这里。</p>`;
  }

  const selectedImageUrl = item.selectedAssets?.image?.url || item.selectedAssets?.image?.remoteUrl || "";
  const selectedVideoUrl = item.selectedAssets?.video?.url || item.selectedAssets?.video?.remoteUrl || "";
  const isSelectedAsset = (asset, selectedUrl) => selectedUrl && [asset.url, asset.remoteUrl].includes(selectedUrl);
  const shownImages = images.slice(0, 4);
  const shownVideos = videos.slice(0, 2);
  const shownRemoteUrls = urls
    .filter((url) => !images.some((asset) => asset.remoteUrl === url) && !videos.some((asset) => asset.remoteUrl === url))
    .slice(0, 4);
  const hiddenCount = Math.max(0, images.length + videos.length + urls.length - shownImages.length - shownVideos.length - shownRemoteUrls.length);

  return `
    <div class="workspace-assets">
      ${shownImages
        .map(
          (asset, index) => `
            <div class="asset-card ${isSelectedAsset(asset, selectedImageUrl) ? "selected" : ""}">
              <a href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">
                <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.fileName || item.name)}" loading="lazy" />
              </a>
              <div class="asset-card-foot">
                <span>图 v${escapeHtml(index + 1)}${isSelectedAsset(asset, selectedImageUrl) ? " · 已选用" : ""}</span>
                <button
                  class="tiny-button"
                  data-action="select-workspace-asset"
                  data-section="${escapeHtml(section)}"
                  data-item-id="${escapeHtml(item.id)}"
                  data-asset-type="image"
                  data-asset-url="${escapeHtml(asset.url)}"
                  type="button"
                >选用</button>
              </div>
            </div>
          `,
        )
        .join("")}
      ${shownVideos
        .map(
          (asset, index) => `
            <div class="asset-card ${isSelectedAsset(asset, selectedVideoUrl) ? "selected" : ""}">
              <video controls playsinline src="${escapeHtml(asset.url)}"></video>
              <div class="asset-card-foot">
                <span>视频 v${escapeHtml(index + 1)}${isSelectedAsset(asset, selectedVideoUrl) ? " · 已选用" : ""}</span>
                <button
                  class="tiny-button"
                  data-action="select-workspace-asset"
                  data-section="${escapeHtml(section)}"
                  data-item-id="${escapeHtml(item.id)}"
                  data-asset-type="video"
                  data-asset-url="${escapeHtml(asset.url)}"
                  type="button"
                >选用</button>
              </div>
            </div>
          `,
        )
        .join("")}
      ${shownRemoteUrls
        .map(
          (url) => `
            <a class="asset-row" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
              <strong>远程结果</strong>
              <span>${escapeHtml(url)}</span>
            </a>
          `,
        )
        .join("")}
      ${hiddenCount > 0 ? `<p class="empty-text">还有 ${escapeHtml(hiddenCount)} 个素材链接已同步，先折叠不自动加载。</p>` : ""}
    </div>
  `;
}

function renderWorkspaceCard(section, item) {
  const canSync = Boolean(item.libtv?.sessionId);
  const isShot = section === "shots";
  return `
    <article class="workspace-card" data-workspace-card data-section="${escapeHtml(section)}" data-item-id="${escapeHtml(item.id)}">
      <div class="workspace-card-head">
        <div>
          <span class="eyebrow">${escapeHtml(sectionMeta[section].label)}</span>
          <strong>${escapeHtml(item.name)}</strong>
        </div>
        <span class="item-status ${itemTone(item.status)}">${escapeHtml(itemStatusText(item.status))}</span>
      </div>

      <label class="mini-field">
        <span>名称</span>
        <input data-field="name" value="${escapeHtml(item.name || "")}" />
      </label>
      <label class="mini-field">
        <span>设定</span>
        <textarea data-field="description" rows="4">${escapeHtml(item.description || "")}</textarea>
      </label>
      <label class="mini-field">
        <span>交给 LibTV 的任务</span>
        <textarea data-field="libtvPrompt" rows="4">${escapeHtml(item.libtvPrompt || "")}</textarea>
      </label>
      ${
        isShot
          ? `
            <div class="field-row">
              <label class="mini-field">
                <span>时长</span>
                <input data-field="durationSeconds" type="number" min="1" value="${escapeHtml(item.durationSeconds || "")}" />
              </label>
              <label class="mini-field">
                <span>镜头</span>
                <input data-field="camera" value="${escapeHtml(item.camera || "")}" />
              </label>
            </div>
            <label class="mini-field">
              <span>旁白</span>
              <textarea data-field="voiceover" rows="3">${escapeHtml(item.voiceover || "")}</textarea>
            </label>
          `
          : ""
      }

      <div class="workspace-actions">
        <button class="secondary-button" data-action="save-workspace-item" data-section="${escapeHtml(section)}" data-item-id="${escapeHtml(item.id)}" type="button">保存修改</button>
        <button class="primary-button compact" data-action="submit-workspace-item" data-section="${escapeHtml(section)}" data-item-id="${escapeHtml(item.id)}" type="button">用 LibTV 生成</button>
        ${canSync ? `<button class="secondary-button" data-action="sync-workspace-item" data-section="${escapeHtml(section)}" data-item-id="${escapeHtml(item.id)}" type="button">同步</button>` : ""}
        ${
          item.libtv?.projectUrl
            ? `<a class="canvas-link compact-link" href="${escapeHtml(item.libtv.projectUrl)}" target="_blank" rel="noreferrer">画布</a>`
            : ""
        }
      </div>
      ${renderItemAssets(section, item)}
    </article>
  `;
}

function renderSectionCommand(section, items) {
  if (!items.length) return "";
  const meta = sectionMeta[section];
  const submitText = section === "shots" ? "调整并按顺序生成分镜" : `调整并生成${meta.short}`;
  return `
    <div class="section-command">
      <textarea
        data-section-command="${escapeHtml(section)}"
        rows="3"
        placeholder="${escapeHtml(meta.placeholder)}"
      ></textarea>
      <div class="director-actions">
        <button class="secondary-button" data-action="section-revise" data-section="${escapeHtml(section)}" type="button">自然语言调整本组</button>
        <button class="primary-button" data-action="section-generate" data-section="${escapeHtml(section)}" type="button">${escapeHtml(submitText)}</button>
        <button class="secondary-button" data-action="generate-section" data-section="${escapeHtml(section)}" type="button">直接生成本组素材</button>
      </div>
    </div>
  `;
}

function renderCreativeWorkspace(job) {
  if (!job?.workspace) {
    return `
      <section class="panel-block" id="creative-workspace">
        <div class="section-head">
          <h2>可调步骤</h2>
        </div>
        <p class="empty-text">先提交一个想法，GPT-5.4 会拆出角色、场景、道具和分镜。</p>
      </section>
    `;
  }

  return `
    <section class="panel-block creative-workspace" id="creative-workspace">
      <div class="section-head wrap">
        <div>
          <h2>可调步骤</h2>
          <p>每张卡片都可以改文字，再单独交给 LibTV 生成素材。</p>
        </div>
        <button class="primary-button" data-action="submit-step-suite" type="button">生成全部素材</button>
      </div>

      ${Object.keys(sectionMeta)
        .map((section) => {
          const items = job.workspace?.[section] || [];
          return `
            <section class="workspace-section" id="workspace-section-${escapeHtml(section)}">
              <div class="section-head">
                <div>
                  <h3>${escapeHtml(sectionMeta[section].label)}</h3>
                  <p>${escapeHtml(sectionMeta[section].hint)}</p>
                </div>
                ${
                  items[0]
                    ? `<button class="secondary-button" data-action="submit-section-first" data-section="${escapeHtml(section)}" data-item-id="${escapeHtml(items[0].id)}" type="button">试本组第一张</button>`
                    : ""
                }
              </div>
              ${renderSectionCommand(section, items)}
              <div class="workspace-card-grid">
                ${items.map((item) => renderWorkspaceCard(section, item)).join("")}
              </div>
            </section>
          `;
        })
        .join("")}
    </section>
  `;
}

function collectTimelineMedia(job) {
  const workspace = job?.workspace || {};
  const items = [
    ...(workspace.characters || []).map((item) => ({ ...item, bucket: "角色" })),
    ...(workspace.locations || []).map((item) => ({ ...item, bucket: "场景" })),
    ...(workspace.props || []).map((item) => ({ ...item, bucket: "道具" })),
    ...(workspace.shots || []).map((item, index) => ({ ...item, bucket: "分镜", order: index + 1 })),
  ];
  const media = [];
  const sortBySelection = (assets = [], selected = {}) =>
    [...assets].sort((a, b) => {
      const aSelected = selected && [a.url, a.remoteUrl].includes(selected.url || selected.remoteUrl || selected);
      const bSelected = selected && [b.url, b.remoteUrl].includes(selected.url || selected.remoteUrl || selected);
      return Number(bSelected) - Number(aSelected);
    });
  for (const item of items) {
    const selectedImage = item.selectedAssets?.image;
    const selectedVideo = item.selectedAssets?.video;
    for (const image of sortBySelection(item.assets?.images || [], selectedImage)) {
      const selected = selectedImage && [image.url, image.remoteUrl].includes(selectedImage.url || selectedImage.remoteUrl || selectedImage);
      media.push({ type: "image", bucket: item.bucket, name: item.name, url: image.url, remoteUrl: image.remoteUrl, selected });
    }
    for (const video of sortBySelection(item.assets?.videos || [], selectedVideo)) {
      const selected = selectedVideo && [video.url, video.remoteUrl].includes(selectedVideo.url || selectedVideo.remoteUrl || selectedVideo);
      media.push({ type: "video", bucket: item.bucket, name: item.name, url: video.url, remoteUrl: video.remoteUrl, selected });
    }
  }
  return media;
}

function renderMediaThumb(media) {
  if (media.type === "video") {
    return `<video muted playsinline src="${escapeHtml(media.url)}"></video>`;
  }
  return `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.name)}" loading="lazy" />`;
}

function renderEditingPanel(job) {
  const media = collectTimelineMedia(job);
  const shots = job?.workspace?.shots || [];
  const finalVideo = job?.assets?.finalVideo?.url;
  const viewer = finalVideo
    ? `<video controls playsinline src="${escapeHtml(finalVideo)}"></video>`
    : media[0]
      ? renderMediaThumb(media[0])
      : `<div class="video-placeholder">素材生成后会出现在预览窗口</div>`;
  return `
    <section class="panel-block edit-suite" id="edit-suite">
      <div class="section-head wrap">
        <div>
          <span class="eyebrow">Edit Page</span>
          <h2>剪辑面板</h2>
          <p>素材池、预览、检查器和时间线放在同一个地方，按分镜顺序串成片。</p>
        </div>
      </div>
      <div class="edit-grid">
        <aside class="media-bin">
          <div class="edit-pane-head">素材池</div>
          <div class="media-bin-list">
            ${
              media.length
                ? media
                    .slice(0, 24)
                    .map(
                      (item) => `
                        <a class="media-bin-item ${item.selected ? "selected" : ""}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
                          ${renderMediaThumb(item)}
                          <strong>${escapeHtml(item.bucket)} · ${escapeHtml(item.name)}</strong>
                          <small>${escapeHtml(item.type === "video" ? "视频" : "图片")}${item.selected ? " · 已选用" : ""}</small>
                        </a>
                      `,
                    )
                    .join("")
                : `<p class="empty-text">角色图、场景图、道具图和分镜素材会进这里。</p>`
            }
          </div>
        </aside>
        <section class="program-monitor">
          <div class="edit-pane-head">预览窗口</div>
          <div class="program-viewer">${viewer}</div>
          <textarea
            data-command-input="edit"
            rows="3"
            placeholder="例如：剪辑节奏更像悬疑预告，前半段慢，打火机出现后加快，配乐压抑，结尾黑场留两秒。"
          ></textarea>
          <div class="director-actions">
            <button class="secondary-button" data-action="director-revise" data-command-source="edit" type="button">调整剪辑方案</button>
            <button class="primary-button" data-action="director-final" data-command-source="edit" type="button">用当前时间线成片</button>
          </div>
        </section>
        <aside class="inspector-pane">
          <div class="edit-pane-head">检查器</div>
          <dl class="meta-list">
            <div><dt>片长</dt><dd>${escapeHtml(job?.input?.durationSeconds || 0)} 秒</dd></div>
            <div><dt>素材</dt><dd>${escapeHtml(media.length)} 个</dd></div>
            <div><dt>分镜</dt><dd>${escapeHtml(shots.length)} 条</dd></div>
            <div><dt>配音配乐</dt><dd>交给 LibTV 自动完成</dd></div>
          </dl>
        </aside>
      </div>
      <div class="timeline-panel">
        <div class="timeline-ruler">
          <span>00:00</span>
          <span>00:10</span>
          <span>00:20</span>
          <span>00:30</span>
          <span>END</span>
        </div>
        <div class="timeline-track">
          <span class="track-label">V1</span>
          <div class="timeline-clips">
            ${
              shots.length
                ? shots
                    .map(
                      (shot, index) => `
                        <article class="timeline-clip ${shot.status === "completed" ? "ready" : ""}">
                          <strong>${String(index + 1).padStart(2, "0")} ${escapeHtml(shot.name || `分镜 ${index + 1}`)}</strong>
                          <small>${escapeHtml(shot.durationSeconds || "")}s · ${escapeHtml(itemStatusText(shot.status))}</small>
                        </article>
                      `,
                    )
                    .join("")
                : `<article class="timeline-empty">文字分镜生成后会在这里形成时间线。</article>`
            }
          </div>
        </div>
        <div class="timeline-track audio">
          <span class="track-label">A1</span>
          <div class="timeline-clips">
            <article class="timeline-clip audio">旁白 + 配乐由 LibTV 在最终成片时生成</article>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAssets(job) {
  const videos = job?.assets?.libtvVideos || [];
  const images = job?.assets?.libtvImages || [];
  const urls = job?.external?.libtv?.resultUrls || [];
  if (!videos.length && !images.length && !urls.length) {
    return `<p class="empty-text">LibTV 返回结果后会显示下载链接。</p>`;
  }
  return `
    <div class="asset-list">
      ${videos
        .map(
          (item) => `
            <a class="asset-row" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(item.fileName || "视频结果")}</strong>
              <span>本地视频</span>
            </a>
          `,
        )
        .join("")}
      ${images
        .map(
          (item) => `
            <a class="asset-row" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(item.fileName || "图片结果")}</strong>
              <span>本地图片</span>
            </a>
          `,
        )
        .join("")}
      ${urls
        .filter((url) => !videos.some((item) => item.remoteUrl === url) && !images.some((item) => item.remoteUrl === url))
        .map(
          (url) => `
            <a class="asset-row" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
              <strong>远程结果</strong>
              <span>${escapeHtml(url)}</span>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderLogs(job) {
  const logs = job?.logs || [];
  if (!logs.length) {
    return `<p class="empty-text">日志会随着任务运行更新。</p>`;
  }
  return logs
    .slice()
    .reverse()
    .map(
      (log) => `
        <article class="log-row">
          <strong>${escapeHtml(log.stage)}</strong>
          <p>${escapeHtml(log.message)}</p>
          <span>${escapeHtml(formatDate(log.at))}</span>
        </article>
      `,
    )
    .join("");
}

function renderResult() {
  const job = currentJob();
  if (!job) {
    elements.resultPanel.innerHTML = `
      <section class="status-card">
        <span class="eyebrow">Status</span>
        <h2>等待创建任务</h2>
        <p>先提交一个想法。</p>
      </section>
    `;
    return;
  }

  const libtv = job.external?.libtv || {};
  const finalVideo = job.assets?.finalVideo?.url;
  const progress = job.progress?.percent || 0;
  const canSync = Boolean(libtv.sessionId);

  elements.resultPanel.innerHTML = `
    <section class="status-card ${tone(job.status)}">
      <div>
        <span class="eyebrow">Status</span>
        <h2>${escapeHtml(statusText(job.status))}</h2>
        <p>${escapeHtml(job.progress?.label || "")}</p>
      </div>
      <span class="progress-number">${escapeHtml(String(progress))}%</span>
    </section>

    ${renderFlowOverview(job)}
    ${renderResultOverview(job)}
    ${renderDirectorConsole(job)}
    ${renderScriptBoard(job)}
    ${renderCreativeWorkspace(job)}
    ${renderEditingPanel(job)}

    <section class="media-panel" id="final-output">
      <div class="section-head">
        <h2>最终成片</h2>
        ${canSync ? `<button class="secondary-button" data-action="sync-libtv" type="button">同步 LibTV 成片</button>` : ""}
      </div>
      ${
        finalVideo
          ? `<video controls playsinline src="${escapeHtml(finalVideo)}"></video><a class="canvas-link" href="${escapeHtml(finalVideo)}" target="_blank" rel="noreferrer">直接打开视频</a>`
          : `<div class="video-placeholder">等待 LibTV 返回视频</div>`
      }
      ${
        libtv.projectUrl
          ? `<a class="canvas-link" href="${escapeHtml(libtv.projectUrl)}" target="_blank" rel="noreferrer">打开 LibTV 成片画布</a>`
          : ""
      }
      ${job.error?.message ? `<p class="error-text">${escapeHtml(job.error.message)}</p>` : ""}
    </section>

    <section class="content-grid">
      <div class="panel-block story-block">
        ${renderStory(job)}
      </div>
      <div class="side-stack">
        <article class="panel-block">
          <div class="section-head">
            <h2>LibTV 成片链</h2>
          </div>
          <dl class="meta-list">
            <div><dt>Session</dt><dd>${escapeHtml(libtv.sessionId || "未创建")}</dd></div>
            <div><dt>Project</dt><dd>${escapeHtml(libtv.projectUuid || "未创建")}</dd></div>
            <div><dt>Last Sync</dt><dd>${escapeHtml(formatDate(libtv.lastCheckedAt))}</dd></div>
          </dl>
        </article>
        <article class="panel-block">
          <h2>成片结果文件</h2>
          ${renderAssets(job)}
        </article>
      </div>
    </section>

    <section class="panel-block">
      <h2>日志</h2>
      <div class="log-list">${renderLogs(job)}</div>
    </section>
  `;
}

function render() {
  renderProviders();
  renderJobs();
  renderResult();
}

function applyQueryDefaults() {
  const params = new URLSearchParams(window.location.search);
  const idea = params.get("idea");
  const style = params.get("style");
  const durationSeconds = params.get("durationSeconds");
  if (idea) {
    elements.form.elements.idea.value = idea;
  }
  if (style) {
    elements.form.elements.style.value = style;
  }
  if (durationSeconds) {
    elements.form.elements.durationSeconds.value = durationSeconds;
  }
}

async function submitJob(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const idea = String(formData.get("idea") || "").trim();
  if (!idea) return;

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "剧本生成中...";
  try {
    const payload = await fetchJson("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea,
        style: String(formData.get("style") || "电影感"),
        durationSeconds: Number(formData.get("durationSeconds") || 60),
        runMode: String(formData.get("runMode") || "plan"),
      }),
    });
    state.currentJobId = payload.jobId;
    await loadJobs();
    render();
    startPolling(payload.jobId);
  } catch (error) {
    alert(error.message);
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "生成剧本和可视化步骤";
  }
}

function findWorkspaceCard(section, itemId) {
  return [...document.querySelectorAll("[data-workspace-card]")].find(
    (card) => card.dataset.section === section && card.dataset.itemId === itemId,
  );
}

function readWorkspaceItem(section, itemId) {
  const card = findWorkspaceCard(section, itemId);
  if (!card) return {};
  const read = (field) => card.querySelector(`[data-field="${field}"]`)?.value || "";
  return {
    name: read("name"),
    description: read("description"),
    libtvPrompt: read("libtvPrompt"),
    durationSeconds: read("durationSeconds"),
    voiceover: read("voiceover"),
    camera: read("camera"),
  };
}

async function runWorkspaceAction(action, target) {
  const job = currentJob();
  if (!job) return;

  const section = target.dataset.section;
  const itemId = target.dataset.itemId;
  const item = readWorkspaceItem(section, itemId);
  const actionPath = {
    "save-workspace-item": "save",
    "submit-workspace-item": "submit-libtv",
    "submit-section-first": "submit-libtv",
    "sync-workspace-item": "sync-libtv",
    "select-workspace-asset": "select-asset",
  }[action];
  if (!actionPath) return;

  target.disabled = true;
  const oldText = target.textContent;
  target.textContent = actionPath === "save" ? "保存中..." : actionPath === "sync-libtv" ? "同步中..." : actionPath === "select-asset" ? "选用中..." : "提交中...";
  try {
    const payload = await fetchJson(
      `/api/jobs/${encodeURIComponent(job.id)}/workspace/${encodeURIComponent(section)}/${encodeURIComponent(itemId)}/${actionPath}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          asset: {
            type: target.dataset.assetType,
            url: target.dataset.assetUrl,
          },
        }),
      },
    );
    upsertJob(payload.job);
    render();
    if (shouldPoll(payload.job)) {
      startPolling(payload.job.id);
    }
  } finally {
    target.disabled = false;
    target.textContent = oldText;
  }
}

async function handleClick(event) {
  const target = event.target.closest("[data-action], [data-job-id]");
  if (!target) return;

  const jobId = target.dataset.jobId;
  if (jobId) {
    state.currentJobId = jobId;
    render();
    await loadJob(jobId);
    return;
  }

  const action = target.dataset.action;

  if (action === "refresh") {
    await loadProviders();
    await loadJobs();
    render();
    return;
  }

  if (["director-revise", "director-steps", "director-final"].includes(action)) {
    const job = currentJob();
    if (!job) return;
    const commandSource = target.dataset.commandSource || "global";
    const input = document.querySelector(`[data-command-input="${commandSource}"]`) || document.querySelector("#director-command");
    let command = String(input?.value || "").trim();
    if (!command && action === "director-final") {
      command = "按当前项目上下文串成一条完整成片，包含配音、配乐、剪辑和最终视频输出。";
    }
    if (!command) {
      alert("先输入一句导演指令");
      return;
    }
    const mode = {
      "director-revise": "revise",
      "director-steps": "steps",
      "director-final": "final",
    }[action];
    const oldText = target.textContent;
    target.disabled = true;
    target.textContent = mode === "final" ? "成片提交中..." : "调度中...";
    try {
      const payload = await fetchJson(`/api/jobs/${encodeURIComponent(job.id)}/director-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, mode }),
      });
      upsertJob(payload.job);
      render();
      if (shouldPoll(payload.job)) {
        startPolling(payload.job.id);
      }
    } finally {
      target.disabled = false;
      target.textContent = oldText;
    }
    return;
  }

  if (["section-revise", "section-generate", "generate-section"].includes(action)) {
    const job = currentJob();
    if (!job) return;
    const section = target.dataset.section;
    const input = document.querySelector(`[data-section-command="${section}"]`);
    let command = String(input?.value || "").trim();
    if (!command && action === "generate-section") {
      command = `按当前${sectionMeta[section]?.label || "本组"}设定生成素材。`;
    }
    if (!command) {
      alert("先输入这一组的自然语言调整");
      return;
    }
    const mode = action === "section-revise" ? "revise" : "steps";
    const oldText = target.textContent;
    target.disabled = true;
    target.textContent = mode === "steps" ? "生成中..." : "调度中...";
    try {
      const payload = await fetchJson(`/api/jobs/${encodeURIComponent(job.id)}/workspace/${encodeURIComponent(section)}/director-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, mode }),
      });
      upsertJob(payload.job);
      render();
      if (shouldPoll(payload.job)) {
        startPolling(payload.job.id);
      }
    } finally {
      target.disabled = false;
      target.textContent = oldText;
    }
    return;
  }

  if (["save-workspace-item", "submit-workspace-item", "submit-section-first", "sync-workspace-item", "select-workspace-asset"].includes(action)) {
    await runWorkspaceAction(action, target);
    return;
  }

  if (action === "submit-step-suite") {
    const job = currentJob();
    if (!job) return;
    target.disabled = true;
    target.textContent = "提交中...";
    try {
      const payload = await fetchJson(`/api/jobs/${encodeURIComponent(job.id)}/workspace/step-suite-libtv`, {
        method: "POST",
      });
      upsertJob(payload.job);
      render();
      startPolling(payload.job.id);
    } finally {
      target.disabled = false;
      target.textContent = "生成全部素材";
    }
    return;
  }

  if (action === "sync-libtv") {
    const job = currentJob();
    if (!job) return;
    target.disabled = true;
    target.textContent = "同步中...";
    try {
      const payload = await fetchJson(`/api/jobs/${encodeURIComponent(job.id)}/sync-libtv`, {
        method: "POST",
      });
      upsertJob(payload.job);
      render();
    } finally {
      target.disabled = false;
      target.textContent = "同步 LibTV 成片";
    }
  }
}

async function init() {
  applyQueryDefaults();
  elements.form.addEventListener("submit", submitJob);
  document.addEventListener("click", (event) => {
    handleClick(event).catch((error) => alert(error.message));
  });
  await loadProviders();
  await loadJobs();
  render();
  const job = currentJob();
  if (shouldPoll(job)) {
    startPolling(job.id);
  }
}

init().catch((error) => {
  elements.resultPanel.innerHTML = `<section class="status-card error"><h2>启动失败</h2><p>${escapeHtml(error.message)}</p></section>`;
});
