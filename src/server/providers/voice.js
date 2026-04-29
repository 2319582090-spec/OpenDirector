import fs from "node:fs/promises";
import { env } from "../config.js";
import { runCommand, getMediaDuration } from "../utils/ffmpeg.js";
import { normalizeRunMode } from "../utils/run-mode.js";

async function synthesizeViaElevenLabs(text, outputPath) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.7,
        },
      }),
    },
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`ElevenLabs 调用失败：${payload || response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return {
    provider: "elevenlabs",
    durationSeconds: await getMediaDuration(outputPath),
  };
}

async function synthesizeViaMacSay(text, outputPath) {
  const tempAiff = outputPath.replace(/\.mp3$/u, ".aiff");
  await runCommand("say", ["-v", "Ting-Ting", "-o", tempAiff, text]);
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    tempAiff,
    "-codec:a",
    "libmp3lame",
    "-qscale:a",
    "2",
    outputPath,
  ]);
  await fs.rm(tempAiff, { force: true });
  return {
    provider: "macos-say",
    durationSeconds: await getMediaDuration(outputPath),
  };
}

export async function synthesizeNarration(text, outputPath, { runMode = "api" } = {}) {
  const mode = normalizeRunMode(runMode, "api");

  if (mode !== "local" && env.ELEVENLABS_API_KEY) {
    try {
      return await synthesizeViaElevenLabs(text, outputPath);
    } catch (error) {
      // Fall through to local TTS.
    }
  }

  return synthesizeViaMacSay(text, outputPath);
}
