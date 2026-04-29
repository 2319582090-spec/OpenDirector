import { appendJobLog, getJob, mutateJob } from "./job-store.js";
import { submitFinalLibTvJob } from "./pipeline.js";
import { generateDirectorCommandPlan } from "./providers/director-command.js";
import {
  submitWorkspaceSectionToLibTv,
  submitWorkspaceSuiteToLibTv,
  WORKSPACE_SECTIONS,
} from "./workspace-steps.js";

function normalizeMode(value) {
  if (value === "steps" || value === "final") return value;
  return "revise";
}

export async function runDirectorCommand(jobId, { command, mode = "revise" }) {
  const cleanCommand = String(command || "").trim();
  if (!cleanCommand) {
    throw new Error("请先输入导演指令");
  }

  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  const nextMode = normalizeMode(mode);
  await mutateJob(jobId, (draft) => {
    draft.status = "running";
    draft.error = null;
    draft.progress = {
      stage: "director_command",
      percent: 35,
      label: "GPT-5.4 正在调度导演指令",
    };
  });
  await appendJobLog(jobId, "director-agent", `收到导演指令：${cleanCommand}`);

  const latest = await getJob(jobId);
  let plan;
  try {
    plan = await generateDirectorCommandPlan({ job: latest, command: cleanCommand });
  } catch (error) {
    if (nextMode === "final") {
      await appendJobLog(jobId, "director-agent", `GPT 调度暂时失败，改用当前上下文直接交给 LibTV：${error.message}`);
      return submitFinalLibTvJob(jobId);
    }
    if (nextMode === "steps") {
      await appendJobLog(jobId, "director-agent", `GPT 调度暂时失败，改用当前步骤直接交给 LibTV：${error.message}`);
      return submitWorkspaceSuiteToLibTv(jobId);
    }
    await mutateJob(jobId, (draft) => {
      draft.status = "failed";
      draft.error = { message: error.message };
      draft.progress = {
        stage: "failed",
        percent: draft.progress?.percent || 0,
        label: "导演调度失败",
      };
    });
    throw error;
  }
  await mutateJob(jobId, (draft) => {
    draft.story = plan.story;
    draft.workspace = plan.workspace;
    draft.providers.script = plan.provider;
    draft.external.directorAgent = {
      ...(draft.external.directorAgent || {}),
      lastCommand: cleanCommand,
      lastReply: plan.directorReply,
      nextActions: plan.nextActions,
      libtvFinalTask: plan.libtvFinalTask,
      updatedAt: new Date().toISOString(),
    };
    draft.commandHistory = [
      ...(draft.commandHistory || []),
      {
        at: new Date().toISOString(),
        command: cleanCommand,
        mode: nextMode,
        reply: plan.directorReply,
      },
    ].slice(-20);
    draft.progress = {
      stage: "director_ready",
      percent: 48,
      label: "GPT-5.4 已更新剧本和步骤",
    };
    draft.status = draft.assets?.finalVideo?.url ? "completed" : "waiting_libtv";
  });
  await appendJobLog(jobId, "director-agent", plan.directorReply);

  if (nextMode === "steps") {
    return submitWorkspaceSuiteToLibTv(jobId);
  }

  if (nextMode === "final") {
    return submitFinalLibTvJob(jobId, plan.libtvFinalTask);
  }

  return getJob(jobId);
}

export async function runSectionDirectorCommand(jobId, { section, command, mode = "revise" }) {
  const meta = WORKSPACE_SECTIONS[section];
  if (!meta) {
    throw new Error("未知的创作步骤");
  }
  const cleanCommand = String(command || "").trim();
  if (!cleanCommand) {
    throw new Error(`请先输入${meta.label}的调整指令`);
  }

  const scopedCommand = [
    `只调整「${meta.label}」这一组，其他组除非必要不要改。`,
    `用户对这一组的自然语言指令：${cleanCommand}`,
  ].join("\n");
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`任务不存在：${jobId}`);
  }

  const nextMode = normalizeMode(mode);
  await mutateJob(jobId, (draft) => {
    draft.status = "running";
    draft.error = null;
    draft.progress = {
      stage: "director_section_command",
      percent: 36,
      label: `GPT-5.4 正在调整${meta.label}`,
    };
  });
  await appendJobLog(jobId, "director-agent", `${meta.label}指令：${cleanCommand}`);

  let plan;
  try {
    const latest = await getJob(jobId);
    plan = await generateDirectorCommandPlan({ job: latest, command: scopedCommand });
  } catch (error) {
    if (nextMode === "steps") {
      await appendJobLog(jobId, "director-agent", `GPT 暂时失败，先用当前${meta.label}直接生成：${error.message}`);
      return submitWorkspaceSectionToLibTv(jobId, section);
    }
    await mutateJob(jobId, (draft) => {
      draft.status = "failed";
      draft.error = { message: error.message };
      draft.progress = {
        stage: "failed",
        percent: draft.progress?.percent || 0,
        label: `${meta.label}调整失败`,
      };
    });
    throw error;
  }

  await mutateJob(jobId, (draft) => {
    draft.story = plan.story;
    draft.workspace = plan.workspace;
    draft.providers.script = plan.provider;
    draft.external.directorAgent = {
      ...(draft.external.directorAgent || {}),
      lastCommand: cleanCommand,
      lastReply: plan.directorReply,
      lastSection: section,
      nextActions: plan.nextActions,
      libtvFinalTask: plan.libtvFinalTask,
      updatedAt: new Date().toISOString(),
    };
    draft.commandHistory = [
      ...(draft.commandHistory || []),
      {
        at: new Date().toISOString(),
        command: cleanCommand,
        section,
        mode: nextMode,
        reply: plan.directorReply,
      },
    ].slice(-20);
    draft.progress = {
      stage: "director_section_ready",
      percent: 50,
      label: `GPT-5.4 已更新${meta.label}`,
    };
    draft.status = draft.assets?.finalVideo?.url ? "completed" : "waiting_libtv";
  });
  await appendJobLog(jobId, "director-agent", `${meta.label}已更新：${plan.directorReply}`);

  if (nextMode === "steps") {
    return submitWorkspaceSectionToLibTv(jobId, section);
  }

  return getJob(jobId);
}
