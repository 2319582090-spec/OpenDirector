# OpenDirector

OpenDirector is a free and open-source AI director workbench.

It helps creators turn one idea into a controllable filmmaking workflow: script, characters, locations, props, shots, voiceover, music, editing, and final preview.

This project was started by director Shaoqi Shao. The goal is simple: make AI filmmaking tools open, understandable, and useful for everyone, not locked behind a closed product.

## Why OpenDirector

Today, many AI video tools can generate impressive clips, but a complete film still needs directing decisions:

- What is the story?
- Who are the characters?
- Where does each shot happen?
- Which props and visual references should stay consistent?
- How should voiceover, music, rhythm, and editing connect?

OpenDirector tries to make that middle layer visible and editable. It is not only a "generate video" button. It is a place where creators and developers can build the director workflow together.

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
- Sending pull requests for workflow, UI, provider, or infrastructure improvements.
- Sharing director formulas, storyboard templates, editing logic, prompt patterns, and production experience.
- Connecting new AI video, image, voice, music, editing, or timeline tools.
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
