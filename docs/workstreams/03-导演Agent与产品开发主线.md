# 导演 Agent 与产品开发主线

更新时间：2026-04-22

## 目标

让系统从“调用几个模型”升级成“会做总调度的导演 Agent”。

## 负责范围

- 用户想法理解
- 调度计划生成
- 上下文与项目记忆
- provider 选择与 fallback
- 多阶段任务编排
- job 数据结构与执行轨迹

## 当前文件

- [pipeline.js](../../src/server/pipeline.js)
- [job-store.js](../../src/server/job-store.js)
- [story.js](../../src/server/utils/story.js)
- [script.js](../../src/server/providers/script.js)

## 当前已完成

- 已有基础任务链：
  - idea -> story
  - story -> narration
  - narration -> export
- 已有 provider fallback 雏形
- 已有 job 状态、日志和产物结构

## 当前还缺

- 调度计划层还不独立
- 上下文记忆还没正式落地
- 模型选择理由还没持久化到 job
- 结果比较、自动重试和更细的策略还没做

## Done 标准

- 任务开始前先产出调度计划
- job 中能看到：
  - 目标
  - 当前策略
  - 选了哪个模型
  - 为什么这样选
  - 失败后切到了什么 fallback
- UI 能读懂这些信息

## 下一步

1. 抽出独立的 `orchestration` 层
2. 先让 `GPT-5.4 / 兼容模型` 负责总调度
3. 把调度结果写进 job，并同步展示到 UI
