# AI 导演任务 2.2 实施提示词：导演公式卡

更新时间：2026-04-28

## 1. 任务名称

任务 2.2：导演公式卡

## 2. 任务目标

输入想法后，用户现在能看到剧本和分镜，但看不到 AI 是如何把一个想法拆成可控结构的。这个任务要在剧本区增加“导演公式卡”，让用户看到并理解：

- 主题是什么。
- 情绪是什么。
- 冲突是什么。
- 主视觉是什么。
- 角色、场景、道具分别是什么。
- 节奏怎么走。

这个任务借鉴小云雀的“AI 思考过程/创意公式”机制，但不复制其品牌或页面。

## 3. 开发前必须阅读

先读：

1. `docs/AI导演工作台页面规格.md`
2. `docs/AI导演网页规范化推进计划.md`
3. `docs/AI导演网页Agent执行规范.md`
4. `docs/AI导演网页验收矩阵.md`
5. `docs/AI导演竞品观察-小云雀.md`
6. `docs/AI导演任务1-2实施拆分.md`

## 4. 只允许改动

允许：

- `public/app.js`
- `public/styles.css`

不允许：

- 不改后端 schema。
- 不改 OpenRouter/GPT 提示词。
- 不改 LibTV 逻辑。
- 不调用 LibTV。
- 不安装新依赖。

## 5. 必须输出

在剧本区 `renderScriptBoard(job)` 中增加一张“导演公式”卡。

字段：

1. 主题
2. 情绪
3. 冲突
4. 主视觉
5. 角色
6. 场景
7. 道具
8. 节奏

如果字段无法从现有数据推导，显示 `待补充`，不能留空。

## 6. 字段推导规则

不新增后端字段，先从现有 `job.input`、`job.story`、`job.workspace` 推导：

### 主题

优先：

1. `job.story.title`
2. `job.input.idea`
3. `待补充`

### 情绪

优先：

1. 从 `job.input.style` 推导，例如电影感、悬疑、国风、赛博、品牌片。
2. 从 `job.story.summary` 里截取一句。
3. `待补充`

### 冲突

优先：

1. `job.story.summary`
2. `job.story.scenes[1].visualDescription`
3. `待补充`

### 主视觉

优先：

1. `job.story.scenes[0].visualDescription`
2. `job.story.scenes[0].visualPrompt`
3. `待补充`

### 角色

优先：

1. `job.workspace.characters` 的前 2 个名称。
2. `待补充`

### 场景

优先：

1. `job.workspace.locations` 的前 2 个名称。
2. `待补充`

### 道具

优先：

1. `job.workspace.props` 的前 2 个名称。
2. `待补充`

### 节奏

优先：

1. `job.story.scenes` 数量 + `job.input.durationSeconds`，例如 `3 段结构 / 30 秒`。
2. `待补充`

## 7. UI 建议

在剧本摘要和旁白之间，或剧本摘要之后加入：

```html
<article class="director-formula">
  <div class="section-head">
    <h3>导演公式</h3>
    <span>AI 拆解</span>
  </div>
  <div class="formula-grid">
    <div><span>主题</span><strong>...</strong></div>
    ...
  </div>
  <p>可以用上面的导演指令继续调整公式、剧本和分镜。</p>
</article>
```

样式：

- `.director-formula`
- `.formula-grid`
- `.formula-item`

风格要求：

- 内测工具感。
- 信息密度高。
- 不做营销式大卡片。
- 不使用渐变装饰。

## 8. 验收标准

有剧本时：

- 剧本区显示导演公式卡。
- 8 个字段都出现。
- 无数据字段显示 `待补充`。
- 公式卡不挤压旁白和分镜。

无剧本时：

- 仍显示原来的空状态提示，不报错。

桌面 1440 x 900：

- 公式字段排列清楚。
- 长文本不撑破卡片。

手机 390 x 844：

- 公式字段可读。
- 不出现横向滚动。

功能：

- 不调用 GPT。
- 不调用 LibTV。
- 不改变 job 数据。
- 页面刷新无报错。

## 9. 完成后汇报格式

```text
完成：任务 2.2 导演公式卡

改动：
- [说明新增公式卡]
- [说明字段如何从现有数据推导]

验证：
- [有剧本状态]
- [无剧本状态]
- [桌面/手机检查]
- [未调用 GPT/LibTV]

剩余问题：
- [如果有]

下一步：
- 建议执行任务 2.4 文字分镜验收状态
```

## 10. 禁止事项

- 不要新增后端 schema。
- 不要修改 GPT 输出要求。
- 不要把公式卡做成营销 hero。
- 不要让公式卡占掉整个第一屏。
- 不要把空字段留空。
