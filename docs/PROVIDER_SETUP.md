# Provider Setup

## 1. 阿里百炼 / 通义万相

- 视频生成入口：[视频生成](https://help.aliyun.com/zh/model-studio/use-video-generation)
- 价格页：[模型价格](https://help.aliyun.com/document_detail/2586397.html)
- 开通 API Key：[获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)

需要配置：

- `DASHSCOPE_API_KEY`

当前默认模型：

- 文本：`qwen-plus`
- 视频：`wan2.6-t2v`

## 2. Runway API

- 文档：[Runway API Docs](https://docs.dev.runwayml.com/)
- 价格：[Runway API Pricing](https://docs.dev.runwayml.com/guides/pricing/)
- 官网价格页：[Runway Pricing](https://runwayml.com/pricing)

需要配置：

- `RUNWAY_API_KEY`

当前默认模型：

- `gen4.5`

## 3. fal.ai

- 文档：[Model APIs Overview](https://fal.ai/docs/documentation/model-apis/overview)
- API 参考：[Model API Reference](https://fal.ai/docs/model-api-reference)
- 视频模型示例：[Seedance 2.0](https://fal.ai/models/bytedance/seedance-2.0/api)
- 图片模型示例：[Nano Banana](https://fal.ai/models/fal-ai/nano-banana/api)

需要配置：

- `FAL_API_KEY`
- 可选：`FAL_VIDEO_MODEL`
- 可选：`FAL_IMAGE_MODEL`

当前默认模型：

- 视频：`bytedance/seedance-2.0/fast/text-to-video`
- 图片：`fal-ai/nano-banana`

说明：

- 项目里已经接入 fal 队列式调用，可直接作为文生视频备用链。
- 图片生成能力也已经预留，后续接前端按钮即可直接使用。

## 4. Nova AI 聚合接口

- 主站文档：[Nova ai 官方文档](https://docs.novai.su/)
- 控制台入口：[Nova Api](https://index.novai.su/)

需要配置：

- `NOVA_API_KEY`
- 可选：`NOVA_BASE_URL`
- 可选：`NOVA_VIDEO_MODEL`
- 可选：`NOVA_IMAGE_MODEL`

当前默认配置：

- Base URL：`https://us.novaiapi.com/v1`
- 视频：`grok-imagine-1.0-video`
- 图片：`nano-banana`

说明：

- 这是聚合兼容层，适合快速试多个模型，不建议替代所有官方主链。
- 它的文档明确提供 OpenAI Compatible 接入方式，适合后续补 chat / image / 多模型路由。
- 当前项目里已经补上 `Nova` provider，可直接作为文生视频与文生图链路使用。

## 5. ElevenLabs

需要配置：

- `ELEVENLABS_API_KEY`
- 可选：`ELEVENLABS_VOICE_ID`

如果未配置，会自动降级到 macOS `say`。

## 6. OpenRouter

需要配置：

- `OPENROUTER_API_KEY`

如果未配置，会自动降级到 DashScope Qwen，再降级到本地模板。

## 7. 注册与购买说明

- 我已经把接入逻辑实现成“主链 + 备用链 + 兜底链”。
- 真正的注册、登录、充值和最终提交动作需要你在浏览器里确认，因为这些属于账号创建和消费动作。
- 代码层已经按你要的顺序准备好了：阿里优先，`fal` 备用，Runway 再备用，Remotion + FFmpeg 不依赖额外剪辑 API。
