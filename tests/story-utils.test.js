import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackStory,
  createScenePlan,
  normalizeDurationSeconds,
} from "../src/server/utils/story.js";

test("normalizeDurationSeconds maps input into 30/60/90 buckets", () => {
  assert.equal(normalizeDurationSeconds("30 秒"), 30);
  assert.equal(normalizeDurationSeconds(59), 60);
  assert.equal(normalizeDurationSeconds("90"), 90);
});

test("createScenePlan prefers fewer longer scenes for dashscope-like flow", () => {
  assert.deepEqual(createScenePlan(30, "dashscope"), {
    sceneCount: 3,
    sceneDurationSeconds: 10,
  });
  assert.deepEqual(createScenePlan(60, "dashscope"), {
    sceneCount: 4,
    sceneDurationSeconds: 15,
  });
  assert.deepEqual(createScenePlan(90, "dashscope"), {
    sceneCount: 6,
    sceneDurationSeconds: 15,
  });
});

test("buildFallbackStory returns the requested amount of scenes", () => {
  const story = buildFallbackStory({
    idea: "一名导演在凌晨的工作台上改最后一版预告片",
    style: "电影感",
    targetSeconds: 60,
    sceneCount: 4,
    sceneDurationSeconds: 15,
  });

  assert.equal(story.scenes.length, 4);
  assert.ok(story.title.includes("电影感"));
  assert.ok(story.narration.length > 20);
});
