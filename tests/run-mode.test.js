import test from "node:test";
import assert from "node:assert/strict";
import { getRunModeMeta, normalizeRunMode } from "../src/server/utils/run-mode.js";

test("normalizeRunMode keeps supported values", () => {
  assert.equal(normalizeRunMode("plan"), "plan");
  assert.equal(normalizeRunMode("libtv"), "libtv");
  assert.equal(normalizeRunMode("local"), "local");
  assert.equal(normalizeRunMode("api"), "api");
});

test("normalizeRunMode falls back for unsupported values", () => {
  assert.equal(normalizeRunMode("preview"), "api");
  assert.equal(normalizeRunMode(undefined, "local"), "local");
});

test("getRunModeMeta returns readable labels", () => {
  assert.equal(getRunModeMeta("plan").label, "剧本步骤");
  assert.equal(getRunModeMeta("libtv").label, "LibTV 主链");
  assert.equal(getRunModeMeta("local").label, "本地模式");
  assert.equal(getRunModeMeta("api").label, "API 增强");
});
