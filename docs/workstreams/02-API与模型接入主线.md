# API 与模型接入主线

更新时间：2026-04-22

## 目标

把文本、图片、视频、配音能力接成一个稳定的 provider 层，支持主链、备用链和 fallback。

## 负责范围

- key 配置
- 第三方 API 接入
- 请求协议适配
- 错误处理
- provider 状态上报

## 当前文件

- [config.js](../../src/server/config.js)
- [provider-status.js](../../src/server/provider-status.js)
- [script.js](../../src/server/providers/script.js)
- [dashscope-video.js](../../src/server/providers/dashscope-video.js)
- [runway-video.js](../../src/server/providers/runway-video.js)
- [voice.js](../../src/server/providers/voice.js)

## 当前已完成

- 文本链：
  - `2API / Nova Compatible` 已接入
  - `OpenRouter` 已接入
- 视频链：
  - `DashScope` 已有代码位
  - `Runway` 已有代码位
  - `Vidu` 已有 key 和状态位
- 配音链：
  - `ElevenLabs` 已预留
  - `macOS say` 可兜底

## 当前还缺

- `Vidu` 真实视频生成接入
- `腾讯混元` 接入
- `火山即梦` 签名式 API 接入
- 图片生成链路正式接入

## Done 标准

- 至少 1 条文本链稳定
- 至少 1 条视频链稳定
- 至少 1 条配音链稳定或可降级
- 所有 provider 失败时都有清晰错误信息

## 下一步

1. 正式接 `Vidu` 视频生成
2. 接 `腾讯混元` 文生视频 / 图生视频
3. 补图片链和更多备用 provider
