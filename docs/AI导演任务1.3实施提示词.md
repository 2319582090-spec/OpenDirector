# AI 导演任务 1.3 实施提示词：结果总览状态升级

更新时间：2026-04-28

## 1. 任务名称

任务 1.3：结果总览状态升级

## 2. 任务目标

当前“结果总览”已经有剧本、角色、场景、道具、分镜、成片六块，但它更多是在展示数量和名称。这个任务要让每张总览卡都能回答三个问题：

1. 当前已经有什么？
2. 还缺什么？
3. 下一步应该点哪里？

这个任务只优化总览状态表达，不改后端数据结构，不调用 GPT，不调用 LibTV。

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

- 不改后端接口。
- 不改 job 存储结构。
- 不改 GPT 提示词。
- 不调用 LibTV。
- 不安装新依赖。

## 5. 必须输出

当前结果总览每张卡必须包含：

- 模块名。
- 当前状态。
- 当前结果简述。
- 缺口提示。
- 下一步动作提示。
- 查看入口。

六张卡：

1. 剧本
2. 角色/演员
3. 场景
4. 道具
5. 分镜
6. 成片

## 6. 状态规则

### 6.1 剧本

状态：

- 无 story：`等待生成`
- 有 story：`已生成`

缺口提示：

- 无 story：`先在左侧输入想法。`
- 有 story：`可继续改旁白、冲突和分镜。`

下一步：

- 无 story：`生成剧本和可视化步骤`
- 有 story：`查看剧本`

### 6.2 角色/场景/道具

对 `characters`、`locations`、`props` 使用同一套规则。

统计：

- `total`：卡片数量。
- `completed`：status 为 `completed` 的卡片数量。
- `selected`：存在 `selectedAssets.image` 或 `selectedAssets.video` 的卡片数量。

状态：

- total = 0：`等待拆解`
- total > 0 且 completed = 0：`待生成素材`
- completed > 0 且 selected = 0：`待选用素材`
- selected > 0：`已选用 ${selected}/${total}`

缺口提示：

- 待生成素材：`先生成主体图。`
- 待选用素材：`从返回结果里选一个版本。`
- 已选用：`会优先进入剪辑和成片。`

下一步：

- `生成素材`
- `选用素材`
- `查看`

### 6.3 分镜

统计：

- `total`：分镜卡片数量。
- `completed`：status 为 `completed` 或 assets.videos 有内容的分镜数量。
- `selected`：存在 `selectedAssets.video` 或 `selectedAssets.image` 的分镜数量。

状态：

- total = 0：`等待文字分镜`
- total > 0 且 completed = 0：`文字分镜已生成，视频待生成`
- completed > 0 且 selected = 0：`视频/图片分镜待选用`
- selected > 0：`已选用 ${selected}/${total}`

缺口提示：

- 强调“文字分镜”和“视频镜头”不是同一步。

### 6.4 成片

状态：

- 有 finalVideo：`已返回视频`
- 有 libtv session 但无 finalVideo：`生成中/可同步`
- 无 libtv session：`待串成成片`

缺口提示：

- 待串成：`确认素材后串成最终视频。`
- 生成中：`可稍后同步 LibTV 结果。`
- 已完成：`可以播放，也可以继续调整。`

## 7. 建议实现

在 `public/app.js` 里增加几个小工具函数：

- `countSelectedItems(job, section)`
- `sectionOverviewState(job, section)`
- `shotOverviewState(job)`
- `finalOverviewState(job)`

然后让 `renderResultOverview(job)` 使用这些函数生成卡片。

卡片结构建议增加：

```html
<strong>当前状态</strong>
<p>当前结果</p>
<small>还缺：...</small>
<small>下一步：...</small>
```

样式可以在 `public/styles.css` 里为 `.overview-card small` 或 `.overview-card .next-step` 增加清晰但克制的展示。

## 8. 验收标准

有剧本无素材：

- 剧本显示已生成。
- 角色/场景/道具显示待生成素材。
- 分镜显示文字分镜已生成、视频待生成。
- 成片显示待串成成片。

有素材未选用：

- 对应模块显示待选用素材。
- 不误导用户素材已经进入最终成片。

已选用素材：

- 对应模块显示已选用数量。
- 提示会进入剪辑和成片。

已成片：

- 成片卡显示已返回视频。
- 提示可以播放或继续调整。

桌面 1440 x 900：

- 六张卡不重叠。
- 缺口和下一步文案不溢出。

手机 390 x 844：

- 卡片单列或自然换行。
- 文案可读，无横向滚动。

## 9. 完成后汇报格式

```text
完成：任务 1.3 结果总览状态升级

改动：
- [说明新增了哪些状态判断]
- [说明总览卡新增了哪些提示]

验证：
- [有剧本无素材状态]
- [有素材未选用状态，如可用]
- [已成片状态，如可用]
- [桌面/手机检查]

剩余问题：
- [如果有]

下一步：
- 建议执行任务 2.2 导演公式卡
```

## 10. 禁止事项

- 不要新增复杂后端状态。
- 不要把总览卡做得像营销卡片。
- 不要把“文字分镜已生成”说成“视频已生成”。
- 不要自动触发素材生成。
- 不要调用 LibTV。
