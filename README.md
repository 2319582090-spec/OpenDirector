# OpenDirector

OpenDirector is a free and open-source AI director workbench.

It helps creators turn one idea into a controllable filmmaking workflow: script, characters, locations, props, shots, voiceover, music, editing, and final preview.

**一个想法，自由选择，导演 Agent。**

This project was started by director Shaoqi Shao. The goal is simple: make AI filmmaking tools open, understandable, and useful for everyone, not locked behind a closed product.

## Why OpenDirector

Today, many AI video tools can generate impressive clips, but a complete film still needs directing decisions:

- What is the story?
- Who are the characters?
- Where does each shot happen?
- Which props and visual references should stay consistent?
- How should voiceover, music, rhythm, and editing connect?

OpenDirector tries to make that middle layer visible and editable. It is not only a "generate video" button. It is a place where creators and developers can build the director workflow together.

## Ecosystem Vision / 生态愿景

OpenDirector is not a single-model product. It is an open director Agent ecosystem.

一个想法进入 OpenDirector 后，创作者应该可以自由选择剧本模型、视频模型、配乐模型、配音模型、剪辑工具、全局调度 Agent、本地模型和开发者插件。导演 Agent 负责理解创作意图、拆解任务、调度工具、记住偏好、组织素材，并把创作者的判断沉淀成可复用的工作流。

OpenDirector wants to support any generation model, any local model, and any creative tool through one shared directing workflow. The names below are ecosystem directions and possible integrations, not a claim that every capability is already implemented.

## 一个想法，自由选择，导演 Agent

OpenDirector 想做的不是另一个封闭的 AI 视频生成按钮，而是一个开放的导演 Agent 生态。

你可以从一个想法开始，自由选择剧本模型、视频模型、配乐模型、配音模型、剪辑工具、本地模型和自定义插件。导演 Agent 负责理解创作意图、拆解任务、调度工具、记住偏好、组织素材，并把创作者的判断沉淀成可复用的工作流。

我们邀请所有人一起共建这个生态：开发者接入模型和工具，导演提供真实创作经验，剪辑师贡献剪辑逻辑，音乐人与声音创作者完善配乐配音，研究者探索记忆、调度和多 Agent 协作。

OpenDirector 的口号是：

**一个想法，自由选择，导演 Agent。**

## Co-Building Directions

- **Hermes self-evolving memory / Hermes 自我进化记忆**: learn user preferences, creative style, successful cases, reusable skills, and decision patterns so the director Agent can remember and improve.
- **Manus global orchestration / Manus 全局调度**: break down complex creative tasks, coordinate multimodal AI models, optimize resources, and automate the full idea-to-film process.
- **OpenClaw platform system / OpenClaw 平台功能系统**: provide a unified Agent runtime, tool and model management, and multimodal user interaction interfaces.
- **Claude Code custom development / Claude Code 自定义开发**: let developers build advanced editing logic, intelligent music scoring, multilingual voice adaptation, and other specialized creative functions.

## Model and Tool Matrix

| Workflow area | Example models and tools |
| --- | --- |
| 剧本创作 | ChatGPT, Gemini, DeepSeek, 豆包 |
| 文生视频 | Sora 2, Seedance 2.0, 即梦 |
| 配乐 | Suno, Lyria 3, MiniMax Music |
| 配音 | ElevenLabs, Resemble AI, Uberduck |
| 剪辑 | Medeo, ChatCut, LTX Desktop |
| 导演 Agent | GPT-5.5, Claude 3, Gemini, Manus |

## Current Prototype

- Web workbench for entering an idea, style, and target duration.
- Script and director brief generation through configured text providers.
- Visual workspace for characters, locations, props, and shots.
- LibTV / agent-im integration for image, video, and final film generation.
- Local file storage for generated assets and job metadata.
- Provider status panel and fallback-oriented run modes.

## Quick Start

1. Copy `.env.example` to `.env.local`.
2. Fill only the provider keys you want to use. The app can still run with missing providers, but real generation requires the relevant keys.
3. Install dependencies and start the local server.

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8123/
```

## Environment

OpenDirector reads local configuration from `.env.local`.

Common provider variables:

- `OPENROUTER_API_KEY`
- `LIBTV_ACCESS_KEY`
- `DASHSCOPE_API_KEY`
- `FAL_API_KEY`
- `RUNWAY_API_KEY`
- `NOVA_API_KEY`
- `VIDU_API_KEY`
- `ELEVENLABS_API_KEY`

See [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md) for setup notes.

## Project Structure

```text
public/               Web workbench UI
src/server/           Node server, providers, director workflow, Remotion entry
storage/generated/    Local generated assets, ignored by git
storage/jobs/         Local job metadata, ignored by git
docs/                 Research, workflow notes, provider setup, implementation plans
tests/                Node tests
```

## Community Invitation

我是一名导演，也是一名正在学习如何把 AI 真正放进创作流程的人。

我不想把 OpenDirector 做成一个封闭产品。它应该是一个开放的导演工作台：开发者可以接入模型和工具，导演和创作者可以提出真实工作流，剪辑师、编剧、设计师、声音创作者都可以把自己的经验变成软件的一部分。

作为导演，我可以协助大家把真实创作流程、导演判断、分镜逻辑、剪辑节奏和创作痛点转成更适合开发的任务，一起把 OpenDirector 做成一个真正可共建的开源生态。

If you believe AI filmmaking should be more open, cheaper, and freer, you are welcome here.

You can help by:

- Opening issues about real creative pain points.
- Sending pull requests for workflow, UI, provider, memory, orchestration, plugin, local model, or infrastructure improvements.
- Sharing director formulas, storyboard templates, editing logic, prompt patterns, and production experience.
- Connecting new AI video, image, voice, music, editing, timeline, cloud model, or local model tools.
- Testing OpenDirector with real creative projects and reporting what breaks.

OpenDirector is free and open source.

## Contact

Shaoqi Shao, director and initiator of OpenDirector.

- `239582090@qq.com`
- `2319582090z@google.com`
- `scq2319582090@outlook.com`

For project discussions, feature requests, and bug reports, please also use GitHub Issues so the whole community can follow along.

## License

MIT. See [LICENSE](LICENSE).
