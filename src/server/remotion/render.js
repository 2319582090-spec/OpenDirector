import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { REMOTION_ENTRY } from "../config.js";

let bundlePromise;
let compositionPromise;

async function getBundleLocation() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: REMOTION_ENTRY,
      onProgress: () => undefined,
    });
  }
  return bundlePromise;
}

async function getDirectorBoardComposition() {
  if (!compositionPromise) {
    compositionPromise = (async () => {
      const serveUrl = await getBundleLocation();
      const compositions = await getCompositions(serveUrl, {
        inputProps: {},
      });
      const composition = compositions.find((item) => item.id === "DirectorBoard");
      if (!composition) {
        throw new Error("找不到 DirectorBoard Remotion 组件");
      }
      return composition;
    })();
  }

  return compositionPromise;
}

export async function renderBoardStill(inputProps, outputPath) {
  const serveUrl = await getBundleLocation();
  const composition = await getDirectorBoardComposition();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    output: outputPath,
  });
  return outputPath;
}
