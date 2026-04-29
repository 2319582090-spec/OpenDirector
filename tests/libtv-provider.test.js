import test from "node:test";
import assert from "node:assert/strict";
import { extractLibTvResult, extractUrlsFromText } from "../src/server/providers/libtv.js";

test("extractUrlsFromText finds LibTV videos and images", () => {
  const urls = extractUrlsFromText(
    "完成了：https://libtv-res.liblib.art/a/b/final.mp4 以及 https://libtv-res.liblib.art/a/b/cover.png?x=1",
  );
  assert.deepEqual(urls, [
    "https://libtv-res.liblib.art/a/b/final.mp4",
    "https://libtv-res.liblib.art/a/b/cover.png?x=1",
  ]);
});

test("extractLibTvResult reads assistant text and tool json", () => {
  const result = extractLibTvResult([
    {
      seq: 2,
      role: "assistant",
      content: "视频：https://libtv-res.liblib.art/p/final.mov",
    },
    {
      seq: 3,
      role: "tool",
      content: JSON.stringify({
        task_result: {
          images: [{ previewPath: "https://libtv-res.liblib.art/p/a.jpg" }],
          videos: [{ previewPath: "https://libtv-res.liblib.art/p/b.webm" }],
        },
      }),
    },
  ]);

  assert.equal(result.maxSeq, 3);
  assert.deepEqual(result.videos, [
    "https://libtv-res.liblib.art/p/final.mov",
    "https://libtv-res.liblib.art/p/b.webm",
  ]);
  assert.deepEqual(result.images, ["https://libtv-res.liblib.art/p/a.jpg"]);
});
