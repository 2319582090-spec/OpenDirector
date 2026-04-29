import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FPS, VIDEO_SIZE } from "../config.js";

const execFileAsync = promisify(execFile);

export async function commandExists(command) {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function runCommand(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 20,
      ...options,
    });
  } catch (error) {
    const detail = error.stderr || error.stdout || error.message;
    throw new Error(`${command} 执行失败：${detail}`.trim());
  }
}

export async function getMediaDuration(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return Number.parseFloat(stdout.trim()) || 0;
}

export async function renderStillToVideo(stillPath, outputPath, durationSeconds) {
  await runCommand("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-framerate",
    String(FPS),
    "-i",
    stillPath,
    "-t",
    String(durationSeconds),
    "-vf",
    `scale=${VIDEO_SIZE.width}:${VIDEO_SIZE.height}:force_original_aspect_ratio=decrease,pad=${VIDEO_SIZE.width}:${VIDEO_SIZE.height}:(ow-iw)/2:(oh-ih)/2:color=#0d1117,format=yuv420p`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function normalizeVideoClip(inputPath, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=${VIDEO_SIZE.width}:${VIDEO_SIZE.height}:force_original_aspect_ratio=increase,crop=${VIDEO_SIZE.width}:${VIDEO_SIZE.height},fps=${FPS},format=yuv420p`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function concatVideos(videoPaths, outputPath) {
  const listPath = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
  const content = videoPaths
    .map((videoPath) => `file '${videoPath.replace(/'/gu, "'\\''")}'`)
    .join("\n");

  await fs.writeFile(listPath, content, "utf8");
  try {
    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ]);
  } finally {
    await fs.rm(listPath, { force: true });
  }
}

function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = String(Math.floor(totalMs / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((totalMs % 3600000) / 60000)).padStart(2, "0");
  const secs = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, "0");
  const ms = String(totalMs % 1000).padStart(3, "0");
  return `${hours}:${minutes}:${secs},${ms}`;
}

export async function writeSrt(subtitles, outputPath) {
  const body = subtitles
    .map((item, index) => {
      return [
        String(index + 1),
        `${formatSrtTime(item.start)} --> ${formatSrtTime(item.end)}`,
        item.text,
        "",
      ].join("\n");
    })
    .join("\n");

  await fs.writeFile(outputPath, body, "utf8");
  return outputPath;
}

function escapeSubtitlePath(filePath) {
  return filePath
    .replace(/\\/gu, "\\\\")
    .replace(/:/gu, "\\:")
    .replace(/'/gu, "\\\\'");
}

export async function burnSubtitlesAndMixAudio({
  videoPath,
  audioPath,
  subtitlePath,
  outputPath,
  durationSeconds,
}) {
  const runExport = async ({ includeSubtitles }) => {
    const args = [
      "-y",
      "-i",
      videoPath,
    ];

    if (audioPath) {
      args.push("-i", audioPath);
    }

    if (includeSubtitles && subtitlePath) {
      const subtitleFilter = `subtitles=filename=${escapeSubtitlePath(path.basename(subtitlePath))}`;
      args.push("-vf", subtitleFilter);
    }

    if (audioPath) {
      args.push(
        "-af",
        "apad",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        String(durationSeconds),
        outputPath,
      );
    } else {
      args.push(
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-t",
        String(durationSeconds),
        outputPath,
      );
    }

    await runCommand("ffmpeg", args, subtitlePath ? { cwd: path.dirname(subtitlePath) } : {});
  };

  try {
    await runExport({ includeSubtitles: Boolean(subtitlePath) });
    return {
      subtitlesBurned: Boolean(subtitlePath),
    };
  } catch (error) {
    const message = String(error?.message || "");
    const subtitleFilterUnavailable =
      message.includes("No such filter: 'subtitles'") ||
      message.includes("Error parsing filterchain") ||
      message.includes("No option name near");

    if (!subtitlePath || !subtitleFilterUnavailable) {
      throw error;
    }

    await runExport({ includeSubtitles: false });
    return {
      subtitlesBurned: false,
    };
  }
}
