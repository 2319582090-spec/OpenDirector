# AI 导演任务 1.2 实施提示词：Provider 状态降噪

更新时间：2026-04-28

## 1. 任务名称

任务 1.2：Provider 状态降噪

## 2. 任务目标

顶部 provider 状态现在会同时展示主链能力和备用能力。备用能力缺失时容易让用户误以为整个系统坏了。这个任务要让用户第一眼看懂：

- GPT-5.4 是否可用。
- LibTV 是否可用。
- 本机导出能力是否可用。
- 备用能力缺失不影响当前主流程。

这个任务只调整 provider 状态展示，不改 provider 状态接口，不改 key 配置，不改生成链路。

## 3. 开发前必须阅读

先读：

1. `docs/AI导演工作台页面规格.md`
2. `docs/AI导演网页规范化推进计划.md`
3. `docs/AI导演网页Agent执行规范.md`
4. `docs/AI导演网页验收矩阵.md`
5. `docs/AI导演任务1-2实施拆分.md`

## 4. 只允许改动

允许：

- `public/app.js`
- `public/styles.css`

不允许：

- 不改 `src/server/provider-status.js`。
- 不改 `.env.local`。
- 不新增 provider。
- 不删除 provider 状态接口字段。
- 不安装新依赖。

## 5. 必须输出

顶部状态栏优先展示三个主状态：

1. `GPT-5.4`：剧本和上下文调度。
2. `LibTV`：素材和成片生成。
3. `本机导出` 或 `FFmpeg`：本地视频播放/导出基础能力。

备用能力处理：

- 本地导演引擎、Remotion、DashScope、fal、Runway、Vidu、ElevenLabs 等缺失时，不要在顶部强视觉显示 error。
- 可以折叠成一个轻量提示，例如：`备用能力 6 项未配置`。
- 鼠标悬停或后续详情区可以保留完整 detail，但第一屏不要吓到用户。

## 6. 建议实现

在 `renderProviders()` 中区分：

- 主链 provider：`openrouterScript`、`libtv`、`ffmpegExport`
- 备用 provider：其余所有 provider

主链正常渲染 chip。

备用 provider 统计：

- missing/error/fallback 的数量。
- ready 的数量。

如果有备用异常，显示一个弱化 chip：

```html
<span class="provider-chip muted">备用能力 6 项未配置</span>
```

不要把备用能力 chip 渲染成红色 error。

## 7. 文案建议

主链文案：

- `GPT-5.4 ready`
- `LibTV ready`
- `本机导出 ready`

备用文案：

- `备用能力未配置，不影响当前 GPT + LibTV 主链`
- `本地模板/其它视频 API 可后续再接`

## 8. 验收标准

桌面 1440 x 900：

- 顶部状态不拥挤。
- GPT-5.4 和 LibTV ready 清楚可见。
- 备用缺失不显示红色主错误感。

手机 390 x 844：

- provider chip 能换行。
- 不出现横向滚动。
- 不把标题挤没。

功能：

- `/api/providers/status` 返回结构不变。
- 不影响任务创建。
- 不影响 LibTV 和 GPT 状态判断。
- 页面刷新无报错。

## 9. 完成后汇报格式

```text
完成：任务 1.2 Provider 状态降噪

改动：
- [说明主链 provider 如何展示]
- [说明备用 provider 如何弱化]

验证：
- [说明桌面检查结果]
- [说明手机检查结果]
- [说明接口和生成链路未改]

剩余问题：
- [如果有]

下一步：
- 建议执行任务 1.3 结果总览状态升级
```

## 10. 禁止事项

- 不要隐藏 GPT-5.4 和 LibTV。
- 不要把主链异常也弱化掉。
- 不要让备用能力 error 抢走第一屏注意力。
- 不要修改后端 provider 状态。
- 不要为了这个任务安装任何新工具。
